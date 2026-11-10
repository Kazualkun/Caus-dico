import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { banco, contas, PAPEIS, sessao } from "./apoio";

// Execuções seguidas esbarrariam nos limites de tentativas (login, contato):
// no banco local, os contadores e as mensagens de testes anteriores são zerados.
setup("zera limites e mensagens de testes anteriores", async () => {
  await banco().query("delete from limites_taxa");
  await banco().query("delete from contatos where mensagem like 'Teste automatizado%'");
});

/*
 * Entra uma vez com cada conta pelo formulário de login e guarda a sessão.
 * Sessões guardadas e ainda válidas são reaproveitadas: o login tem limite de
 * tentativas, e repetir 5 logins a cada execução esbarraria nele.
 */
for (const papel of PAPEIS) {
  setup(`sessão de ${papel}`, async ({ browser }) => {
    const arquivo = sessao(papel);
    if (existsSync(arquivo)) {
      const contexto = await browser.newContext({ storageState: arquivo });
      const pagina = await contexto.newPage();
      await pagina.goto("/painel/conta");
      // A sessão vencida volta para o login por um redirecionamento que chega depois do
      // carregamento (streaming); só o conteúdo da conta prova que ela vale.
      const valida = await pagina
        .getByText(contas()[papel].email)
        .first()
        .waitFor({ timeout: 10_000 })
        .then(() => pagina.url().includes("/painel/conta"))
        .catch(() => false);
      await contexto.close();
      if (valida) return;
    }

    const { email, senha } = contas()[papel];
    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();
    await pagina.goto("/entrar");
    await pagina.getByLabel("E-mail").fill(email);
    await pagina.getByLabel("Senha").fill(senha);
    await pagina.getByRole("button", { name: "Entrar" }).click();
    await expect(pagina).toHaveURL(/\/(painel|planos)/);
    await contexto.storageState({ path: arquivo });
    await contexto.close();
  });
}
