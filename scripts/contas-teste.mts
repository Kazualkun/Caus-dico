/**
 * Contas de teste, uma por papel, para usar o site localmente.
 *
 *   npm run usuario:teste
 *
 * Cada execução gera senhas novas e as imprime (as anteriores deixam de valer).
 * Só roda contra um banco local: contas com senha conhecida nunca devem
 * existir no Neon.
 */
import { randomInt } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // usa as variáveis do ambiente
}

const host = new URL(process.env.DATABASE_URL ?? "postgres://indefinido").hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Recusado: DATABASE_URL aponta para ${host}. Contas de teste só em banco local.`);
  process.exit(1);
}

const { pool } = await import("@/db");
const { auth } = await import("@/lib/better-auth");
const { PLANS } = await import("@/lib/plans");
const { VERSAO_PRIVACIDADE, VERSAO_TERMOS } = await import("@/lib/legal");

type Conta = {
  email: string;
  nome: string;
  papel: "usuario" | "suporte" | "administrador" | "desenvolvedor";
  assinatura?: "basico" | "profissional" | "escritorio";
  uso: string;
};

const CONTAS: Conta[] = [
  { email: "dev@causidico.test", nome: "Dev de Teste", papel: "desenvolvedor", uso: "tudo, inclusive Administração → Sistema" },
  { email: "admin@causidico.test", nome: "Admin de Teste", papel: "administrador", uso: "assinaturas, acervo, LGPD, auditoria" },
  { email: "suporte@causidico.test", nome: "Suporte de Teste", papel: "suporte", uso: "usuários e tarefas de IA" },
  { email: "assinante@causidico.test", nome: "Assinante de Teste", papel: "usuario", assinatura: "profissional", uso: "painel com plano Profissional ativo" },
  { email: "novo@causidico.test", nome: "Novo Usuário", papel: "usuario", uso: "sem assinatura: planos e checkout" },
];

// Sem caracteres ambíguos (0/O, 1/l/I).
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const gerarSenha = () =>
  Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")).join("-");

const ctx = await auth.$context;
const saida: { papel: string; email: string; senha: string; uso: string }[] = [];

try {
  for (const c of CONTAS) {
    const senha = gerarSenha();
    const hash = await ctx.password.hash(senha);
    const existente = await ctx.internalAdapter.findUserByEmail(c.email);

    let id: string;
    if (existente) {
      id = existente.user.id;
      await pool.query("update users set role = $2, email_verified = true, blocked_at = null, updated_at = now() where id = $1", [id, c.papel]);
      await ctx.internalAdapter.updatePassword(id, hash);
      await pool.query("delete from sessions where user_id = $1", [id]);
    } else {
      const u = await ctx.internalAdapter.createUser({ email: c.email, name: c.nome, emailVerified: true, role: c.papel, oabNumber: "123456", oabUf: "SP" }, { method: "admin" });
      id = u.id;
      await ctx.internalAdapter.linkAccount({ userId: id, providerId: "credential", accountId: id, password: hash });
      await pool.query(
        "insert into aceites_termos (user_id, documento, versao, ip) values ($1, 'termos', $2, null), ($1, 'privacidade', $3, null)",
        [id, VERSAO_TERMOS, VERSAO_PRIVACIDADE],
      );
      await pool.query(
        `insert into audit_log (ator_email, acao, alvo_tipo, alvo_id, detalhes) values ('cli', 'usuario.conta_teste_criada', 'usuario', $1, $2::jsonb)`,
        [id, JSON.stringify({ papel: c.papel, via: "linha de comando" })],
      );
    }

    if (c.assinatura) {
      // Assinatura sem vínculo com o Asaas: cancelar funciona e não chama o gateway.
      const valor = PLANS[c.assinatura].precoMensalCents;
      const { rows: assinatura } = await pool.query<{ id: string }>(
        `insert into subscriptions (user_id, plan, cycle, status, provider, value_cents, current_period_end, first_payment_at, last_payment_at,
                                    billing_type, last_payment_id)
         values ($1::uuid, $2, 'mensal', 'ativa', 'teste', $3, now() + interval '20 days', now() - interval '10 days', now() - interval '10 days',
                 'PIX', 'teste-' || $1::text)
         on conflict (user_id) do update set plan = excluded.plan, status = 'ativa', canceled_at = null, refunded_at = null,
           current_period_end = excluded.current_period_end, billing_type = excluded.billing_type,
           last_payment_id = excluded.last_payment_id, updated_at = now()
         returning id`,
        [id, c.assinatura, valor],
      );
      // A cobrança correspondente no livro de cobranças, para o faturamento ter o que mostrar.
      await pool.query(
        `insert into pagamentos (id, provider, assinatura_id, user_id, status, forma, valor_cents, vencimento, pago_em)
         values ('teste-' || $1::text, 'teste', $2, $1::uuid, 'recebido', 'PIX', $3, (now() - interval '10 days')::date, now() - interval '10 days')
         on conflict (id) do nothing`,
        [id, assinatura[0].id, valor],
      );
    }

    saida.push({ papel: c.papel + (c.assinatura ? ` (${c.assinatura})` : ""), email: c.email, senha, uso: c.uso });
  }

  console.table(saida);
  // Os testes de ponta a ponta (npm run test:e2e) leem as credenciais daqui. Pasta fora do git.
  mkdirSync("tests/.auth", { recursive: true });
  writeFileSync("tests/.auth/contas.json", JSON.stringify(Object.fromEntries(CONTAS.map((c, i) => [c.email.split("@")[0], { email: c.email, senha: saida[i].senha }])), null, 2));
  rmSync("tests/.auth/sessoes", { recursive: true, force: true });
  console.log("Entre em http://localhost:3000/entrar. Rodar de novo gera senhas novas (gravadas também em tests/.auth/contas.json).");
} finally {
  await pool.end();
}
