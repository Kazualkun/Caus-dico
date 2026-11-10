import "server-only";
import { and, count, eq, gte, notInArray } from "drizzle-orm";
import { db, type Db } from "@/db";
import { tarefasIa } from "@/db/schema";
import { PLANS, RECURSO_LABEL, type PlanId, type Recurso } from "@/lib/plans";

type TipoTarefa = (typeof tarefasIa.$inferSelect)["tipo"];

/** Recurso do plano consumido por cada tipo de tarefa (a triagem não consome). Pesquisas e peças dividem o mesmo limite. */
export const RECURSO_DA_TAREFA: Record<TipoTarefa, Recurso | null> = {
  auditoria: "analises",
  pesquisa: "pesquisas",
  peca: "pesquisas",
  triagem: null,
};

/** Início do mês corrente no fuso de Brasília (UTC-3 o ano todo desde 2019). */
export function inicioDoMes(agora = new Date()) {
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));
}

/**
 * Uso do mês, contado no registro de tarefas de IA: apagar o item não devolve a
 * cota. Tarefas que terminaram em erro ou foram canceladas antes de começar não contam.
 */
export async function contarUso(executor: Pick<Db, "select">, userId: string): Promise<Record<Recurso, number>> {
  const linhas = await executor
    .select({ tipo: tarefasIa.tipo, n: count() })
    .from(tarefasIa)
    .where(and(eq(tarefasIa.userId, userId), gte(tarefasIa.criadaEm, inicioDoMes()), notInArray(tarefasIa.status, ["erro", "cancelada"])))
    .groupBy(tarefasIa.tipo);

  const uso: Record<Recurso, number> = { analises: 0, pesquisas: 0 };
  for (const { tipo, n } of linhas) {
    const recurso = RECURSO_DA_TAREFA[tipo];
    if (recurso) uso[recurso] += n;
  }
  return uso;
}

export const getMonthlyUsage = (userId: string) => contarUso(db, userId);

export function mensagemDeLimite(plano: PlanId, recurso: Recurso, usado: number) {
  const p = PLANS[plano];
  return `Você usou ${usado} de ${p.limites[recurso]} ${RECURSO_LABEL[recurso].toLowerCase()} do plano ${p.nome} neste mês. O limite renova no dia 1º, ou você pode mudar de plano em Minha conta.`;
}
