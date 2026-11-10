import type { SubscriptionRow } from "@/lib/types";

export const PRAZO_ARREPENDIMENTO_DIAS = 7;

/**
 * Direito de arrependimento (CDC, art. 49): reembolso integral se o cancelamento
 * ocorrer em até 7 dias do pagamento da contratação ou da renovação anual.
 * Renovações mensais não reabrem o prazo.
 */
export function prazoDeArrependimento(sub: SubscriptionRow | null, agora = new Date()) {
  if (!sub?.lastPaymentAt || !sub.lastPaymentId || sub.refundedAt || sub.status === "cancelada") return null;
  const primeiroPagamento = sub.firstPaymentAt?.getTime() === sub.lastPaymentAt.getTime();
  if (!primeiroPagamento && sub.cycle !== "anual") return null;
  const fim = new Date(sub.lastPaymentAt.getTime() + PRAZO_ARREPENDIMENTO_DIAS * 24 * 60 * 60 * 1000);
  return fim > agora ? fim : null;
}
