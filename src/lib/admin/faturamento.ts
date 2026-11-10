import "server-only";
import { pool } from "@/db";
import type { PlanId } from "@/lib/plans";

/*
 * Faturamento a partir do livro de cobranças (pagamentos). O mês é o de
 * Brasília: recebido pela data do pagamento, estornado pela data do estorno e
 * a receber pelo vencimento.
 */

/** "2026-10" válido, ou o mês atual em Brasília. */
export function mesValido(v: unknown, hoje: string) {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v >= "2020-01" && v <= hoje.slice(0, 7) ? v : hoje.slice(0, 7);
}

export async function hojeEmBrasilia() {
  const { rows } = await pool.query<{ hoje: string }>("select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as hoje");
  return rows[0].hoje;
}

const NO_MES = (coluna: string) => `to_char(${coluna} at time zone 'America/Sao_Paulo', 'YYYY-MM') = $1`;

export async function resumoDoMes(mes: string) {
  const { rows } = await pool.query<{
    bruto: number; liquido: number; qtd: number; estornado: number; qtdEstornos: number;
    aReceber: number; qtdAReceber: number; vencido: number; qtdVencidas: number;
  }>(
    `select
       coalesce(sum(valor_cents) filter (where status in ('confirmado','recebido') and ${NO_MES("pago_em")}), 0)::float8 as bruto,
       coalesce(sum(coalesce(valor_liquido_cents, valor_cents)) filter (where status in ('confirmado','recebido') and ${NO_MES("pago_em")}), 0)::float8 as liquido,
       count(*) filter (where status in ('confirmado','recebido') and ${NO_MES("pago_em")})::int as qtd,
       coalesce(sum(valor_cents) filter (where status = 'estornado' and ${NO_MES("estornado_em")}), 0)::float8 as estornado,
       count(*) filter (where status = 'estornado' and ${NO_MES("estornado_em")})::int as "qtdEstornos",
       coalesce(sum(valor_cents) filter (where status = 'pendente' and to_char(vencimento, 'YYYY-MM') = $1), 0)::float8 as "aReceber",
       count(*) filter (where status = 'pendente' and to_char(vencimento, 'YYYY-MM') = $1)::int as "qtdAReceber",
       coalesce(sum(valor_cents) filter (where status = 'vencido' and to_char(vencimento, 'YYYY-MM') = $1), 0)::float8 as vencido,
       count(*) filter (where status = 'vencido' and to_char(vencimento, 'YYYY-MM') = $1)::int as "qtdVencidas"
     from pagamentos`,
    [mes],
  );
  return rows[0];
}

export async function porFormaDePagamento(mes: string) {
  const { rows } = await pool.query<{ forma: string; qtd: number; bruto: number; liquido: number }>(
    `select coalesce(forma, 'UNDEFINED') as forma, count(*)::int as qtd, sum(valor_cents)::float8 as bruto,
            sum(coalesce(valor_liquido_cents, valor_cents))::float8 as liquido
       from pagamentos where status in ('confirmado','recebido') and ${NO_MES("pago_em")}
      group by 1 order by bruto desc`,
    [mes],
  );
  return rows;
}

export type LinhaPagamento = {
  id: string; status: string; forma: string | null; valorCents: number; valorLiquidoCents: number | null;
  vencimento: string | null; pagoEm: Date | null; estornadoEm: Date | null; faturaUrl: string | null;
  userId: string | null; email: string | null; plano: PlanId | null; ciclo: string | null;
};

/** Cobranças que tocaram o mês: pagas, estornadas ou com vencimento nele. */
export async function pagamentosDoMes(mes: string): Promise<LinhaPagamento[]> {
  const { rows } = await pool.query<LinhaPagamento>(
    `select p.id, p.status, p.forma, p.valor_cents as "valorCents", p.valor_liquido_cents as "valorLiquidoCents",
            to_char(p.vencimento, 'YYYY-MM-DD') as vencimento, p.pago_em as "pagoEm", p.estornado_em as "estornadoEm",
            p.fatura_url as "faturaUrl", p.user_id as "userId", u.email, s.plan as plano, s.cycle as ciclo
       from pagamentos p
       left join users u on u.id = p.user_id
       left join subscriptions s on s.id = p.assinatura_id
      where ${NO_MES("p.pago_em")} or ${NO_MES("p.estornado_em")} or to_char(p.vencimento, 'YYYY-MM') = $1
      order by coalesce(p.pago_em, p.estornado_em, p.vencimento::timestamptz) desc
      limit 2000`,
    [mes],
  );
  return rows;
}

/** Últimos 12 meses, para a tabela de evolução. */
export async function evolucaoMensal() {
  const { rows } = await pool.query<{ mes: string; bruto: number; liquido: number; estornado: number; qtd: number }>(
    `select to_char(g.m, 'YYYY-MM') as mes,
            coalesce((select sum(valor_cents) from pagamentos where status in ('confirmado','recebido')
                       and date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = g.m), 0)::float8 as bruto,
            coalesce((select sum(coalesce(valor_liquido_cents, valor_cents)) from pagamentos where status in ('confirmado','recebido')
                       and date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = g.m), 0)::float8 as liquido,
            coalesce((select sum(valor_cents) from pagamentos where status = 'estornado'
                       and date_trunc('month', estornado_em at time zone 'America/Sao_Paulo') = g.m), 0)::float8 as estornado,
            (select count(*)::int from pagamentos where status in ('confirmado','recebido')
              and date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = g.m) as qtd
       from generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '11 months',
                            date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') as g(m)
      order by g.m desc`,
  );
  return rows;
}

/**
 * Conferência: divergências entre assinaturas e cobranças.
 * - ativas sem pagamento registrado no ciclo atual (mensal: 35 dias; anual: 370 dias);
 * - pagamentos recebidos de assinaturas canceladas sem estorno (pode ser devido reembolso).
 */
export async function divergencias() {
  const [semPagamento, pagosCancelados] = await Promise.all([
    pool.query<{ id: string; userId: string | null; email: string | null; plano: PlanId; ciclo: string; provider: string; desde: Date }>(
      `select s.id, s.user_id as "userId", u.email, s.plan as plano, s.cycle as ciclo, s.provider, s.created_at as desde
         from subscriptions s left join users u on u.id = s.user_id
        where s.status = 'ativa'
          and not exists (select 1 from pagamentos p where p.assinatura_id = s.id and p.status in ('confirmado','recebido')
                            and p.pago_em > now() - case s.cycle when 'anual' then interval '370 days' else interval '35 days' end)
        order by s.created_at`,
    ),
    pool.query<{ id: string; email: string | null; valorCents: number; pagoEm: Date; canceladaEm: Date }>(
      `select p.id, u.email, p.valor_cents as "valorCents", p.pago_em as "pagoEm", s.canceled_at as "canceladaEm"
         from pagamentos p join subscriptions s on s.id = p.assinatura_id left join users u on u.id = p.user_id
        where s.status = 'cancelada' and s.refunded_at is not null and p.status in ('confirmado','recebido')
          and p.id = s.last_payment_id
        order by p.pago_em desc limit 50`,
    ),
  ]);
  return { semPagamento: semPagamento.rows, reembolsoPendente: pagosCancelados.rows };
}

export const FORMAS: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto", UNDEFINED: "Não informada" };
