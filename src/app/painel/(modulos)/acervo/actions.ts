"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, normas } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { obterNorma } from "@/lib/acervo/busca";
import { explicarNorma } from "@/lib/ai/explicacao";
import { mensagemDeErro } from "@/lib/ai/ollama";
import type { ActionState } from "@/lib/types";

const LIMITE_DIARIO = 30;

/** Gera e guarda a explicação em linguagem simples (uma vez por norma, para todos). */
export async function gerarExplicacao(normaId: number): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const norma = await obterNorma(normaId);
  if (!norma || norma.removidaEm) return { error: "Norma não encontrada." };
  if (norma.explicacao) return { ok: true };

  const [{ n }] = await db
    .select({ n: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, viewer.id), eq(aiUsage.recurso, "explicacao"), gte(aiUsage.createdAt, sql`now() - interval '1 day'`)));
  if (n >= LIMITE_DIARIO) return { error: `Limite de ${LIMITE_DIARIO} explicações por dia atingido. Tente amanhã.` };

  try {
    const explicacao = await explicarNorma(norma, { userId: viewer.id, recurso: "explicacao", referenciaId: String(normaId) });
    await db.update(normas).set({ explicacao: JSON.stringify(explicacao), explicacaoEm: new Date() }).where(eq(normas.id, normaId));
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }
  revalidatePath(`/painel/acervo/${normaId}`);
  return { ok: true };
}
