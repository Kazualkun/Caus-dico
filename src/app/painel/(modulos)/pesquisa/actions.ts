"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { searchHistory } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { cancelarTarefa, enfileirar, situacaoNaFila } from "@/lib/ai/fila";
import { AREAS } from "@/lib/pricing/engine";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

export async function iniciarPesquisa(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const pergunta = String(formData.get("pergunta") ?? "").trim();
  const area = String(formData.get("area") ?? "");
  const fatos = String(formData.get("fatos") ?? "").trim().slice(0, 4000);
  const uf = String(formData.get("uf") ?? "").toUpperCase();
  const normaId = Number(formData.get("normaId")) || undefined;

  if (pergunta.length < 15) return { error: "Descreva a dúvida ou a tese com um pouco mais de detalhe." };
  if (pergunta.length > 2000) return { error: "A pergunta passou de 2.000 caracteres. Coloque os detalhes em Fatos do caso." };

  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "pesquisa",
    plano: viewer.plano,
    criar: async (tx) => {
      const [registro] = await tx
        .insert(searchHistory)
        .values({
          userId: viewer.id,
          query: pergunta,
          area: AREAS.find((a) => a.id === area)?.nome ?? null,
          params: {
            ...(fatos ? { fatos } : {}),
            ...(UFS.includes(uf as (typeof UFS)[number]) ? { uf } : {}),
            ...(normaId ? { normaId } : {}),
          },
          progress: "Na fila",
        })
        .returning({ id: searchHistory.id });
      return registro.id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/pesquisa/${pedido.referenciaId}`);
}

export async function reprocessarPesquisa(id: string): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const [row] = await db
    .select()
    .from(searchHistory)
    .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, viewer.id)))
    .limit(1);
  if (!row) return { error: "Pesquisa não encontrada." };
  if (row.status !== "erro" && (await situacaoNaFila("pesquisa", id)).estado !== "inativa") {
    return { error: "Esta pesquisa já está em andamento." };
  }

  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "pesquisa",
    plano: viewer.plano,
    criar: async (tx) => {
      await tx.update(searchHistory).set({ status: "processando", progress: "Na fila", error: null }).where(eq(searchHistory.id, id));
      return id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/pesquisa/${id}`);
}

export async function excluirPesquisa(id: string) {
  const viewer = await requireSubscriber();
  const apagados = await db
    .delete(searchHistory)
    .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, viewer.id)))
    .returning({ id: searchHistory.id });
  if (apagados.length) await cancelarTarefa("pesquisa", id);
  redirect("/painel/pesquisa");
}
