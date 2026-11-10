import "server-only";
import { pool } from "@/db";

/** Executa as consultas e mede quanto levaram, em ms (o relógio fica fora da renderização). */
export async function medirLatencia<T>(consultas: () => Promise<T>): Promise<[T, number]> {
  const inicio = performance.now();
  const resultado = await consultas();
  return [resultado, Math.round(performance.now() - inicio)];
}

/** Indicadores da visão geral da administração. */
export async function indicadoresGerais() {
  const { rows } = await pool.query<{
    usuarios: number;
    novos7d: number;
    ativas: number;
    pendentes: number;
    inadimplentes: number;
    mrrCentavos: number;
    tarefasOk24h: number;
    tarefasErro24h: number;
    tarefasAndamento: number;
    minutosIa30d: number;
    webhooksErro24h: number;
    lgpdAbertas: number;
    lgpdVencendo: number;
  }>(`
    select
      (select count(*)::int from users) as usuarios,
      (select count(*)::int from users where created_at > now() - interval '7 days') as "novos7d",
      (select count(*)::int from subscriptions where status = 'ativa') as ativas,
      (select count(*)::int from subscriptions where status = 'pendente') as pendentes,
      (select count(*)::int from subscriptions where status = 'inadimplente') as inadimplentes,
      (select coalesce(sum(case cycle when 'anual' then value_cents / 12.0 else value_cents end), 0)::int
         from subscriptions where status = 'ativa') as "mrrCentavos",
      (select count(*)::int from (
          select status, updated_at from contracts union all select status, updated_at from search_history) t
        where status = 'concluido' and updated_at > now() - interval '1 day') as "tarefasOk24h",
      (select count(*)::int from (
          select status, updated_at from contracts union all select status, updated_at from search_history) t
        where status = 'erro' and updated_at > now() - interval '1 day') as "tarefasErro24h",
      (select count(*)::int from (
          select status from contracts union all select status from search_history) t
        where status = 'processando') as "tarefasAndamento",
      (select coalesce(sum(duracao_ms), 0) / 60000.0 from ai_usage where created_at > now() - interval '30 days')::float as "minutosIa30d",
      (select count(*)::int from billing_events where error is not null and received_at > now() - interval '1 day') as "webhooksErro24h",
      (select count(*)::int from lgpd_solicitacoes where status in ('aberta', 'em_andamento')) as "lgpdAbertas",
      (select count(*)::int from lgpd_solicitacoes
        where status in ('aberta', 'em_andamento') and prazo_em < now() + interval '3 days') as "lgpdVencendo"
  `);
  return rows[0];
}

/**
 * Minutos de processamento da IA local por dia, nos últimos N dias (dias sem uso
 * aparecem com zero). Com o modelo rodando no próprio servidor, o consumo é tempo
 * de GPU, não tokens cobrados por um provedor.
 */
export async function tempoDiarioIa(dias = 30) {
  const { rows } = await pool.query<{ dia: string; valor: number }>(
    `select to_char(d.dia, 'YYYY-MM-DD') as dia, (coalesce(sum(u.duracao_ms), 0) / 60000.0)::float as valor
       from generate_series((now() at time zone 'America/Sao_Paulo')::date - ($1::int - 1), (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') as d(dia)
       left join ai_usage u on (u.created_at at time zone 'America/Sao_Paulo')::date = d.dia
      group by d.dia order by d.dia`,
    [dias],
  );
  return rows;
}

/** Uso de IA por recurso e modelo, nos últimos 30 dias. */
export async function usoIaPorRecurso() {
  const { rows } = await pool.query<{
    recurso: string;
    modelo: string;
    chamadas: number;
    erros: number;
    entrada: number;
    saida: number;
    duracaoMedia: number;
    minutos: number;
  }>(`
    select recurso, modelo, count(*)::int as chamadas, count(*) filter (where not sucesso)::int as erros,
           sum(input_tokens)::int as entrada, sum(output_tokens)::int as saida,
           round(avg(duracao_ms))::int as "duracaoMedia", (sum(duracao_ms) / 60000.0)::float as minutos
      from ai_usage where created_at > now() - interval '30 days'
     group by recurso, modelo order by minutos desc
  `);
  return rows;
}
