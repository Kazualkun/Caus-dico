/**
 * Papéis de usuários pela linha de comando.
 *
 * Pela interface, ninguém atribui um papel acima do próprio; por isso o
 * primeiro desenvolvedor é definido aqui, por quem tem acesso ao banco.
 *
 *   npm run usuario:papel -- voce@exemplo.com desenvolvedor
 *   npm run usuario:equipe
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // usa as variáveis do ambiente
}

const { pool } = await import("@/db");
const PAPEIS = ["usuario", "suporte", "administrador", "desenvolvedor"];

const [comando, email, papel] = process.argv.slice(2);

try {
  switch (comando) {
    case "papel": {
      if (!email || !PAPEIS.includes(papel)) {
        console.error(`Uso: npm run usuario:papel -- <email> <${PAPEIS.join("|")}>`);
        process.exitCode = 1;
        break;
      }
      const { rows } = await pool.query<{ id: string; role: string }>(
        "select id, role from users where lower(email) = lower($1)",
        [email],
      );
      if (!rows[0]) {
        console.error(`Nenhuma conta com o e-mail ${email}. Crie a conta em /cadastro e rode de novo.`);
        process.exitCode = 1;
        break;
      }
      await pool.query("update users set role = $2, updated_at = now() where id = $1", [rows[0].id, papel]);
      await pool.query(
        `insert into audit_log (ator_email, acao, alvo_tipo, alvo_id, detalhes) values ('cli', 'usuario.papel_alterado', 'usuario', $1, $2::jsonb)`,
        [rows[0].id, JSON.stringify({ de: rows[0].role, para: papel, via: "linha de comando" })],
      );
      console.log(`${email}: ${rows[0].role} → ${papel}`);
      break;
    }
    case "equipe": {
      const { rows } = await pool.query(
        "select email, name as nome, role as papel, blocked_at as bloqueada_em from users where role <> 'usuario' order by role, email",
      );
      console.table(rows);
      break;
    }
    default:
      console.error("Uso: tsx scripts/usuarios.mts <papel|equipe> [opções]");
      process.exitCode = 1;
  }
} finally {
  await pool.end();
}
