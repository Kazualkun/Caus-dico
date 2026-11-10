import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, recomendacoesPeca, searchHistory, triagens } from "@/db/schema";
import { analisarContrato, type Perspectiva } from "@/lib/ai/contract-team";
import { pesquisar } from "@/lib/ai/research";
import { recomendarPeca } from "@/lib/ai/pecas";
import { analisarCaso, LIMITE_TEXTO_CASO } from "@/lib/ai/analise-caso";
import { anonimizar } from "@/lib/anonimizar";
import { textoDoCaso } from "@/lib/triagem";
import { mensagemDeErro } from "@/lib/ai/ollama";

/*
 * Tarefas longas de IA, executadas pela fila (src/lib/ai/fila.ts). A autorização
 * já foi feita na action que criou o registro. Cada função grava o resultado no
 * próprio registro (a tela acompanha pela coluna `progress`) e devolve o desfecho
 * para a fila: "ausente" quando o usuário apagou o item antes.
 */

export type Desfecho = "concluido" | "erro" | "ausente";

/** O item já saiu de "processando" (concluído ou com erro): a fila não refaz o trabalho. */
const jaResolvida = (status: string): Desfecho => (status === "concluido" ? "concluido" : "erro");

/** O usuário apagou o item (ou a conta) no meio da tarefa. */
class ItemRemovidoError extends Error {}

/**
 * Grava a etapa e confere que o item ainda existe: se foi apagado, a tarefa para
 * antes da próxima chamada à IA em vez de ocupar a GPU à toa.
 */
const etapaSeExistir = (gravar: (progress: string) => PromiseLike<{ rowCount: number | null }>) => async (progress: string) => {
  if (!(await gravar(progress)).rowCount) throw new ItemRemovidoError();
};

export async function processarContrato(contractId: string): Promise<Desfecho> {
  const [row] = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
  if (!row) return "ausente";
  if (row.status !== "processando") return jaResolvida(row.status);

  // A geração de minutas foi retirada (a IA não redige); registros antigos não são reprocessados.
  if (row.kind !== "analise") {
    await db
      .update(contracts)
      .set({ status: "erro", progress: null, error: "A geração de minutas não está mais disponível." })
      .where(eq(contracts.id, contractId));
    return "erro";
  }

  const onEtapa = etapaSeExistir((progress) => db.update(contracts).set({ progress }).where(eq(contracts.id, contractId)));
  const rastreio = { userId: row.userId, recurso: "auditoria", referenciaId: row.id };

  try {
    const analise = await analisarContrato({
      texto: row.content,
      perspectiva: (row.params.perspectiva as Perspectiva) ?? "neutra",
      observacoes: row.params.observacoes,
      onEtapa,
      rastreio,
    });
    await db
      .update(contracts)
      .set({ analysis: analise, riskScore: analise.parecer.nota_risco, status: "concluido", progress: null, error: null })
      .where(eq(contracts.id, contractId));
    return "concluido";
  } catch (e) {
    if (e instanceof ItemRemovidoError) return "ausente";
    console.error("[contratos] falha", contractId, e);
    await db.update(contracts).set({ status: "erro", progress: null, error: mensagemDeErro(e) }).where(eq(contracts.id, contractId));
    return "erro";
  }
}

export async function processarPesquisa(searchId: string): Promise<Desfecho> {
  const [row] = await db.select().from(searchHistory).where(eq(searchHistory.id, searchId)).limit(1);
  if (!row) return "ausente";
  if (row.status !== "processando") return jaResolvida(row.status);

  try {
    const resultado = await pesquisar({
      pergunta: row.query,
      area: row.area ?? undefined,
      fatos: row.params.fatos,
      uf: row.params.uf,
      onEtapa: etapaSeExistir((progress) => db.update(searchHistory).set({ progress }).where(eq(searchHistory.id, searchId))),
      rastreio: { userId: row.userId, recurso: "pesquisa", referenciaId: row.id },
    });
    await db
      .update(searchHistory)
      .set({ result: resultado, status: "concluido", progress: null, error: null })
      .where(eq(searchHistory.id, searchId));
    return "concluido";
  } catch (e) {
    if (e instanceof ItemRemovidoError) return "ausente";
    console.error("[pesquisa] falha", searchId, e);
    await db.update(searchHistory).set({ status: "erro", progress: null, error: mensagemDeErro(e) }).where(eq(searchHistory.id, searchId));
    return "erro";
  }
}

export async function processarPeca(id: string): Promise<Desfecho> {
  const [row] = await db.select().from(recomendacoesPeca).where(eq(recomendacoesPeca.id, id)).limit(1);
  if (!row) return "ausente";
  if (row.status !== "processando") return jaResolvida(row.status);

  try {
    const resultado = await recomendarPeca({
      ...row.params,
      onEtapa: etapaSeExistir((progress) => db.update(recomendacoesPeca).set({ progress }).where(eq(recomendacoesPeca.id, id))),
      rastreio: { userId: row.userId, recurso: "peca", referenciaId: row.id },
    });
    await db
      .update(recomendacoesPeca)
      .set({ result: resultado, status: "concluido", progress: null, error: null })
      .where(eq(recomendacoesPeca.id, id));
    return "concluido";
  } catch (e) {
    if (e instanceof ItemRemovidoError) return "ausente";
    console.error("[pecas] falha", id, e);
    await db.update(recomendacoesPeca).set({ status: "erro", progress: null, error: mensagemDeErro(e) }).where(eq(recomendacoesPeca.id, id));
    return "erro";
  }
}

/** Sugestão de área, complexidade e risco para o caso que chegou pela triagem. */
export async function processarTriagem(id: string): Promise<Desfecho> {
  const [row] = await db.select().from(triagens).where(eq(triagens.id, id)).limit(1);
  if (!row) return "ausente";
  if (row.status !== "processando") return jaResolvida(row.status);

  try {
    const { texto } = anonimizar(textoDoCaso(row.respostas).slice(0, LIMITE_TEXTO_CASO));
    const analise = await analisarCaso(texto, { userId: row.userId, recurso: "triagem", referenciaId: row.id });
    await db.update(triagens).set({ analise, status: "concluido", error: null }).where(eq(triagens.id, id));
    return "concluido";
  } catch (e) {
    console.error("[triagem] falha", id, e);
    await db.update(triagens).set({ status: "erro", error: mensagemDeErro(e) }).where(eq(triagens.id, id));
    return "erro";
  }
}
