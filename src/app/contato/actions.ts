"use server";

import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { contatos, users } from "@/db/schema";
import { getViewer } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { EMPRESA } from "@/lib/legal";
import { ASSUNTOS_CONTATO as ASSUNTOS, PRAZO_CONTATO_DIAS as PRAZO_DIAS, type AssuntoContato as Assunto } from "@/lib/contato";
import { excedeuLimite, ipDaRequisicao, MENSAGEM_LIMITE } from "@/lib/limite-taxa";
import type { ActionState } from "@/lib/types";

export async function enviarContato(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo invisível: robôs preenchem, pessoas não.
  if (String(formData.get("site") ?? "")) return { ok: true, mensagem: "Mensagem recebida." };

  const viewer = await getViewer();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 200);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const assunto = String(formData.get("assunto") ?? "") as Assunto;
  const mensagem = String(formData.get("mensagem") ?? "").trim().slice(0, 5000);

  if (nome.length < 3) return { error: "Informe seu nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido para receber a resposta." };
  if (!(assunto in ASSUNTOS)) return { error: "Escolha o assunto." };
  if (mensagem.length < 10) return { error: "Escreva sua mensagem." };
  // Cada mensagem dispara um e-mail de confirmação: o limite impede usar o formulário para enviar spam.
  if (await excedeuLimite([{ chave: `contato:ip:${await ipDaRequisicao()}`, max: 5, janelaSegundos: 60 * 60 }])) {
    return { error: MENSAGEM_LIMITE };
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(contatos)
    .where(and(eq(contatos.email, email), gte(contatos.createdAt, sql`now() - interval '1 day'`)));
  if (n >= 5) return { error: "Recebemos várias mensagens deste e-mail hoje. Aguarde a resposta ou escreva amanhã." };

  const [registro] = await db
    .insert(contatos)
    .values({ userId: viewer?.id ?? null, nome, email, assunto, mensagem })
    .returning({ id: contatos.id });
  const protocolo = registro.id.slice(0, 8).toUpperCase();

  await enviarEmail({
    para: email,
    assunto: `Recebemos sua mensagem (protocolo ${protocolo})`,
    texto: `Olá, ${nome}.\n\nRecebemos sua mensagem sobre "${ASSUNTOS[assunto]}" e respondemos em até ${PRAZO_DIAS} dias.\n\nProtocolo: ${protocolo}\n\n${EMPRESA.nomeFantasia}`,
  }).catch((e) => console.error("[contato] falha ao confirmar por e-mail", e));

  // Avisa a equipe de atendimento (suporte, administração e desenvolvimento).
  const equipe = await db
    .select({ email: users.email })
    .from(users)
    .where(and(inArray(users.role, ["suporte", "administrador", "desenvolvedor"]), isNull(users.blockedAt)))
    .limit(10);
  for (const membro of equipe) {
    await enviarEmail({
      para: membro.email,
      assunto: `Nova mensagem de contato (${ASSUNTOS[assunto]})`,
      texto: `Mensagem ${protocolo} de ${nome} <${email}>. Responda em Administração → Contato até ${PRAZO_DIAS} dias.`,
    }).catch(() => undefined);
  }

  return { ok: true, mensagem: `Mensagem enviada com o protocolo ${protocolo}. Respondemos por e-mail em até ${PRAZO_DIAS} dias.` };
}
