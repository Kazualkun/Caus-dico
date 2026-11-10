import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, subscriptions, triagemLinks, users } from "@/db/schema";
import { hasActiveAccess, temPapel, type Papel } from "@/lib/auth";

/*
 * CRM do advogado. Toda consulta filtra por user_id: cada advogado só vê os
 * próprios clientes. Em relação a esses dados, o advogado é o controlador e o
 * Causídico atua como operador (LGPD, art. 5º, VI e VII).
 */

export const STATUS_CLIENTE = {
  lead: "Lead",
  negociacao: "Em negociação",
  cliente: "Cliente",
  encerrado: "Encerrado",
  perdido: "Perdido",
} as const;
export type StatusCliente = keyof typeof STATUS_CLIENTE;

export const ORIGENS_CLIENTE = {
  indicacao: "Indicação",
  triagem: "Link de triagem",
  calculadora: "Proposta da calculadora",
  site: "Site ou redes sociais",
  retorno: "Cliente antigo",
  outro: "Outra",
} as const;
export type OrigemCliente = keyof typeof ORIGENS_CLIENTE;

export const SITUACOES_PROPOSTA = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
} as const;
export type SituacaoProposta = keyof typeof SITUACOES_PROPOSTA;

/** Clientes para os campos de seleção (propostas, auditorias, processos, peças). */
export function clientesParaSelecao(userId: string) {
  return db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .where(eq(clientes.userId, userId))
    .orderBy(asc(clientes.nome));
}

/** Confere que o cliente pertence ao advogado; devolve null se não pertencer ou não vier. */
export async function clienteDoUsuario(userId: string, clienteId: unknown) {
  if (typeof clienteId !== "string" || !/^[0-9a-f-]{36}$/i.test(clienteId)) return null;
  const [c] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.userId, userId)))
    .limit(1);
  return c?.id ?? null;
}

/**
 * Proposta salva na calculadora: liga ao cliente de mesmo nome ou cria um em
 * negociação. O advogado pode trocar o vínculo na página da proposta.
 */
export async function vincularClientePorNome(userId: string, nome: string) {
  const [existente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.userId, userId), sql`lower(${clientes.nome}) = lower(${nome})`))
    .limit(1);
  if (existente) return existente.id;
  const [novo] = await db
    .insert(clientes)
    .values({ userId, nome, origem: "calculadora", status: "negociacao" })
    .returning({ id: clientes.id });
  return novo.id;
}

/** Código do link de triagem do advogado; cria na primeira vez. */
export async function garantirLinkTriagem(userId: string) {
  const [atual] = await db.select().from(triagemLinks).where(eq(triagemLinks.userId, userId)).limit(1);
  if (atual) return atual;
  const [novo] = await db
    .insert(triagemLinks)
    .values({ userId, codigo: novoCodigo() })
    .onConflictDoNothing()
    .returning();
  return novo ?? (await db.select().from(triagemLinks).where(eq(triagemLinks.userId, userId)).limit(1))[0];
}

/** 12 caracteres sem ambiguidade (sem 0/O, 1/l): ~60 bits, impossível de adivinhar. */
export function novoCodigo() {
  const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => alfabeto[b % alfabeto.length]).join("");
}

/**
 * Advogado dono de um link de triagem, se o link está ativo e a conta pode
 * recebê-la (assinatura ativa ou equipe). Usado na página pública.
 */
export async function advogadoDaTriagem(codigo: string) {
  if (!/^[a-z0-9]{8,32}$/.test(codigo)) return null;
  const [row] = await db
    .select({
      userId: users.id,
      nome: users.name,
      oabNumber: users.oabNumber,
      oabUf: users.oabUf,
      escritorio: users.officeName,
      email: users.email,
      role: users.role,
      bloqueada: users.blockedAt,
      ativo: triagemLinks.ativo,
      assinatura: subscriptions,
    })
    .from(triagemLinks)
    .innerJoin(users, eq(users.id, triagemLinks.userId))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(eq(triagemLinks.codigo, codigo))
    .limit(1);
  if (!row || !row.ativo || row.bloqueada) return null;
  const pode = hasActiveAccess(row.assinatura) || temPapel({ role: row.role as Papel }, "suporte");
  if (!pode) return null;
  return {
    userId: row.userId,
    nome: row.nome,
    oab: row.oabNumber ? `OAB ${row.oabNumber}${row.oabUf ? `/${row.oabUf}` : ""}` : null,
    escritorio: row.escritorio,
    email: row.email,
  };
}
