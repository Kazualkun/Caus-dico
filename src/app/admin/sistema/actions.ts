"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePapel } from "@/lib/auth";
import { aplicarRetencao, registrarAuditoria } from "@/lib/registros";
import { recalcularEstatisticas } from "@/lib/acervo/estatisticas";
import type { ActionState } from "@/lib/types";

export async function executarRetencao(): Promise<ActionState> {
  const ator = await requirePapel("desenvolvedor");
  const r = await aplicarRetencao();
  await registrarAuditoria({ ator, acao: "sistema.retencao_aplicada", detalhes: r });
  revalidatePath("/admin/sistema");
  const outros = r.usoIa + r.auditoria + r.solicitacoes + r.cobrancas;
  return {
    ok: true,
    mensagem: `Removidos ${r.acessos} registros de acesso com mais de 6 meses, ${r.emails} e-mails antigos e ${outros} outros registros fora do prazo.`,
  };
}

export async function limparCacheDoAcervo(): Promise<ActionState> {
  const ator = await requirePapel("desenvolvedor");
  await recalcularEstatisticas();
  revalidateTag("acervo", "max");
  await registrarAuditoria({ ator, acao: "sistema.cache_acervo_limpo" });
  return { ok: true, mensagem: "Contagens do acervo recalculadas." };
}
