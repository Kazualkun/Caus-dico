"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contatos } from "@/db/schema";
import { requirePapel } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { EMPRESA } from "@/lib/legal";
import { registrarAuditoria } from "@/lib/registros";
import type { ActionState } from "@/lib/types";

export async function responderContato(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("suporte");
  const id = String(formData.get("id") ?? "");
  const resposta = String(formData.get("resposta") ?? "").trim().slice(0, 8000);
  if (resposta.length < 10) return { error: "Escreva a resposta." };

  const [c] = await db.select().from(contatos).where(eq(contatos.id, id)).limit(1);
  if (!c) return { error: "Mensagem não encontrada." };

  const protocolo = c.id.slice(0, 8).toUpperCase();
  await enviarEmail({
    para: c.email,
    assunto: `Resposta à sua mensagem (protocolo ${protocolo})`,
    texto: `Olá, ${c.nome}.\n\n${resposta}\n\n— Sua mensagem —\n${c.mensagem}\n\n${EMPRESA.nomeFantasia}`,
  });
  await db
    .update(contatos)
    .set({ status: "respondida", resposta, respondidaEm: new Date(), respondidaPor: ator.id })
    .where(eq(contatos.id, id));
  await registrarAuditoria({ ator, acao: "contato.respondido", alvoTipo: "contato", alvoId: id });
  revalidatePath("/admin/contato");
  return { ok: true, mensagem: "Resposta enviada por e-mail." };
}

/** Arquiva sem responder (spam, mensagem duplicada). */
export async function arquivarContato(id: string): Promise<ActionState> {
  const ator = await requirePapel("suporte");
  await db.update(contatos).set({ status: "arquivada", respondidaEm: new Date(), respondidaPor: ator.id }).where(eq(contatos.id, id));
  await registrarAuditoria({ ator, acao: "contato.arquivado", alvoTipo: "contato", alvoId: id });
  revalidatePath("/admin/contato");
  return { ok: true, mensagem: "Mensagem arquivada." };
}
