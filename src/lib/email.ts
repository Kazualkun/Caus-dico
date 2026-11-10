import { db } from "@/db";
import { emailsSaida } from "@/db/schema";

/**
 * Envio de e-mails transacionais (confirmação, redefinição de senha, avisos).
 * Com RESEND_API_KEY, envia pela Resend. Sem provedor (desenvolvimento), a
 * mensagem fica na caixa de saída do banco, visível no painel do desenvolvedor.
 */
export async function enviarEmail(m: { para: string; assunto: string; texto: string }) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    // Os e-mails levam links de acesso (confirmação, nova senha). Em produção, sem
    // provedor, o corpo não é guardado nem impresso: quem lê a caixa de saída ou os
    // logs poderia entrar na conta de outra pessoa.
    if (process.env.NODE_ENV === "production") {
      const erro = "RESEND_API_KEY ausente: e-mail não enviado";
      await db.insert(emailsSaida).values({ para: m.para, assunto: m.assunto, texto: "", via: "console", erro });
      console.error(`[e-mail] ${erro} (para ${m.para}: ${m.assunto})`);
      return;
    }
    await db.insert(emailsSaida).values({ ...m, via: "console" });
    console.info(`[e-mail] para ${m.para}: ${m.assunto}\n${m.texto}`);
    return;
  }

  let erro: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_REMETENTE ?? "Causídico <nao-responda@causidico.com.br>",
        to: m.para,
        subject: m.assunto,
        text: m.texto,
      }),
    });
    if (!res.ok) erro = `Resend respondeu ${res.status}`;
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  // Só o registro do envio é guardado (sem o corpo, que pode conter links de acesso).
  await db.insert(emailsSaida).values({ para: m.para, assunto: m.assunto, texto: "", via: "resend", erro });
  if (erro) throw new Error(`Falha ao enviar e-mail: ${erro}`);
}
