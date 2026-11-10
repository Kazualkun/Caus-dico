"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pricingProposals } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { AREAS, calcularHonorarios, valorProposto } from "@/lib/pricing/engine";
import { redigirCarta } from "@/lib/ai/proposal-letter";
import { analisarCaso, LIMITE_TEXTO_CASO, type AnaliseCaso } from "@/lib/ai/analise-caso";
import { mensagemDeErro } from "@/lib/ai/ollama";
import { anonimizar } from "@/lib/anonimizar";
import { ArquivoIlegivelError, extrairTexto, formatoDoArquivo } from "@/lib/contracts/extract";
import { excedeuLimite } from "@/lib/limite-taxa";
import { vincularClientePorNome } from "@/lib/crm";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const centavos = z.number().int().min(0).max(100_000_000_000);

const PropostaSchema = z.object({
  clientName: z.string().trim().min(2, "Informe o nome do cliente.").max(200),
  caseTitle: z.string().trim().min(5, "Descreva o caso em uma linha.").max(300),
  area: z.enum(AREAS.map((a) => a.id) as [string, ...string[]], { error: "Escolha a área." }),
  uf: z.enum(UFS, { error: "Escolha a UF." }),
  billingFormat: z.enum(["fixo", "exito", "misto", "hora"]),
  inputs: z.object({
    custosFixosMensaisCents: centavos,
    horasProdutivasMes: z.number().min(1).max(400),
    margemPercentual: z.number().min(0).max(300),
    valorHoraCents: centavos,
    horasEstimadas: z.number().min(0.5).max(5000),
    valorCausaCents: centavos,
    complexidade: z.enum(["baixa", "media", "alta", "muito_alta"]),
    risco: z.enum(["baixo", "medio", "alto"]),
    impostoPercentual: z.number().min(0, "Os impostos não podem ser negativos.").max(60, "Impostos acima de 60% não fazem sentido; revise o percentual.").default(0),
    repassePercentual: z.number().min(0, "O repasse não pode ser negativo.").max(50, "Repasse por indicação acima de 50% não é aceito.").default(0),
  }),
});

export async function salvarProposta(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();

  let inputs: unknown;
  try {
    inputs = JSON.parse(String(formData.get("inputs") ?? "{}"));
  } catch {
    return { error: "Os dados da calculadora estão incompletos. Recarregue a página." };
  }

  const parsed = PropostaSchema.safeParse({
    clientName: formData.get("clientName"),
    caseTitle: formData.get("caseTitle"),
    area: formData.get("area"),
    uf: formData.get("uf"),
    billingFormat: formData.get("billingFormat"),
    inputs,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos da proposta." };

  const p = parsed.data;
  // O resultado é recalculado aqui: o servidor não confia no que veio do navegador.
  const resultado = calcularHonorarios(p.inputs);

  const [registro] = await db
    .insert(pricingProposals)
    .values({
      userId: viewer.id,
      clientName: p.clientName,
      caseTitle: p.caseTitle,
      area: p.area,
      uf: p.uf,
      inputs: p.inputs,
      result: resultado,
      billingFormat: p.billingFormat,
      proposedValueCents: valorProposto(resultado, p.billingFormat),
      // Entra no CRM: liga ao cliente de mesmo nome ou cria um em negociação.
      clienteId: await vincularClientePorNome(viewer.id, p.clientName),
    })
    .returning({ id: pricingProposals.id });

  redirect(`/painel/honorarios/${registro.id}`);
}

export async function redigirCartaProposta(id: string): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const [proposta] = await db
    .select()
    .from(pricingProposals)
    .where(and(eq(pricingProposals.id, id), eq(pricingProposals.userId, viewer.id)))
    .limit(1);
  if (!proposta) return { error: "Proposta não encontrada." };

  try {
    const carta = await redigirCarta(proposta, {
      id: viewer.id,
      nome: viewer.fullName ?? viewer.email,
      oab: viewer.oabNumber ? `${viewer.oabNumber}${viewer.oabUf ? `/${viewer.oabUf}` : ""}` : null,
    });
    await db.update(pricingProposals).set({ proposalLetter: carta }).where(eq(pricingProposals.id, id));
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }

  revalidatePath(`/painel/honorarios/${id}`);
  return { ok: true };
}

export type AnaliseCasoState = { error?: string; analise?: AnaliseCaso; mascarados?: number; truncado?: boolean } | undefined;

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;

/**
 * Análise do caso para a calculadora. Nada é gravado: o resumo e o arquivo são
 * lidos em memória, os identificadores pessoais são mascarados antes da IA e o
 * texto é descartado ao fim da requisição. Só o uso (sem conteúdo) é registrado.
 */
export async function analisarCasoComIa(_prev: AnaliseCasoState, formData: FormData): Promise<AnaliseCasoState> {
  const viewer = await requireSubscriber();
  // A IA local atende uma tarefa por vez: o limite protege a fila dos demais usuários.
  if (await excedeuLimite([{ chave: `analise-caso:${viewer.id}`, max: 20, janelaSegundos: 60 * 60 }])) {
    return { error: "Você fez muitas análises na última hora. Aguarde um pouco e tente de novo." };
  }

  const partes = [String(formData.get("resumo") ?? "").trim().slice(0, 8000)];
  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) return { error: "O arquivo passa de 10 MB." };
    const extensao = arquivo.name.split(".").pop()?.toLowerCase();
    const formato = formatoDoArquivo(arquivo.name);
    if (!formato && extensao !== "txt") return { error: "Envie um arquivo .pdf, .docx ou .txt." };
    try {
      const conteudo = await arquivo.arrayBuffer();
      partes.push(formato ? await extrairTexto(conteudo, formato) : new TextDecoder().decode(conteudo));
    } catch (e) {
      return { error: e instanceof ArquivoIlegivelError ? e.message : "Não foi possível ler o arquivo. Confira se ele abre normalmente ou cole o texto." };
    }
  }

  const texto = partes.filter(Boolean).join("\n\n");
  if (texto.length < 80) return { error: "Descreva o caso em algumas frases ou envie o arquivo do caso." };

  const { texto: anonimo, mascarados } = anonimizar(texto.slice(0, LIMITE_TEXTO_CASO));
  try {
    const analise = await analisarCaso(anonimo, { userId: viewer.id, recurso: "analise_caso" });
    return { analise, mascarados, truncado: texto.length > LIMITE_TEXTO_CASO };
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }
}

export async function excluirProposta(id: string) {
  const viewer = await requireSubscriber();
  await db.delete(pricingProposals).where(and(eq(pricingProposals.id, id), eq(pricingProposals.userId, viewer.id)));
  redirect("/painel/honorarios");
}
