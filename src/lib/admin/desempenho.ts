import "server-only";
import { pool } from "@/db";
import type { PlanId } from "@/lib/plans";

/*
 * Indicadores de gestão: clientes (papel "usuario"; a equipe fica de fora),
 * atividade, assinaturas e receita. Datas agrupadas no fuso de Brasília.
 * Receita vem do livro de cobranças (tabela pagamentos, alimentada pelo webhook do Asaas).
 */

export const PERIODOS = [7, 30, 90, 365] as const;
export type Periodo = (typeof PERIODOS)[number];
export const periodoValido = (v: unknown): Periodo => (PERIODOS.includes(Number(v) as Periodo) ? (Number(v) as Periodo) : 30);

const HOJE = "(now() at time zone 'America/Sao_Paulo')::date";
const DIA = (coluna: string) => `(${coluna} at time zone 'America/Sao_Paulo')::date`;
const PAGO = "status in ('confirmado', 'recebido')";

/** Quem usou o Causídico: login ou qualquer módulo. */
const ATIVIDADE = `
  select user_id, created_at from registros_acesso where user_id is not null and evento in ('login', 'cadastro')
  union all select user_id, created_at from pricing_proposals
  union all select user_id, created_at from contracts
  union all select user_id, created_at from search_history`;

export async function indicadoresDesempenho(dias: Periodo) {
  const { rows } = await pool.query<{
    clientes: number; novos: number; novosAnterior: number; ativos: number; ativosAnterior: number;
    assinantes: number; pendentes: number; inadimplentes: number; mrrCentavos: number;
    receita: number; receitaLiquida: number; receitaAnterior: number; pagamentos: number; estornos: number;
    cancelamentos: number;
  }>(
    `with p as (select now() - make_interval(days => $1) as ini, now() - make_interval(days => 2 * $1) as ant),
          atividade as (${ATIVIDADE}),
          clientes as (select id, created_at from users where role = 'usuario')
     select
       (select count(*)::int from clientes) as clientes,
       (select count(*)::int from clientes, p where created_at >= p.ini) as novos,
       (select count(*)::int from clientes, p where created_at >= p.ant and created_at < p.ini) as "novosAnterior",
       (select count(distinct a.user_id)::int from atividade a join clientes c on c.id = a.user_id, p where a.created_at >= p.ini) as ativos,
       (select count(distinct a.user_id)::int from atividade a join clientes c on c.id = a.user_id, p
         where a.created_at >= p.ant and a.created_at < p.ini) as "ativosAnterior",
       (select count(*)::int from subscriptions where status = 'ativa' and user_id is not null) as assinantes,
       (select count(*)::int from subscriptions where status = 'pendente') as pendentes,
       (select count(*)::int from subscriptions where status = 'inadimplente') as inadimplentes,
       (select coalesce(sum(case cycle when 'anual' then value_cents / 12.0 else value_cents end), 0)::float8
          from subscriptions where status = 'ativa') as "mrrCentavos",
       (select coalesce(sum(valor_cents), 0)::float8 from pagamentos, p where ${PAGO} and pago_em >= p.ini) as receita,
       (select coalesce(sum(coalesce(valor_liquido_cents, valor_cents)), 0)::float8 from pagamentos, p where ${PAGO} and pago_em >= p.ini) as "receitaLiquida",
       (select coalesce(sum(valor_cents), 0)::float8 from pagamentos, p where ${PAGO} and pago_em >= p.ant and pago_em < p.ini) as "receitaAnterior",
       (select count(*)::int from pagamentos, p where ${PAGO} and pago_em >= p.ini) as pagamentos,
       (select coalesce(sum(valor_cents), 0)::float8 from pagamentos, p where status = 'estornado' and estornado_em >= p.ini) as estornos,
       (select count(*)::int from subscriptions, p where canceled_at >= p.ini) as cancelamentos`,
    [dias],
  );
  return rows[0];
}

/** Série por dia (até 90 dias) ou por mês (período de um ano), com zeros nos intervalos sem dado. */
async function serie(dias: Periodo, origem: string, valor: string) {
  const mensal = dias > 90;
  const passo = mensal ? "1 month" : "1 day";
  const inicio = mensal ? `date_trunc('month', ${HOJE} - 330)::date` : `${HOJE} - ($1::int - 1)`;
  const chave = (col: string) => (mensal ? `date_trunc('month', ${DIA(col)})::date` : DIA(col));
  const { rows } = await pool.query<{ dia: string; valor: number }>(
    `with base as (${origem})
     select to_char(g.d, 'YYYY-MM-DD') as dia, coalesce(sum(${valor}), 0)::float8 as valor
       from generate_series(${inicio}, ${HOJE}, interval '${passo}') as g(d)
       left join base b on ${chave("b.quando")} = g.d::date
      group by g.d order by g.d`,
    mensal ? [] : [dias],
  );
  return { mensal, dados: rows };
}

export const cadastrosPorPeriodo = (dias: Periodo) =>
  serie(dias, "select created_at as quando, 1 as n from users where role = 'usuario'", "b.n");

