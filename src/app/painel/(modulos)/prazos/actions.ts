"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diasSemExpediente, prazos, processos } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { clienteDoUsuario } from "@/lib/crm";
import { calcularPrazo, dataValida, DIAS_USUAIS, MAXIMO_DIAS, type ParametrosPrazo } from "@/lib/prazos/calculo";
import type { ActionState } from "@/lib/types";

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

const ParametrosSchema = z.object({
  ramo: z.enum(["civel", "trabalhista", "penal"]),
  forma: z.enum(["dje", "intimacao"]),
  data: z.string().refine(dataValida, "Data inválida."),
  dias: z.number().int().min(1).max(MAXIMO_DIAS),
  emDobro: z.boolean(),
  semSuspensaoFimDeAno: z.boolean(),
  diasUsuais: z.array(z.enum(Object.keys(DIAS_USUAIS) as [keyof typeof DIAS_USUAIS, ...(keyof typeof DIAS_USUAIS)[]])),
});

/** Dias sem expediente do advogado, aplicados em todos os cálculos dele. */
async function diasInformados(userId: string) {
  const linhas = await db
    .select({ data: diasSemExpediente.data, descricao: diasSemExpediente.descricao, tipo: diasSemExpediente.tipo })
    .from(diasSemExpediente)
    .where(eq(diasSemExpediente.userId, userId));
  return linhas;
}

export async function salvarPrazo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 300);
  if (descricao.length < 3) return { error: "Descreva o prazo (ex.: Contestação, Recurso de apelação)." };

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(formData.get("parametros") ?? "{}"));
  } catch {
    return { error: "Os dados do cálculo estão incompletos. Recarregue a página." };
  }
  const parsed = ParametrosSchema.safeParse(bruto);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do cálculo." };

  // O servidor refaz a conta com os dias sem expediente gravados: não confia no navegador.
  const parametros: ParametrosPrazo = { ...parsed.data, diasInformados: await diasInformados(viewer.id) };
  const resultado = calcularPrazo(parametros);

  const processoId = uuid(formData.get("processoId"));
  if (processoId) {
    const [p] = await db
      .select({ id: processos.id })
      .from(processos)
      .where(and(eq(processos.id, processoId), eq(processos.userId, viewer.id)))
      .limit(1);
    if (!p) return { error: "Processo não encontrado." };
  }

  await db.insert(prazos).values({ userId: viewer.id, processoId, descricao, vencimento: resultado.vencimento, parametros });
  revalidatePath("/painel/prazos");
  return { ok: true, mensagem: "Prazo salvo na linha do tempo." };
}

export async function marcarPrazo(id: string, cumprido: boolean) {
  const viewer = await requireSubscriber();
  await db
    .update(prazos)
    .set({ cumpridoEm: cumprido ? new Date() : null })
    .where(and(eq(prazos.id, id), eq(prazos.userId, viewer.id)));
  revalidatePath("/painel/prazos");
}

export async function excluirPrazo(id: string) {
  const viewer = await requireSubscriber();
  await db.delete(prazos).where(and(eq(prazos.id, id), eq(prazos.userId, viewer.id)));
  revalidatePath("/painel/prazos");
}

export async function criarProcesso(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 200);
  const numero = String(formData.get("numero") ?? "").trim().slice(0, 40);
  const orgao = String(formData.get("orgao") ?? "").trim().slice(0, 200);
  const ramo = formData.get("ramo");
  if (titulo.length < 3) return { error: "Dê um nome ao processo (ex.: Indenização — Maria x Banco)." };
  if (ramo !== "civel" && ramo !== "trabalhista" && ramo !== "penal") return { error: "Escolha o ramo do processo." };
  if (numero && !/^[\d.\-\s]{7,30}$/.test(numero)) return { error: "O número do processo deve ter só dígitos, pontos e traços." };

  const [p] = await db
    .insert(processos)
    .values({
      userId: viewer.id,
      clienteId: await clienteDoUsuario(viewer.id, formData.get("clienteId")),
      titulo,
      numero: numero || null,
      orgao: orgao || null,
      ramo,
    })
    .returning({ id: processos.id });
  redirect(`/painel/prazos/processos/${p.id}`);
}

export async function arquivarProcesso(id: string, arquivar: boolean) {
  const viewer = await requireSubscriber();
  await db
    .update(processos)
    .set({ situacao: arquivar ? "arquivado" : "ativo" })
    .where(and(eq(processos.id, id), eq(processos.userId, viewer.id)));
  revalidatePath("/painel/prazos");
  revalidatePath(`/painel/prazos/processos/${id}`);
}

export async function excluirProcesso(id: string) {
  const viewer = await requireSubscriber();
  await db.delete(processos).where(and(eq(processos.id, id), eq(processos.userId, viewer.id)));
  redirect("/painel/prazos");
}

export async function adicionarDiaSemExpediente(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const data = String(formData.get("data") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 200);
  const tipo = formData.get("tipo") === "reduzido" ? "reduzido" : "sem_expediente";
  if (!dataValida(data)) return { error: "Informe uma data válida." };
  if (descricao.length < 3) return { error: "Descreva o dia (ex.: Feriado municipal, Indisponibilidade do PJe)." };

  await db
    .insert(diasSemExpediente)
    .values({ userId: viewer.id, data, descricao, tipo })
    .onConflictDoUpdate({ target: [diasSemExpediente.userId, diasSemExpediente.data], set: { descricao, tipo } });
  revalidatePath("/painel/prazos");
  return { ok: true };
}

export async function removerDiaSemExpediente(id: number) {
  const viewer = await requireSubscriber();
  await db.delete(diasSemExpediente).where(and(eq(diasSemExpediente.id, id), eq(diasSemExpediente.userId, viewer.id)));
  revalidatePath("/painel/prazos");
}
