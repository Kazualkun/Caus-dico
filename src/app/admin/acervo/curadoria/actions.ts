"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requirePapel } from "@/lib/auth";
import {
  aprovarRevisao,
  cancelarRevisao,
  conferirNorma,
  dispensarAlertaOrigem,
  lerFormularioNorma,
  proporEdicao,
  proporInclusao,
  rejeitarRevisao,
  registrarVerificacaoIntegridade,
} from "@/lib/acervo/curadoria";
import { registrarAuditoria } from "@/lib/registros";
import type { ActionState } from "@/lib/types";

// Curadoria: administradores e desenvolvedores. Cada passo fica na trilha de auditoria.

export async function proporInclusaoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const f = lerFormularioNorma(formData);
  if (!f.ok) return { error: f.erro };
  const r = await proporInclusao(ator, f);
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({ ator, acao: "acervo.inclusao_proposta", alvoTipo: "revisao", alvoId: r.id, detalhes: { titulo: f.dados.titulo } });
  revalidatePath("/admin/acervo/curadoria");
  redirect(`/admin/acervo/revisoes/${r.id}`);
}

export async function proporEdicaoAction(normaId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const f = lerFormularioNorma(formData);
  if (!f.ok) return { error: f.erro };
  const r = await proporEdicao(ator, normaId, f);
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({ ator, acao: "acervo.edicao_proposta", alvoTipo: "norma", alvoId: String(normaId), detalhes: { revisao: r.id } });
  revalidatePath("/admin/acervo/curadoria");
  redirect(`/admin/acervo/revisoes/${r.id}`);
}

export async function conferirNormaAction(normaId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const fonte = String(formData.get("fonte") ?? "").trim();
  const justificativa = String(formData.get("justificativa") ?? "").trim().slice(0, 2000);
  const r = await conferirNorma(ator, normaId, fonte, justificativa);
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({
    ator,
    acao: r.automatica ? "acervo.conferida_automaticamente" : "acervo.conferencia_proposta",
    alvoTipo: "norma",
    alvoId: String(normaId),
    detalhes: { revisao: r.id, fonte },
  });
  revalidateTag("acervo", "max");
  revalidatePath(`/admin/acervo/normas/${normaId}`);
  revalidatePath("/admin/acervo/curadoria");
  if (!r.automatica) redirect(`/admin/acervo/revisoes/${r.id}`);
  return { ok: true, mensagem: "Todos os artigos batem com a fonte oficial. A conferência foi registrada." };
}

export async function aprovarRevisaoAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const r = await aprovarRevisao(ator, id, {
    conferiu: formData.get("conferiu") === "on",
    parecer: String(formData.get("parecer") ?? "").trim().slice(0, 4000),
  });
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({ ator, acao: "acervo.revisao_aprovada", alvoTipo: "revisao", alvoId: id, detalhes: { norma: r.normaId } });
  revalidateTag("acervo", "max");
  revalidatePath("/admin/acervo/curadoria");
  revalidatePath(`/admin/acervo/revisoes/${id}`);
  return { ok: true, mensagem: "Aprovada e publicada no acervo." };
}

export async function rejeitarRevisaoAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 4000);
  const r = await rejeitarRevisao(ator, id, motivo);
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({ ator, acao: "acervo.revisao_rejeitada", alvoTipo: "revisao", alvoId: id });
  revalidatePath("/admin/acervo/curadoria");
  revalidatePath(`/admin/acervo/revisoes/${id}`);
  return { ok: true, mensagem: "Revisão rejeitada. O autor vê o motivo nesta página." };
}

export async function cancelarRevisaoAction(id: string): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const r = await cancelarRevisao(ator, id);
  if (!r.ok) return { error: r.erro };
  await registrarAuditoria({ ator, acao: "acervo.revisao_cancelada", alvoTipo: "revisao", alvoId: id });
  revalidatePath("/admin/acervo/curadoria");
  revalidatePath(`/admin/acervo/revisoes/${id}`);
  return { ok: true, mensagem: "Revisão cancelada." };
}

export async function verificarIntegridadeAction(): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const violadas = await registrarVerificacaoIntegridade();
  await registrarAuditoria({ ator, acao: "acervo.integridade_verificada", detalhes: { violadas: violadas.length } });
  revalidatePath("/admin/acervo/curadoria");
  return violadas.length
    ? { error: `${violadas.length} norma(s) conferida(s) com o texto alterado fora da curadoria. Veja a lista.` }
    : { ok: true, mensagem: "Todos os textos conferidos estão íntegros." };
}

export async function dispensarAlertaAction(normaId: number): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  await dispensarAlertaOrigem(normaId);
  await registrarAuditoria({ ator, acao: "acervo.alerta_origem_dispensado", alvoTipo: "norma", alvoId: String(normaId) });
  revalidatePath("/admin/acervo/curadoria");
  return { ok: true, mensagem: "Alerta dispensado: a versão curada continua publicada." };
}
