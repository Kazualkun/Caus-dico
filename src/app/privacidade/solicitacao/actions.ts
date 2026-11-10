"use server";

import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { lgpdSolicitacoes, users } from "@/db/schema";
import { getViewer } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { EMPRESA } from "@/lib/legal";
import { excedeuLimite, ipDaRequisicao, MENSAGEM_LIMITE } from "@/lib/limite-taxa";
import type { ActionState } from "@/lib/types";

const TIPOS = ["confirmacao", "acesso", "correcao", "anonimizacao", "portabilidade", "exclusao", "compartilhamento", "revogacao", "oposicao", "outro"] as const;
const PRAZO_DIAS = 15; // LGPD, art. 19, II

export async function registrarSolicitacao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo invisível: robôs preenchem, pessoas não.
  if (String(formData.get("site") ?? "")) return { ok: true };

  const viewer = await getViewer();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 200);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const tipo = String(formData.get("tipo") ?? "") as (typeof TIPOS)[number];
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 4000);

  if (nome.length < 3) return { error: "Informe seu nome completo." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido para receber a resposta." };
  if (!TIPOS.includes(tipo)) return { error: "Escolha o tipo de solicitação." };
  // Cada pedido dispara um e-mail de confirmação: o limite por IP impede usar o formulário para enviar spam.
  if (await excedeuLimite([{ chave: `lgpd:ip:${await ipDaRequisicao()}`, max: 10, janelaSegundos: 24 * 60 * 60 }])) {
    return { error: MENSAGEM_LIMITE };
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(lgpdSolicitacoes)
    .where(and(eq(lgpdSolicitacoes.email, email), gte(lgpdSolicitacoes.createdAt, sql`now() - interval '1 day'`)));
  if (n >= 5) return { error: "Recebemos várias solicitações deste e-mail hoje. Aguarde a resposta ou tente amanhã." };

  const prazo = new Date(Date.now() + PRAZO_DIAS * 24 * 60 * 60 * 1000);
  const [registro] = await db
    .insert(lgpdSolicitacoes)
    .values({ userId: viewer?.id ?? null, nome, email, tipo, descricao: descricao || null, prazoEm: prazo })
    .returning({ id: lgpdSolicitacoes.id });

  const protocolo = registro.id.slice(0, 8).toUpperCase();
  await enviarEmail({
    para: email,
    assunto: `Recebemos sua solicitação sobre dados pessoais (protocolo ${protocolo})`,
    texto: `Olá, ${nome}.\n\nRecebemos sua solicitação (${tipo}). Responderemos em até ${PRAZO_DIAS} dias, até ${prazo.toLocaleDateString("pt-BR")}. Podemos pedir informações para confirmar sua identidade antes de atender.\n\nProtocolo: ${protocolo}\n\n${EMPRESA.nomeFantasia}`,
  }).catch((e) => console.error("[lgpd] falha ao confirmar por e-mail", e));

  // Avisa o encarregado; enquanto não houver um, a administração, para o prazo não passar despercebido.
  const destinatarios = EMPRESA.encarregado
    ? [EMPRESA.encarregado.email]
    : (
        await db
          .select({ email: users.email })
          .from(users)
          .where(and(inArray(users.role, ["administrador", "desenvolvedor"]), isNull(users.blockedAt)))
          .limit(5)
      ).map((u) => u.email);
  for (const para of destinatarios) {
    await enviarEmail({
      para,
      assunto: `Nova solicitação de titular (${tipo}) — prazo ${prazo.toLocaleDateString("pt-BR")}`,
      texto: `Solicitação ${protocolo} de ${nome} <${email}>. Responda em Administração → LGPD.`,
    }).catch(() => undefined);
  }

  return { ok: true, mensagem: `Solicitação registrada com o protocolo ${protocolo}. Respondemos em até ${PRAZO_DIAS} dias, por e-mail.` };
}
