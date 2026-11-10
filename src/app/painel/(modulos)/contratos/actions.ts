"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { requireSubscriber } from "@/lib/auth";
import { ArquivoIlegivelError, extrairTexto, formatoDoArquivo } from "@/lib/contracts/extract";
import { LIMITE_CARACTERES_CONTRATO, type Perspectiva } from "@/lib/ai/contract-team";
import { cancelarTarefa, enfileirar, situacaoNaFila } from "@/lib/ai/fila";
import { clienteDoUsuario } from "@/lib/crm";
import type { ActionState, ContractRow } from "@/lib/types";

const PERSPECTIVAS: Perspectiva[] = ["contratante", "contratado", "neutra"];
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

/**
 * Auditoria de contrato. O arquivo (PDF/DOCX) é lido em memória para extrair
 * o texto e descartado: o documento original não é armazenado (LGPD, art. 6º, III).
 */
export async function auditarContrato(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const perspectiva = formData.get("perspectiva") as Perspectiva;
  if (!PERSPECTIVAS.includes(perspectiva)) return { error: "Indique qual parte você representa." };

  const observacoes = String(formData.get("observacoes") ?? "").trim().slice(0, 2000);
  let titulo = String(formData.get("titulo") ?? "").trim().slice(0, 200);
  let texto = String(formData.get("texto") ?? "").trim();
  let origem: ContractRow["source"] = "texto";

  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    const formato = formatoDoArquivo(arquivo.name);
    if (!formato) return { error: "Envie um arquivo .pdf ou .docx." };
    if (arquivo.size > TAMANHO_MAXIMO) return { error: "O arquivo passa de 20 MB." };
    try {
      texto = await extrairTexto(await arquivo.arrayBuffer(), formato);
    } catch (e) {
      if (!(e instanceof ArquivoIlegivelError)) console.error("[contratos] falha ao ler o arquivo", e);
      return { error: e instanceof ArquivoIlegivelError ? e.message : "Não foi possível ler o arquivo. Confira se ele abre normalmente ou cole o texto." };
    }
    origem = formato;
    titulo ||= arquivo.name.replace(/\.(pdf|docx)$/i, "");
  }

  if (texto.length < 200) return { error: "O contrato precisa ter pelo menos 200 caracteres para ser auditado." };
  if (texto.length > LIMITE_CARACTERES_CONTRATO) {
    const mil = (n: number) => `${Math.round(n / 1000)} mil`;
    return {
      error: `O contrato tem ${mil(texto.length)} caracteres, acima do limite de ${mil(LIMITE_CARACTERES_CONTRATO)} (cerca de ${Math.floor(LIMITE_CARACTERES_CONTRATO / 3400)} páginas). Divida-o em partes (corpo e anexos) e audite cada uma.`,
    };
  }

  const clienteId = await clienteDoUsuario(viewer.id, formData.get("clienteId"));
  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "auditoria",
    plano: viewer.plano,
    criar: async (tx) => {
      const [registro] = await tx
        .insert(contracts)
        .values({
          userId: viewer.id,
          kind: "analise",
          title: titulo || "Contrato sem título",
          source: origem,
          content: texto,
          params: { perspectiva, observacoes },
          clienteId,
          progress: "Na fila",
        })
        .returning({ id: contracts.id });
      return registro.id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/contratos/${pedido.referenciaId}`);
}

/** Reprocessa um contrato que terminou em erro ou cuja tarefa foi interrompida. */
export async function reprocessarContrato(id: string): Promise<ActionState> {
  const viewer = await requireSubscriber();
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.userId, viewer.id)))
    .limit(1);
  if (!row) return { error: "Contrato não encontrado." };
  if (row.status !== "erro" && (await situacaoNaFila("auditoria", id)).estado !== "inativa") {
    return { error: "Este contrato já está sendo processado." };
  }

  const pedido = await enfileirar({
    userId: viewer.id,
    tipo: "auditoria",
    plano: viewer.plano,
    criar: async (tx) => {
      await tx.update(contracts).set({ status: "processando", progress: "Na fila", error: null }).where(eq(contracts.id, id));
      return id;
    },
  });
  if ("error" in pedido) return pedido;
  redirect(`/painel/contratos/${id}`);
}

export async function excluirContrato(id: string) {
  const viewer = await requireSubscriber();
  const apagados = await db.delete(contracts).where(and(eq(contracts.id, id), eq(contracts.userId, viewer.id))).returning({ id: contracts.id });
  if (apagados.length) await cancelarTarefa("auditoria", id);
  redirect("/painel/contratos");
}
