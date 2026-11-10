"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { papeisAtribuiveis, requirePapel, temPapel, type Papel, type Viewer } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/registros";
import { PAPEIS } from "@/lib/better-auth";
import type { ActionState } from "@/lib/types";

async function alvo(userId: string) {
  const [u] = await db.select({ id: users.id, email: users.email, role: users.role, blockedAt: users.blockedAt }).from(users).where(eq(users.id, userId)).limit(1);
  return u ? { ...u, role: (u.role ?? "usuario") as Papel } : null;
}

/** Só se age sobre quem tem papel abaixo do seu (o desenvolvedor pode agir sobre todos, menos sobre si). */
function podeAgirSobre(ator: Viewer, alvoPapel: Papel, alvoId: string) {
  if (ator.id === alvoId) return false;
  if (ator.role === "desenvolvedor") return true;
  return temPapel(ator, "administrador") && !temPapel({ role: alvoPapel }, ator.role);
}

export async function alterarPapel(userId: string, novo: Papel): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const u = await alvo(userId);
  if (!u) return { error: "Usuário não encontrado." };
  if (!PAPEIS.includes(novo) || !papeisAtribuiveis(ator).includes(novo)) return { error: "Você não pode atribuir esse papel." };
  if (!podeAgirSobre(ator, u.role, u.id)) return { error: "Você não pode alterar o papel deste usuário." };
  if (u.role === "desenvolvedor" && novo !== "desenvolvedor") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "desenvolvedor"));
    if (n <= 1) return { error: "O sistema precisa de pelo menos um desenvolvedor." };
  }

  await db.update(users).set({ role: novo }).where(eq(users.id, userId));
  await registrarAuditoria({ ator, acao: "usuario.papel_alterado", alvoTipo: "usuario", alvoId: userId, detalhes: { de: u.role, para: novo, email: u.email } });
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: true, mensagem: "Papel atualizado." };
}

export async function alternarBloqueio(userId: string): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const u = await alvo(userId);
  if (!u) return { error: "Usuário não encontrado." };
  if (!podeAgirSobre(ator, u.role, u.id)) return { error: "Você não pode bloquear este usuário." };

  const bloquear = !u.blockedAt;
  await db.update(users).set({ blockedAt: bloquear ? new Date() : null }).where(eq(users.id, userId));
  if (bloquear) await db.delete(sessions).where(eq(sessions.userId, userId));
  await registrarAuditoria({ ator, acao: bloquear ? "usuario.bloqueado" : "usuario.desbloqueado", alvoTipo: "usuario", alvoId: userId, detalhes: { email: u.email } });
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: true, mensagem: bloquear ? "Usuário bloqueado e desconectado." : "Usuário desbloqueado." };
}

export async function encerrarSessoes(userId: string): Promise<ActionState> {
  const ator = await requirePapel("suporte");
  const u = await alvo(userId);
  if (!u) return { error: "Usuário não encontrado." };
  if (u.id !== ator.id && temPapel({ role: u.role }, ator.role) && ator.role !== "desenvolvedor") {
    return { error: "Você não pode encerrar as sessões deste usuário." };
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await registrarAuditoria({ ator, acao: "usuario.sessoes_encerradas", alvoTipo: "usuario", alvoId: userId, detalhes: { email: u.email } });
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: true, mensagem: "Sessões encerradas. O usuário precisará entrar de novo." };
}
