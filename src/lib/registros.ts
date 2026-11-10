import { and, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, auditLog, billingEvents, contatos, emailsSaida, lgpdSolicitacoes, limitesTaxa, pagamentos, registrosAcesso, subscriptions, tarefasIa } from "@/db/schema";

/**
 * Registro de acesso (Marco Civil da Internet, art. 15): data, hora e IP de
 * cada login, guardados por 6 meses em ambiente controlado.
 */
export async function registrarAcesso(r: { userId: string; ip: string | null; userAgent: string | null; evento: string }) {
  await db.insert(registrosAcesso).values(r);
}

export async function registrarAuditoria(r: {
  ator: { id: string; email: string } | null;
  acao: string;
  alvoTipo?: string;
  alvoId?: string;
  detalhes?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values({
    atorId: r.ator?.id ?? null,
    atorEmail: r.ator?.email ?? null,
    acao: r.acao,
    alvoTipo: r.alvoTipo ?? null,
    alvoId: r.alvoId ?? null,
    detalhes: r.detalhes ?? {},
  });
}

export async function registrarUsoIa(r: typeof aiUsage.$inferInsert) {
  try {
    await db.insert(aiUsage).values(r);
  } catch (e) {
    // A conta foi excluída enquanto a tarefa rodava: a métrica fica sem o vínculo.
    if (r.userId && (e as { cause?: { code?: string } }).cause?.code === "23503") return registrarUsoIa({ ...r, userId: null });
    // A métrica nunca derruba a tarefa principal.
    console.error("[uso-ia] falha ao registrar", e);
  }
}

/**
 * Política de retenção, a mesma descrita na Política de Privacidade (seção
 * "Por quanto tempo guardamos"):
 * - registros de acesso: 6 meses (Marco Civil, art. 15);
 * - registro de envio de e-mails: 7 dias;
 * - contadores de tentativas (limites de taxa): 1 dia;
 * - métricas de uso da IA e registro da fila de IA (sem conteúdo): 2 anos;
 * - trilha de auditoria e solicitações de titulares já respondidas: 5 anos;
 * - mensagens do formulário de contato: 2 anos após a resposta;
 * - cobranças de contas excluídas (sem vínculo com perfil), livro de cobranças e eventos do Asaas: 5 anos (legislação tributária).
 */
export async function aplicarRetencao() {
  const cincoAnos = sql`now() - interval '5 years'`;
  const acessos = await db.delete(registrosAcesso).where(lt(registrosAcesso.createdAt, sql`now() - interval '6 months'`));
  const emails = await db.delete(emailsSaida).where(lt(emailsSaida.createdAt, sql`now() - interval '7 days'`));
  await db.delete(limitesTaxa).where(lt(limitesTaxa.inicioJanela, sql`now() - interval '1 day'`));
  const usoIa = await db.delete(aiUsage).where(lt(aiUsage.createdAt, sql`now() - interval '2 years'`));
  const fila = await db
    .delete(tarefasIa)
    .where(and(inArray(tarefasIa.status, ["concluida", "erro", "cancelada"]), lt(tarefasIa.criadaEm, sql`now() - interval '2 years'`)));
  const auditoria = await db.delete(auditLog).where(lt(auditLog.createdAt, cincoAnos));
  const solicitacoes = await db
    .delete(lgpdSolicitacoes)
    .where(and(inArray(lgpdSolicitacoes.status, ["concluida", "indeferida"]), lt(lgpdSolicitacoes.respondidaEm, cincoAnos)));
  const cobrancas = await db.delete(subscriptions).where(and(isNull(subscriptions.userId), lt(subscriptions.updatedAt, cincoAnos)));
  const eventos = await db.delete(billingEvents).where(lt(billingEvents.receivedAt, cincoAnos));
  const livro = await db.delete(pagamentos).where(lt(pagamentos.atualizadoEm, cincoAnos));
  const mensagens = await db
    .delete(contatos)
    .where(and(inArray(contatos.status, ["respondida", "arquivada"]), lt(contatos.respondidaEm, sql`now() - interval '2 years'`)));
  return {
    acessos: acessos.rowCount ?? 0,
    emails: emails.rowCount ?? 0,
    usoIa: (usoIa.rowCount ?? 0) + (fila.rowCount ?? 0),
    auditoria: auditoria.rowCount ?? 0,
    solicitacoes: solicitacoes.rowCount ?? 0,
    cobrancas: (cobrancas.rowCount ?? 0) + (eventos.rowCount ?? 0) + (livro.rowCount ?? 0),
    contatos: mensagens.rowCount ?? 0,
  };
}
