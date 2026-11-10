"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lgpdSolicitacoes, users } from "@/db/schema";
import { requireViewer } from "@/lib/auth";
import { cancelSubscription } from "@/lib/billing/asaas";
import { registrarAuditoria } from "@/lib/registros";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

/** Correção de dados (LGPD, art. 18, III). */
export async function atualizarPerfil(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const nome = String(formData.get("nome") ?? "").trim();
  const oabNumber = String(formData.get("oabNumber") ?? "").trim();
  const oabUf = String(formData.get("oabUf") ?? "").toUpperCase();
  const officeName = String(formData.get("officeName") ?? "").trim();

  if (nome.length < 3) return { error: "Informe o nome completo." };
  if (oabUf && !UFS.includes(oabUf as (typeof UFS)[number])) return { error: "UF da OAB inválida." };

  await db
    .update(users)
    .set({ name: nome.slice(0, 200), oabNumber: oabNumber.slice(0, 20) || null, oabUf: oabUf || null, officeName: officeName.slice(0, 200) || null })
    .where(eq(users.id, viewer.id));
  revalidatePath("/painel/conta");
  return { ok: true, mensagem: "Dados atualizados." };
}

/**
 * Exclusão da conta (LGPD, art. 18, VI). Apaga perfil, sessões, contratos,
 * propostas e pesquisas. Ficam, sem vínculo com o perfil, o histórico de
 * cobrança (obrigação fiscal) e os registros de acesso por 6 meses (Marco
 * Civil, art. 15) — hipóteses do art. 16, I, da LGPD.
 */
export async function excluirConta(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  if (String(formData.get("confirmacao") ?? "").trim().toLowerCase() !== viewer.email.toLowerCase()) {
    return { error: "Digite o e-mail da conta para confirmar a exclusão." };
  }

  const assinatura = viewer.subscription;
  if (assinatura?.providerSubscriptionId && assinatura.status !== "cancelada") {
    try {
      await cancelSubscription(assinatura.providerSubscriptionId);
    } catch (e) {
      console.error("[exclusão] falha ao cancelar no Asaas", viewer.id, e);
      return { error: "Não foi possível cancelar a assinatura no Asaas agora. Tente novamente em instantes." };
    }
  }

  await db.insert(lgpdSolicitacoes).values({
    userId: viewer.id,
    nome: viewer.fullName ?? "",
    email: viewer.email,
    tipo: "exclusao",
    descricao: "Exclusão da conta feita pelo próprio titular em Minha conta.",
    status: "concluida",
    resposta: "Conta e conteúdos excluídos automaticamente.",
    prazoEm: new Date(),
    respondidaEm: new Date(),
  });
  await registrarAuditoria({ ator: { id: viewer.id, email: viewer.email }, acao: "conta.excluida_pelo_titular", alvoTipo: "usuario", alvoId: viewer.id });
  // Sessões, contratos, propostas, pesquisas e aceites caem em cascata.
  await db.delete(users).where(eq(users.id, viewer.id));

  redirect("/?conta=excluida");
}
