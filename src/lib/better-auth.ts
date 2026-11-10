import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/auth-schema";
import { enviarEmail } from "@/lib/email";
import { registrarAcesso } from "@/lib/registros";

/** Papéis do sistema, do menor para o maior acesso. */
export const PAPEIS = ["usuario", "suporte", "administrador", "desenvolvedor"] as const;
export type Papel = (typeof PAPEIS)[number];

export const auth = betterAuth({
  appName: "Causídico",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "causidico",
  },
  // Login, cadastro e senha passam pelas Server Actions de src/app/(auth)/actions.ts,
  // que aplicam limite de tentativas, validação e registro do aceite dos termos, e a
  // sessão é lida no servidor (auth.api). As rotas HTTP equivalentes ficam fechadas
  // para não servirem de atalho: /change-password, por exemplo, conferiria a senha
  // atual sem limite de tentativas para quem tivesse um cookie de sessão roubado.
  // Continuam abertas as que os e-mails usam: /verify-email e /reset-password/:token.
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/sign-in/social",
    "/sign-out",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/update-user",
    "/update-session",
    "/change-password",
    "/change-email",
    "/delete-user",
    "/get-session",
    "/list-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
    "/list-accounts",
    "/link-social",
    "/unlink-account",
    "/account-info",
    "/get-access-token",
    "/refresh-token",
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Seguro por padrão: só fica desligado com AUTH_EXIGIR_VERIFICACAO_EMAIL=false (desenvolvimento).
    requireEmailVerification: process.env.AUTH_EXIGIR_VERIFICACAO_EMAIL !== "false",
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await enviarEmail({
        para: user.email,
        assunto: "Redefinição de senha do Causídico",
        texto: `Para criar uma nova senha, abra o link abaixo (válido por 1 hora):\n\n${url}\n\nSe você não pediu a troca, ignore este e-mail.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Quem tenta entrar sem ter confirmado recebe o link de novo (o login já tem limite de tentativas).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await enviarEmail({
        para: user.email,
        assunto: "Confirme seu e-mail no Causídico",
        texto: `Para confirmar seu e-mail, abra o link abaixo:\n\n${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      // Campos controlados só pelo servidor: input false impede que o cadastro os defina.
      role: { type: [...PAPEIS], required: false, defaultValue: "usuario", input: false },
      oabNumber: { type: "string", required: false },
      oabUf: { type: "string", required: false },
      officeName: { type: "string", required: false, input: false },
      cpfCnpj: { type: "string", required: false, input: false },
      phone: { type: "string", required: false, input: false },
      blockedAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    session: {
      create: {
        // Conta bloqueada pela administração não abre sessão.
        before: async (session) => {
          const [u] = await db.select({ bloqueada: users.blockedAt }).from(users).where(eq(users.id, session.userId)).limit(1);
          if (u?.bloqueada) throw new APIError("FORBIDDEN", { code: "CONTA_BLOQUEADA", message: "Conta bloqueada" });
        },
        // Marco Civil da Internet, art. 15: guarda dos registros de acesso por 6 meses.
        after: async (session) => {
          await registrarAcesso({
            userId: session.userId,
            ip: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
            evento: "login",
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Sessao = typeof auth.$Infer.Session;
