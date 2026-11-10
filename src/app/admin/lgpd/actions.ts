"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lgpdSolicitacoes } from "@/db/schema";
import { requirePapel } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";
import { registrarAuditoria } from "@/lib/registros";
import { EMPRESA } from "@/lib/legal";
import type { ActionState } from "@/lib/types";

const STATUS = ["em_andamento", "concluida", "indeferida"] as const;

export async function responderSolicitacao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as (typeof STATUS)[number];
  const resposta = String(formData.get("resposta") ?? "").trim();

  if (!STATUS.includes(status)) return { error: "Escolha a situação." };
  if (status !== "em_andamento" && resposta.length < 10) return { error: "Escreva a resposta ao titular." };

  const [s] = await db.select().from(lgpdSolicitacoes).where(eq(lgpdSolicitacoes.id, id)).limit(1);
  if (!s) return { error: "Solicitação não encontrada." };

  await db
    .update(lgpdSolicitacoes)
    .set({
      status,
      resposta: resposta || s.resposta,
      ...(status !== "em_andamento" ? { respondidaEm: new Date(), respondidaPor: ator.id } : {}),
    })
    .where(eq(lgpdSolicitacoes.id, id));

  if (resposta) {
    await enviarEmail({
      para: s.email,
      assunto: `Resposta à sua solicitação sobre dados pessoais (protocolo ${s.id.slice(0, 8).toUpperCase()})`,
      texto: `Olá, ${s.nome}.\n\n${resposta}\n\n${EMPRESA.nomeFantasia}\n${
        EMPRESA.encarregado ? `Encarregado de dados: ${EMPRESA.encarregado.nome} <${EMPRESA.encarregado.email}>` : "Equipe de privacidade"
      }`,
    });
  }
  await registrarAuditoria({ ator, acao: `lgpd.solicitacao_${status}`, alvoTipo: "solicitacao", alvoId: id, detalhes: { tipo: s.tipo } });
  revalidatePath("/admin/lgpd");
  return { ok: true, mensagem: resposta ? "Resposta registrada e enviada ao titular." : "Situação atualizada." };
}
