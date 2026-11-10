"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { db } from "@/db";
import { aceitesTermos } from "@/db/schema";
import { auth } from "@/lib/better-auth";
import { getViewer } from "@/lib/auth";
import { caminhoSeguro } from "@/lib/navigation";
import { excedeuLimite, ipDaRequisicao, MENSAGEM_LIMITE } from "@/lib/limite-taxa";
import { registrarAcesso } from "@/lib/registros";
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from "@/lib/legal";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();
const codigo = (e: unknown) => (isAPIError(e) ? String(e.body?.code ?? "") : "");

// As chamadas a auth.api.* feitas no servidor não passam pelo limitador HTTP do
// Better Auth; os limites contra força bruta e abuso ficam aqui.
const MINUTO = 60;
const HORA = 60 * MINUTO;

export async function entrar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = texto(formData, "email").toLowerCase();
  const ip = await ipDaRequisicao();
  if (
    await excedeuLimite([
      { chave: `entrar:ip:${ip}`, max: 20, janelaSegundos: 15 * MINUTO },
      { chave: `entrar:email:${email}`, max: 8, janelaSegundos: 15 * MINUTO },
    ])
  ) {
    return { error: MENSAGEM_LIMITE };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password: String(formData.get("password") ?? "") },
      headers: await headers(),
    });
  } catch (e) {
    const c = codigo(e);
    if (c === "EMAIL_NOT_VERIFIED") return { error: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    if (c === "CONTA_BLOQUEADA") return { error: "Esta conta está bloqueada. Fale com o atendimento." };
    return { error: "E-mail ou senha incorretos." };
  }
  redirect(caminhoSeguro(formData.get("next")) ?? "/painel");
}

export async function cadastrar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nome = texto(formData, "full_name");
  const email = texto(formData, "email");
  const senha = String(formData.get("password") ?? "");
  const oabNumber = texto(formData, "oab_number");
  const oabUf = texto(formData, "oab_uf").toUpperCase();

  if (nome.length < 3) return { error: "Informe seu nome completo." };
  if (senha.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (oabUf && !UFS.includes(oabUf as (typeof UFS)[number])) return { error: "Selecione uma UF válida para a OAB." };
  if (formData.get("aceite") !== "on") {
    return { error: "Para criar a conta, confirme que tem 18 anos ou mais e aceite os Termos de Uso." };
  }
  const ip = await ipDaRequisicao();
  if (await excedeuLimite([{ chave: `cadastro:ip:${ip}`, max: 5, janelaSegundos: HORA }])) {
    return { error: MENSAGEM_LIMITE };
  }

  let resultado: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    resultado = await auth.api.signUpEmail({
      body: { name: nome, email, password: senha, oabNumber: oabNumber || undefined, oabUf: oabUf || undefined, callbackURL: "/planos?assinar=1" },
      headers: await headers(),
    });
  } catch (e) {
    const c = codigo(e);
    if (c.startsWith("USER_ALREADY_EXISTS")) return { error: "Já existe uma conta com este e-mail. Entre com sua senha." };
    if (c.startsWith("PASSWORD_TOO")) return { error: "Escolha uma senha entre 8 e 128 caracteres." };
    if (c === "INVALID_EMAIL") return { error: "E-mail inválido." };
    return { error: "Não foi possível criar a conta. Confira os dados e tente novamente." };
  }

  // Prova do aceite: versão do documento, data e IP (CDC e LGPD, art. 8º, § 2º — ônus da prova do controlador).
  await db.insert(aceitesTermos).values([
    { userId: resultado.user.id, documento: "termos", versao: VERSAO_TERMOS, ip },
    { userId: resultado.user.id, documento: "privacidade", versao: VERSAO_PRIVACIDADE, ip },
  ]);
  await registrarAcesso({ userId: resultado.user.id, ip, userAgent: (await headers()).get("user-agent"), evento: "cadastro" });

  // Com confirmação de e-mail obrigatória, não há sessão até o usuário clicar no link.
  if (!resultado.token) return { ok: true };
  redirect("/planos?assinar=1");
}

/** Encerra a sessão. O campo opcional "destino" leva de volta ao login para entrar com outra conta. */
export async function sair(formData?: FormData) {
  const viewer = await getViewer();
  const h = await headers();
  await auth.api.signOut({ headers: h });
  if (viewer) await registrarAcesso({ userId: viewer.id, ip: await ipDaRequisicao(), userAgent: h.get("user-agent"), evento: "logout" });
  redirect(caminhoSeguro(formData?.get("destino")) ?? "/");
}

export async function pedirRedefinicaoSenha(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = texto(formData, "email").toLowerCase();
  const ip = await ipDaRequisicao();
  const excedeu = await excedeuLimite([
    { chave: `senha:ip:${ip}`, max: 5, janelaSegundos: HORA },
    { chave: `senha:email:${email}`, max: 3, janelaSegundos: HORA },
  ]);
  if (excedeu) return { error: MENSAGEM_LIMITE };

  // O endereço do link vem da configuração, nunca do cabeçalho Origin da requisição:
  // quem forja o cabeçalho poderia receber o token de outra pessoa no próprio site.
  const base = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: `${base}/redefinir-senha` } });
  } catch (e) {
    console.error("[senha] falha ao pedir redefinição", e);
  }
  // Mesma resposta exista ou não a conta: não revela quem é cliente.
  return { ok: true };
}

export async function redefinirSenha(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const senha = String(formData.get("password") ?? "");
  const token = texto(formData, "token");
  if (senha.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (!token) return { error: "Link inválido. Peça um novo e-mail de redefinição." };
  if (await excedeuLimite([{ chave: `redefinir:ip:${await ipDaRequisicao()}`, max: 10, janelaSegundos: HORA }])) {
    return { error: MENSAGEM_LIMITE };
  }
  try {
    await auth.api.resetPassword({ body: { newPassword: senha, token } });
  } catch {
    return { error: "O link expirou ou já foi usado. Peça um novo e-mail de redefinição." };
  }
  redirect("/entrar?senha=redefinida");
}
