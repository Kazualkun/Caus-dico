import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { pagamentos, subscriptions } from "@/db/schema";
import type { AsaasPayment } from "@/lib/billing/asaas";
import type { Cycle } from "@/lib/plans";

export type AsaasEvento = {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment & { paymentDate?: string | null; confirmedDate?: string | null; netValue?: number | null };
  subscription?: { id: string; status?: string };
};

const PAGAMENTO_CONFIRMADO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PAGAMENTO_PERDIDO = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);
const ASSINATURA_ENCERRADA = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);

/** Fim do período pago: vencimento da cobrança + 1 mês ou 1 ano (fim do dia em Brasília). */
export function fimDoPeriodo(vencimento: string, ciclo: Cycle) {
  const fim = new Date(`${vencimento}T23:59:59-03:00`);
  if (ciclo === "anual") fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  else fim.setUTCMonth(fim.getUTCMonth() + 1);
  return fim;
}

type StatusPagamento = (typeof pagamentos.$inferInsert)["status"];

/** Situação da cobrança pelo evento (ou, em eventos genéricos, pelo campo status da cobrança). */
const STATUS_POR_EVENTO: Record<string, StatusPagamento> = {
  PAYMENT_CREATED: "pendente",
  PAYMENT_CONFIRMED: "confirmado",
  PAYMENT_RECEIVED: "recebido",
  PAYMENT_OVERDUE: "vencido",
  PAYMENT_DELETED: "cancelado",
  PAYMENT_REFUNDED: "estornado",
  PAYMENT_CHARGEBACK_REQUESTED: "contestado",
  PAYMENT_CHARGEBACK_DISPUTE: "contestado",
};
const STATUS_ASAAS: Record<string, StatusPagamento> = {
  PENDING: "pendente",
  AWAITING_RISK_ANALYSIS: "pendente",
  CONFIRMED: "confirmado",
  RECEIVED: "recebido",
  RECEIVED_IN_CASH: "recebido",
  DUNNING_RECEIVED: "recebido",
  OVERDUE: "vencido",
  DUNNING_REQUESTED: "vencido",
  REFUNDED: "estornado",
  REFUND_REQUESTED: "estornado",
  REFUND_IN_PROGRESS: "estornado",
  CHARGEBACK_REQUESTED: "contestado",
  CHARGEBACK_DISPUTE: "contestado",
  AWAITING_CHARGEBACK_REVERSAL: "contestado",
};
// Eventos podem chegar fora de ordem: a situação só avança nesta sequência.
const ORDEM_STATUS = sql`array['pendente','vencido','confirmado','recebido','cancelado','estornado','contestado']::text[]`;
const centavos = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : null);

/** Livro de cobranças: grava ou atualiza a cobrança com a situação mais avançada. */
async function registrarPagamento(db: Db, assinatura: { id: string; userId: string | null }, evento: AsaasEvento) {
  const p = evento.payment!;
  const status = STATUS_POR_EVENTO[evento.event] ?? STATUS_ASAAS[p.status] ?? "pendente";
  const dataPagamento = p.confirmedDate ?? p.paymentDate;
  const pago = status === "confirmado" || status === "recebido";
  const pagoEm = pago ? (dataPagamento ? new Date(`${dataPagamento}T12:00:00-03:00`) : new Date()) : null;
  await db
    .insert(pagamentos)
    .values({
      id: p.id,
      assinaturaId: assinatura.id,
      userId: assinatura.userId,
      status,
      forma: p.billingType,
      valorCents: centavos(p.value) ?? 0,
      valorLiquidoCents: centavos(p.netValue),
      vencimento: p.dueDate,
      pagoEm,
      estornadoEm: status === "estornado" ? new Date() : null,
      faturaUrl: p.invoiceUrl,
    })
    .onConflictDoUpdate({
      target: pagamentos.id,
      set: {
        status: sql`case when array_position(${ORDEM_STATUS}, excluded.status) >= array_position(${ORDEM_STATUS}, ${pagamentos.status})
                         then excluded.status else ${pagamentos.status} end`,
        forma: sql`excluded.forma`,
        valorCents: sql`excluded.valor_cents`,
        valorLiquidoCents: sql`coalesce(excluded.valor_liquido_cents, ${pagamentos.valorLiquidoCents})`,
        vencimento: sql`excluded.vencimento`,
        pagoEm: sql`coalesce(${pagamentos.pagoEm}, excluded.pago_em)`,
        estornadoEm: sql`coalesce(${pagamentos.estornadoEm}, excluded.estornado_em)`,
        faturaUrl: sql`coalesce(excluded.fatura_url, ${pagamentos.faturaUrl})`,
        atualizadoEm: sql`now()`,
      },
    });
}

/** Aplica um evento do Asaas na tabela subscriptions. Eventos irrelevantes são ignorados. */
export async function aplicarEvento(db: Db, evento: AsaasEvento) {
  if (evento.payment) {
    const assinaturaId = evento.payment.subscription;
    if (!assinaturaId) return "cobrança avulsa ignorada";

    const [assinatura] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, assinaturaId))
      .limit(1);
    if (!assinatura) return "assinatura desconhecida ignorada";
    await registrarPagamento(db, assinatura, evento);

    if (PAGAMENTO_CONFIRMADO.has(evento.event)) {
      // Eventos podem chegar fora de ordem: o período pago nunca encolhe.
      const novoFim = fimDoPeriodo(evento.payment.dueDate, assinatura.cycle);
      const fim = assinatura.currentPeriodEnd && assinatura.currentPeriodEnd > novoFim ? assinatura.currentPeriodEnd : novoFim;
      const pagoEm = new Date();
      await db
        .update(subscriptions)
        .set({
          status: assinatura.status === "cancelada" ? "cancelada" : "ativa",
          currentPeriodEnd: fim,
          lastPaymentId: evento.payment.id,
          billingType: evento.payment.billingType,
          // Datas usadas no prazo de arrependimento (7 dias da contratação ou da renovação anual).
          firstPaymentAt: assinatura.firstPaymentAt ?? pagoEm,
          lastPaymentAt: assinatura.lastPaymentId === evento.payment.id ? assinatura.lastPaymentAt : pagoEm,
        })
        .where(eq(subscriptions.id, assinatura.id));
      return "acesso liberado";
    }

    if (PAGAMENTO_PERDIDO.has(evento.event) && assinatura.status !== "cancelada") {
      // Atraso de uma cobrança antiga não derruba quem já pagou a mais recente.
      if (evento.event === "PAYMENT_OVERDUE" && assinatura.lastPaymentId && assinatura.lastPaymentId !== evento.payment.id) {
        if (assinatura.currentPeriodEnd && assinatura.currentPeriodEnd > new Date()) return "atraso de cobrança antiga ignorado";
      }
      await db.update(subscriptions).set({ status: "inadimplente" }).where(eq(subscriptions.id, assinatura.id));
      return "acesso suspenso";
    }

    return "evento de cobrança sem efeito";
  }

  if (evento.subscription && ASSINATURA_ENCERRADA.has(evento.event)) {
    await db
      .update(subscriptions)
      .set({ status: "cancelada", canceledAt: new Date() })
      .where(and(eq(subscriptions.providerSubscriptionId, evento.subscription.id), ne(subscriptions.status, "cancelada")));
    return "assinatura encerrada";
  }

  return "evento ignorado";
}
