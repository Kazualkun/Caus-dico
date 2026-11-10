"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { hasActiveAccess, requireViewer } from "@/lib/auth";
import {
  AsaasError,
  cancelSubscription,
  createCustomer,
  createSubscription,
  hojeEmBrasilia,
  listSubscriptionPayments,
  refundPayment,
  type AsaasBillingType,
} from "@/lib/billing/asaas";
import { prazoDeArrependimento } from "@/lib/billing/arrependimento";
import { excedeuLimite, MENSAGEM_LIMITE } from "@/lib/limite-taxa";
import { registrarAuditoria } from "@/lib/registros";
import { PLANS, isCycle, isPlanId, planPriceCents } from "@/lib/plans";
import { isValidCpfCnpj, normalizeCpfCnpj, onlyDigits } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const FORMAS_DE_PAGAMENTO: AsaasBillingType[] = ["PIX", "CREDIT_CARD", "BOLETO"];

/**
 * Cria (ou reaproveita) o cliente no Asaas, abre a assinatura com a primeira
 * cobrança vencendo hoje e manda o usuário para a tela de pagamento. O acesso
 * é liberado pelo webhook quando o Asaas confirma o pagamento.
 */
export async function iniciarCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();

  const plano = formData.get("plano");
  const ciclo = formData.get("ciclo");
  const formaPagamento = formData.get("billingType") as AsaasBillingType;
  const nome = String(formData.get("nome") ?? "").trim();
  const documento = normalizeCpfCnpj(String(formData.get("cpfCnpj") ?? ""));
  const celular = onlyDigits(String(formData.get("celular") ?? ""));

  if (!isPlanId(plano) || !isCycle(ciclo)) return { error: "Plano inválido. Volte e escolha um plano." };
  if (!FORMAS_DE_PAGAMENTO.includes(formaPagamento)) return { error: "Escolha a forma de pagamento." };
  if (nome.length < 3) return { error: "Informe o nome completo ou a razão social." };
  if (!isValidCpfCnpj(documento)) return { error: "CPF ou CNPJ inválido. Confira os números." };
  if (celular && celular.length < 10) return { error: "Celular inválido. Use DDD + número." };
  if (formData.get("ciente") !== "on") return { error: "Confirme que leu as condições de renovação e cancelamento." };
  if (viewer.subscription && hasActiveAccess(viewer.subscription)) {
    return { error: "Sua assinatura já está ativa. Para mudar de plano, cancele a atual em Minha conta." };
  }
  // Cada tentativa cria cliente e assinatura no Asaas.
  if (await excedeuLimite([{ chave: `checkout:usuario:${viewer.id}`, max: 10, janelaSegundos: 60 * 60 }])) {
    return { error: MENSAGEM_LIMITE };
  }

  const valorCents = planPriceCents(plano, ciclo);

  try {
    let clienteId = viewer.subscription?.providerCustomerId ?? null;
    if (!clienteId) {
      const cliente = await createCustomer({
        name: nome,
        cpfCnpj: documento,
        email: viewer.email,
        mobilePhone: celular || undefined,
        externalReference: viewer.id,
      });
      clienteId = cliente.id;
    }

    // Uma tentativa anterior que não foi paga é encerrada para não gerar cobrança duplicada.
    const anterior = viewer.subscription?.providerSubscriptionId;
    if (anterior) await cancelSubscription(anterior).catch(() => undefined);

    const assinatura = await createSubscription({
      customer: clienteId,
      billingType: formaPagamento,
      value: valorCents / 100,
      nextDueDate: hojeEmBrasilia(),
      cycle: ciclo === "anual" ? "YEARLY" : "MONTHLY",
      description: `Causídico — plano ${PLANS[plano].nome} (${ciclo})`,
      externalReference: viewer.id,
    });
    const [primeiraCobranca] = await listSubscriptionPayments(assinatura.id);

    await db.update(users).set({ name: viewer.fullName ?? nome, cpfCnpj: documento, phone: celular || null }).where(eq(users.id, viewer.id));

    const dados = {
      plan: plano,
      cycle: ciclo,
      status: "pendente" as const,
      provider: "asaas",
      providerCustomerId: clienteId,
      providerSubscriptionId: assinatura.id,
      billingType: formaPagamento,
      valueCents: valorCents,
      currentPeriodEnd: null,
      firstPaymentAt: null,
      lastPaymentAt: null,
      lastPaymentId: primeiraCobranca?.id ?? null,
      lastInvoiceUrl: primeiraCobranca?.invoiceUrl ?? null,
      canceledAt: null,
      refundedAt: null,
    };
    await db
      .insert(subscriptions)
      .values({ userId: viewer.id, ...dados })
      .onConflictDoUpdate({ target: subscriptions.userId, set: dados });
  } catch (e) {
    console.error("[checkout]", viewer.id, e);
    if (e instanceof AsaasError && e.status === 400) return { error: `O Asaas recusou os dados: ${e.message}` };
    return { error: "Não foi possível iniciar o pagamento agora. Tente novamente em instantes." };
  }

  redirect("/assinatura/aguardando");
}

/**
 * Cancela a renovação. Dentro do prazo de arrependimento, estorna o pagamento
 * e encerra o acesso na hora; fora dele, o acesso continua até o fim do período pago.
 */
export async function cancelarAssinatura(): Promise<ActionState> {
  const viewer = await requireViewer();
  const assinatura = viewer.subscription;
  if (!assinatura || assinatura.status === "cancelada") return { error: "Não há assinatura ativa para cancelar." };

  const reembolsar = Boolean(prazoDeArrependimento(assinatura));
  try {
    if (reembolsar && assinatura.lastPaymentId) await refundPayment(assinatura.lastPaymentId);
    if (assinatura.providerSubscriptionId) await cancelSubscription(assinatura.providerSubscriptionId);
  } catch (e) {
    console.error("[cancelamento]", viewer.id, e);
    return { error: "Não foi possível concluir o cancelamento no Asaas agora. Tente novamente em instantes ou fale com o atendimento." };
  }

  const agora = new Date();
  await db
    .update(subscriptions)
    .set({
      status: "cancelada",
      canceledAt: agora,
      ...(reembolsar ? { refundedAt: agora, currentPeriodEnd: agora } : {}),
    })
    .where(eq(subscriptions.id, assinatura.id));
  await registrarAuditoria({
    ator: { id: viewer.id, email: viewer.email },
    acao: reembolsar ? "assinatura.cancelada_com_reembolso" : "assinatura.cancelada",
    alvoTipo: "assinatura",
    alvoId: assinatura.id,
  });

  revalidatePath("/painel/conta");
  return {
    ok: true,
    mensagem: reembolsar
      ? "Assinatura cancelada. O valor pago será estornado pela mesma forma de pagamento."
      : "Renovação cancelada. Seu acesso continua até o fim do período pago.",
  };
}
