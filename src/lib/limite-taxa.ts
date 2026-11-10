import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { pool } from "@/db";

/**
 * IP de quem fez a requisição. Na Vercel, x-real-ip vem da plataforma; num servidor
 * próprio, o Nginx (ou Caddy) da frente deve sobrescrevê-lo com o endereço da conexão
 * e a aplicação só deve aceitar conexões do proxy (veja DEPLOY.md). No x-forwarded-for,
 * vale a última entrada, a que o nosso proxy acrescentou: as anteriores vêm do cliente.
 * Como o cabeçalho pode ser forjado se a aplicação ficar exposta sem proxy, os limites
 * por IP sempre andam junto de um limite por conta ou e-mail.
 */
export async function ipDaRequisicao() {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}

export type Regra = { chave: string; max: number; janelaSegundos: number };

/**
 * Conta uma tentativa em cada regra (janela fixa) e diz se alguma passou do limite.
 * As chaves viram hash antes de ir para o banco: o contador não guarda IP nem e-mail.
 */
export async function excedeuLimite(regras: Regra[]): Promise<boolean> {
  let excedeu = false;
  for (const r of regras) {
    const chave = createHash("sha256").update(r.chave).digest("hex");
    const { rows } = await pool.query<{ contagem: number }>(
      `insert into limites_taxa (chave, contagem, inicio_janela) values ($1, 1, now())
       on conflict (chave) do update set
         contagem = case when limites_taxa.inicio_janela < now() - make_interval(secs => $2) then 1 else limites_taxa.contagem + 1 end,
         inicio_janela = case when limites_taxa.inicio_janela < now() - make_interval(secs => $2) then now() else limites_taxa.inicio_janela end
       returning contagem`,
      [chave, r.janelaSegundos],
    );
    if (rows[0].contagem > r.max) excedeu = true;
  }
  return excedeu;
}

export const MENSAGEM_LIMITE = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
