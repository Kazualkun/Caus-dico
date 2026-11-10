"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clientes, contracts, pricingProposals, triagemLinks, triagens } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { clienteDoUsuario, garantirLinkTriagem, novoCodigo, ORIGENS_CLIENTE, SITUACOES_PROPOSTA, STATUS_CLIENTE } from "@/lib/crm";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const texto = (formData: FormData, campo: string, max = 200) => String(formData.get(campo) ?? "").trim().slice(0, max) || null;

function dadosDoCliente(formData: FormData) {
  const uf = String(formData.get("uf") ?? "").toUpperCase();
  const status = String(formData.get("status") ?? "lead");
  const origem = String(formData.get("origem") ?? "outro");
  return {
    nome: String(formData.get("nome") ?? "").trim().slice(0, 200),
    email: texto(formData, "email")?.toLowerCase() ?? null,
    telefone: texto(formData, "telefone", 40),
    documento: texto(formData, "documento", 30),
    cidade: texto(formData, "cidade", 100),
    uf: UFS.includes(uf as (typeof UFS)[number]) ? uf : null,
    status: (status in STATUS_CLIENTE ? status : "lead") as keyof typeof STATUS_CLIENTE,
    origem: (origem in ORIGENS_CLIENTE ? origem : "outro") as keyof typeof ORIGENS_CLIENTE,
    indicadoPor: texto(formData, "indicadoPor"),
    observacoes: texto(formData, "observacoes", 4000),
  };
}

function validar(d: ReturnType<typeof dadosDoCliente>) {
  if (d.nome.length < 2) return "Informe o nome do cliente.";
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "O e-mail não parece válido.";
  return null;
}

export async function criarCliente(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const d = dadosDoCliente(formData);
  const erro = validar(d);
  if (erro) return { error: erro };
  const [c] = await db.insert(clientes).values({ userId: viewer.id, ...d }).returning({ id: clientes.id });
  redirect(`/painel/clientes/${c.id}`);
}

export async function atualizarCliente(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const d = dadosDoCliente(formData);
  const erro = validar(d);
  if (erro) return { error: erro };
  await db.update(clientes).set(d).where(and(eq(clientes.id, id), eq(clientes.userId, viewer.id)));
  revalidatePath(`/painel/clientes/${id}`);
  return { ok: true, mensagem: "Dados salvos." };
}

export async function excluirCliente(id: string) {
  const viewer = await requireSubscriber();
  // Propostas, auditorias e processos ficam, sem o vínculo; triagens do cliente são apagadas junto.
  await db.delete(clientes).where(and(eq(clientes.id, id), eq(clientes.userId, viewer.id)));
  redirect("/painel/clientes");
}

export async function alterarSituacaoProposta(propostaId: string, situacao: string) {
  const viewer = await requireSubscriber();
  if (!(situacao in SITUACOES_PROPOSTA)) return;
  const [p] = await db
    .update(pricingProposals)
    .set({ situacao: situacao as keyof typeof SITUACOES_PROPOSTA, situacaoEm: new Date() })
    .where(and(eq(pricingProposals.id, propostaId), eq(pricingProposals.userId, viewer.id)))
    .returning({ clienteId: pricingProposals.clienteId });
  // Proposta aceita: o lead ou a negociação vira cliente.
  if (p?.clienteId && situacao === "aceita") {
    await db
      .update(clientes)
      .set({ status: "cliente" })
      .where(and(eq(clientes.id, p.clienteId), eq(clientes.userId, viewer.id), inArray(clientes.status, ["lead", "negociacao"])));
  }
  revalidatePath(`/painel/honorarios/${propostaId}`);
  if (p?.clienteId) revalidatePath(`/painel/clientes/${p.clienteId}`);
}

export async function vincularProposta(propostaId: string, clienteId: string) {
  const viewer = await requireSubscriber();
  const valido = clienteId ? await clienteDoUsuario(viewer.id, clienteId) : null;
  await db
    .update(pricingProposals)
    .set({ clienteId: valido })
    .where(and(eq(pricingProposals.id, propostaId), eq(pricingProposals.userId, viewer.id)));
  revalidatePath(`/painel/honorarios/${propostaId}`);
}

export async function vincularAuditoria(contratoId: string, clienteId: string) {
  const viewer = await requireSubscriber();
  const valido = clienteId ? await clienteDoUsuario(viewer.id, clienteId) : null;
  await db.update(contracts).set({ clienteId: valido }).where(and(eq(contracts.id, contratoId), eq(contracts.userId, viewer.id)));
  revalidatePath(`/painel/contratos/${contratoId}`);
}

export async function marcarTriagemVista(id: string) {
  const viewer = await requireSubscriber();
  await db.update(triagens).set({ vistaEm: new Date() }).where(and(eq(triagens.id, id), eq(triagens.userId, viewer.id)));
  revalidatePath("/painel/clientes");
}

export async function excluirTriagem(id: string, clienteId: string | null) {
  const viewer = await requireSubscriber();
  await db.delete(triagens).where(and(eq(triagens.id, id), eq(triagens.userId, viewer.id)));
  revalidatePath("/painel/clientes");
  if (clienteId) revalidatePath(`/painel/clientes/${clienteId}`);
}

/** Troca o código do link: o link antigo deixa de funcionar na hora. */
export async function gerarNovoLinkTriagem() {
  const viewer = await requireSubscriber();
  await garantirLinkTriagem(viewer.id);
  await db.update(triagemLinks).set({ codigo: novoCodigo(), ativo: true }).where(eq(triagemLinks.userId, viewer.id));
  revalidatePath("/painel/clientes");
}

export async function alternarLinkTriagem(ativo: boolean) {
  const viewer = await requireSubscriber();
  await garantirLinkTriagem(viewer.id);
  await db.update(triagemLinks).set({ ativo }).where(eq(triagemLinks.userId, viewer.id));
  revalidatePath("/painel/clientes");
}