export async function ativosPorPeriodo(dias: Periodo) {
  const mensal = dias > 90;
  const passo = mensal ? "1 month" : "1 day";
  const inicio = mensal ? `date_trunc('month', ${HOJE} - 330)::date` : `${HOJE} - ($1::int - 1)`;
  const chave = mensal ? `date_trunc('month', ${DIA("a.created_at")})::date` : DIA("a.created_at");
  const { rows } = await pool.query<{ dia: string; valor: number }>(
    `with atividade as (${ATIVIDADE})
     select to_char(g.d, 'YYYY-MM-DD') as dia, count(distinct a.user_id) filter (where u.role = 'usuario')::float8 as valor
       from generate_series(${inicio}, ${HOJE}, interval '${passo}') as g(d)
       left join atividade a on ${chave} = g.d::date
       left join users u on u.id = a.user_id
      group by g.d order by g.d`,
    mensal ? [] : [dias],
  );
  return { mensal, dados: rows };
}

/** Receita recebida (bruta, em reais) por mês, nos últimos 12 meses. */
export async function receitaPorMes() {
  const { rows } = await pool.query<{ dia: string; valor: number }>(
    `select to_char(g.m, 'YYYY-MM-DD') as dia, coalesce(sum(p.valor_cents), 0)::float8 / 100 as valor
       from generate_series(date_trunc('month', ${HOJE} - 335)::date, ${HOJE}, interval '1 month') as g(m)
       left join pagamentos p on p.${PAGO} and date_trunc('month', ${DIA("p.pago_em")})::date = g.m::date
      group by g.m order by g.m`,
  );
  return rows;
}

export async function assinaturasPorPlano() {
  const { rows } = await pool.query<{ plano: PlanId; ciclo: "mensal" | "anual"; ativas: number; mrrCentavos: number }>(
    `select plan as plano, cycle as ciclo, count(*)::int as ativas,
            sum(case cycle when 'anual' then value_cents / 12.0 else value_cents end)::float8 as "mrrCentavos"
       from subscriptions where status = 'ativa' group by plan, cycle order by "mrrCentavos" desc`,
  );
  return rows;
}

/** Uso de cada módulo no período (quantidade de itens criados pelos clientes). */
export async function usoPorModulo(dias: Periodo) {
  const { rows } = await pool.query<{ modulo: string; total: number }>(
    `with p as (select now() - make_interval(days => $1) as ini)
     select 'Propostas de honorários' as modulo, count(*)::int as total from pricing_proposals, p where created_at >= p.ini
     union all select 'Auditorias de contrato', count(*)::int from contracts, p where kind = 'analise' and created_at >= p.ini
     union all select 'Pesquisas com IA', count(*)::int from search_history, p where created_at >= p.ini
     union all select 'Explicações de normas', count(*)::int from ai_usage, p where recurso = 'explicacao' and sucesso and created_at >= p.ini`,
    [dias],
  );
  return rows;
}

/** Clientes que mais usaram o Causídico no período. */
export async function clientesMaisAtivos(dias: Periodo, limite = 10) {
  const { rows } = await pool.query<{
    id: string; email: string; nome: string; plano: PlanId | null; situacao: string | null;
    propostas: number; auditorias: number; pesquisas: number; ultimoAcesso: Date | null;
  }>(
    `with p as (select now() - make_interval(days => $1) as ini)
     select * from (
       select u.id, u.email, u.name as nome, s.plan as plano, s.status as situacao,
              (select count(*)::int from pricing_proposals x, p where x.user_id = u.id and x.created_at >= p.ini) as propostas,
              (select count(*)::int from contracts x, p where x.user_id = u.id and x.kind = 'analise' and x.created_at >= p.ini) as auditorias,
              (select count(*)::int from search_history x, p where x.user_id = u.id and x.created_at >= p.ini) as pesquisas,
              (select max(created_at) from registros_acesso r where r.user_id = u.id and r.evento = 'login') as "ultimoAcesso"
         from users u left join subscriptions s on s.user_id = u.id
        where u.role = 'usuario'
     ) t
     where propostas + auditorias + pesquisas > 0 or "ultimoAcesso" >= (select ini from p)
     order by propostas + auditorias + pesquisas desc, "ultimoAcesso" desc nulls last
     limit $2`,
    [dias, limite],
  );
  return rows;
}

/** Funil dos clientes que se cadastraram no período. */
export async function funil(dias: Periodo) {
  const { rows } = await pool.query<{ cadastros: number; iniciaram: number; pagaram: number; ativos: number }>(
    `with p as (select now() - make_interval(days => $1) as ini),
          c as (select u.id from users u, p where u.role = 'usuario' and u.created_at >= p.ini)
     select (select count(*)::int from c) as cadastros,
            (select count(*)::int from subscriptions s join c on c.id = s.user_id) as iniciaram,
            (select count(*)::int from subscriptions s join c on c.id = s.user_id where s.first_payment_at is not null) as pagaram,
            (select count(*)::int from subscriptions s join c on c.id = s.user_id where s.status = 'ativa') as ativos`,
    [dias],
  );
  return rows[0];
}
