"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recomendacoesPeca } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { clienteDoUsuario } from "@/lib/crm";
import { cancelarTarefa, enfileirar, situacaoNaFila } from "@/lib/ai/fila";
import { AREAS } from "@/lib/pricing/engine";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

export async function iniciarRecomendacao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const polo = formData.get("polo");
  const area = String(formData.get("area") ?? "");
  const uf = String(formData.get("uf") ?? "").toUpperCase();
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 200);
  const fatos = String(formData.get("fatos") ?? "").trim();
  const objetivo = String(formData.get("objetivo") ?? "").trim().slice(0, 2000);

  if (polo !== "autor" && polo !== "reu") return { error: "Indique se o cliente é autor ou réu." };
  if (!AREAS.some((a) => a.id === area)) return { error: "Escolha a área." };
  if (fatos.length < 80) return { error: "Descreva os fatos com um pouco mais de detalhe (algumas frases)." };
  if (fatos.length > 8000) return { error: "Os fatos passaram de 8.000 caracteres. Resuma o essencial para a escolha da peça." };

  const clienteId = await clienteDoUsuario(viewer.id, formData.get("clienteId"));
  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "peca",
    plano: viewer.plano,
    criar: async (tx) => {
      const [registro] = await tx
        .insert(recomendacoesPeca)
        .values({
          userId: viewer.id,
          clienteId,
          titulo: titulo || fatos.slice(0, 90),
          params: {
            polo,
            area,
            fatos,
            ...(objetivo ? { objetivo } : {}),
            ...(UFS.includes(uf as (typeof UFS)[number]) ? { uf } : {}),
          },
          progress: "Na fila",
        })
        .returning({ id: recomendacoesPeca.id });
      return registro.id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/pecas/${pedido.referenciaId}`);
}

export async function reprocessarRecomendacao(id: string): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const [row] = await db
    .select()
    .from(recomendacoesPeca)
    .where(and(eq(recomendacoesPeca.id, id), eq(recomendacoesPeca.userId, viewer.id)))
    .limit(1);
  if (!row) return { error: "Recomendação não encontrada." };
  if (row.status !== "erro" && (await situacaoNaFila("peca", id)).estado !== "inativa") {
    return { error: "Esta recomendação já está em andamento." };
  }

  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "peca",
    plano: viewer.plano,
    criar: async (tx) => {
      await tx.update(recomendacoesPeca).set({ status: "processando", progress: "Na fila", error: null }).where(eq(recomendacoesPeca.id, id));
      return id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/pecas/${id}`);
}

export async function excluirRecomendacao(id: string) {
  const viewer = await requireSubscriber();
  const apagados = await db
    .delete(recomendacoesPeca)
    .where(and(eq(recomendacoesPeca.id, id), eq(recomendacoesPeca.userId, viewer.id)))
    .returning({ id: recomendacoesPeca.id });
  if (apagados.length) await cancelarTarefa("peca", id);
  redirect("/painel/pecas");
}
