"use server";

import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requirePapel } from "@/lib/auth";
import { espelhoExiste } from "@/lib/acervo/espelho";
import { sincronizarAcervo } from "@/lib/acervo/sincronizacao";
import { enriquecerOficial, verificarDou } from "@/lib/acervo/oficial";
import { registrarAuditoria } from "@/lib/registros";
import type { ActionState } from "@/lib/types";

/**
 * Dispara a sincronização em segundo plano. Só funciona onde existe o espelho
 * Git (servidor próprio ou worker); em hospedagem serverless, use o agendamento
 * descrito no README.
 */
export async function dispararSincronizacao(): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  if (!espelhoExiste()) {
    return { error: "Este servidor não tem o espelho do acervo. Rode `npm run acervo:sincronizar` no worker agendado." };
  }
  after(async () => {
    await sincronizarAcervo({ disparadaPor: ator.email });
    revalidateTag("acervo", "max");
  });
  await registrarAuditoria({ ator, acao: "acervo.sincronizacao_disparada" });
  revalidatePath("/admin/acervo");
  return { ok: true, mensagem: "Sincronização iniciada. Acompanhe o progresso nesta página." };
}

export async function dispararVerificacaoDou(): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  after(() => verificarDou({ dias: 7, disparadaPor: ator.email }));
  await registrarAuditoria({ ator, acao: "acervo.dou_verificado" });
  return { ok: true, mensagem: "Verificação do Diário Oficial iniciada." };
}

export async function dispararEnriquecimento(): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  after(() => enriquecerOficial({ limite: 200, disparadaPor: ator.email }));
  await registrarAuditoria({ ator, acao: "acervo.enriquecimento_disparado" });
  return { ok: true, mensagem: "Enriquecimento de 200 normas iniciado (cerca de 2 minutos)." };
}
