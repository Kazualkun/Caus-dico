"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, recomendacoesPeca, searchHistory, triagens } from "@/db/schema";
import { requirePapel } from "@/lib/auth";
import { enfileirar, type TipoTarefa, type Transacao } from "@/lib/ai/fila";
import { registrarAuditoria } from "@/lib/registros";
import type { ActionState } from "@/lib/types";

const TABELA = { auditoria: contracts, pesquisa: searchHistory, peca: recomendacoesPeca, triagem: triagens } as const;

/** Volta o item para "processando" (a triagem não tem coluna de etapa). */
async function reabrir(tx: Transacao, tipo: TipoTarefa, id: string) {
  const reaberto = { status: "processando" as const, error: null };
  if (tipo === "auditoria") await tx.update(contracts).set({ ...reaberto, progress: "Na fila" }).where(eq(contracts.id, id));
  else if (tipo === "pesquisa") await tx.update(searchHistory).set({ ...reaberto, progress: "Na fila" }).where(eq(searchHistory.id, id));
  else if (tipo === "peca") await tx.update(recomendacoesPeca).set({ ...reaberto, progress: "Na fila" }).where(eq(recomendacoesPeca.id, id));
  else await tx.update(triagens).set(reaberto).where(eq(triagens.id, id));
}

/** Reprocessa uma tarefa de qualquer usuário (suporte). Não expõe o conteúdo e não conta na cota do usuário. */
export async function reprocessarTarefa(tipo: TipoTarefa, id: string): Promise<ActionState> {
  const ator = await requirePapel("suporte");
  if (!(tipo in TABELA) || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Tarefa inválida." };

  const tabela = TABELA[tipo];
  const [item] = await db.select({ userId: tabela.userId }).from(tabela).where(eq(tabela.id, id)).limit(1);
  if (!item) return { error: "O item não existe mais (o usuário pode tê-lo excluído)." };

  const pedido = await enfileirar({
    userId: item.userId,
    tipo,
    criar: async (tx) => {
      await reabrir(tx, tipo, id);
      return id;
    },
  });
  if ("error" in pedido) return pedido;

  await registrarAuditoria({ ator, acao: "tarefa.reprocessada", alvoTipo: tipo, alvoId: id });
  revalidatePath("/admin/ia");
  return { ok: true, mensagem: "Tarefa colocada na fila de novo." };
}
