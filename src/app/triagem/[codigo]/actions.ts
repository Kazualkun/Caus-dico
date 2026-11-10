"use server";

import { after } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, triagens } from "@/db/schema";
import { advogadoDaTriagem } from "@/lib/crm";
import { enviarEmail } from "@/lib/email";
import { enfileirar } from "@/lib/ai/fila";
import { excedeuLimite, ipDaRequisicao, MENSAGEM_LIMITE } from "@/lib/limite-taxa";
import { ASSUNTOS_TRIAGEM, VERSAO_AVISO_TRIAGEM, type AssuntoTriagem, type RespostasTriagem } from "@/lib/triagem";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const campo = (formData: FormData, nome: string, max: number) => String(formData.get(nome) ?? "").trim().slice(0, max);

/**
 * Envio público da triagem (sem login). O caso vira um lead no CRM do advogado
 * dono do link; a sugestão de complexidade e risco é feita depois, em segundo
 * plano, pela IA local.
 */
export async function enviarTriagem(codigo: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo invisível: robôs preenchem, pessoas não.
  if (campo(formData, "site", 200)) return { ok: true };

  const advogado = await advogadoDaTriagem(codigo);
  if (!advogado) return { error: "Este link de triagem não está mais disponível. Fale diretamente com o advogado." };

  const uf = campo(formData, "uf", 2).toUpperCase();
  const assunto = campo(formData, "assunto", 40) as AssuntoTriagem;
  const temDocumentos = campo(formData, "temDocumentos", 10);
  const respostas: RespostasTriagem = {
    nome: campo(formData, "nome", 200),
    telefone: campo(formData, "telefone", 40),
    email: campo(formData, "email", 200).toLowerCase() || null,
    cidade: campo(formData, "cidade", 100) || null,
    uf: UFS.includes(uf as (typeof UFS)[number]) ? uf : null,
    assunto: ASSUNTOS_TRIAGEM.some((a) => a.id === assunto) ? assunto : "outro",
    relato: campo(formData, "relato", 6000),
    quando: campo(formData, "quando", 200) || null,
    temDocumentos: temDocumentos === "sim" || temDocumentos === "nao" ? temDocumentos : "nao_sei",
    objetivo: campo(formData, "objetivo", 1000) || null,
    avisoVersao: VERSAO_AVISO_TRIAGEM,
  };

  if (respostas.nome.length < 2) return { error: "Informe seu nome." };
  if (respostas.telefone.replace(/\D/g, "").length < 10) return { error: "Informe um telefone com DDD para o retorno." };
  if (respostas.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respostas.email)) return { error: "O e-mail não parece válido." };
  if (respostas.relato.length < 30) return { error: "Conte um pouco mais sobre o que aconteceu." };
  if (formData.get("aceite") !== "on") return { error: "Para enviar, confirme que leu o aviso sobre o uso dos seus dados." };

  if (await excedeuLimite([{ chave: `triagem:ip:${await ipDaRequisicao()}`, max: 5, janelaSegundos: 60 * 60 }])) {
    return { error: MENSAGEM_LIMITE };
  }
  // Um link divulgado não pode virar canal de spam para o CRM do advogado.
  const [{ n }] = await db
    .select({ n: count() })
    .from(triagens)
    .where(and(eq(triagens.userId, advogado.userId), gte(triagens.createdAt, sql`now() - interval '1 day'`)));
  if (n >= 100) return { error: "Este link recebeu muitos envios hoje. Tente amanhã ou fale diretamente com o advogado." };

  // O lead e a triagem entram juntos; a sugestão da IA vem depois, pela fila (sem prioridade sobre quem espera na tela).
  await enfileirar({
    userId: advogado.userId,
    tipo: "triagem",
    criar: async (tx) => {
      const [cliente] = await tx
        .insert(clientes)
        .values({
          userId: advogado.userId,
          nome: respostas.nome,
          telefone: respostas.telefone,
          email: respostas.email,
          cidade: respostas.cidade,
          uf: respostas.uf,
          origem: "triagem",
          status: "lead",
        })
        .returning({ id: clientes.id });
      const [triagem] = await tx
        .insert(triagens)
        .values({ userId: advogado.userId, clienteId: cliente.id, respostas })
        .returning({ id: triagens.id });
      return triagem.id;
    },
  });

  // O aviso não leva o conteúdo do caso: o advogado vê tudo no Causídico.
  after(() =>
    enviarEmail({
      para: advogado.email,
      assunto: "Novo caso pelo seu link de triagem",
      texto: "Você recebeu um novo caso pelo seu link de triagem. Abra o Causídico em Clientes para ver as respostas e a sugestão de complexidade e risco.",
    }).catch((e) => console.error("[triagem] falha ao avisar o advogado", e)),
  );

  return { ok: true };
}
