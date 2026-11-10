import { expect, test } from "@playwright/test";
import { banco, contas, sessao } from "./apoio";

/*
 * Fila de IA (src/lib/ai/fila.ts) com a conta de administrador: teto de tarefas
 * simultâneas por pessoa, posição na fila na tela e exclusão que tira a tarefa
 * da fila sem contar no limite. Não espera a IA: as tarefas são canceladas no fim.
 */
test.use({ storageState: sessao("admin") });

const PREFIXO = "Teste da fila de IA";

async function idDaConta() {
  const { rows } = await banco().query<{ id: string }>("select id from users where email = $1", [contas().admin.email]);
  return rows[0].id;
}

async function limpar() {
  const userId = await idDaConta();
  await banco().query("update tarefas_ia set status = 'cancelada', concluida_em = now() where user_id = $1 and status in ('na_fila', 'processando')", [userId]);
  await banco().query("delete from search_history where user_id = $1 and query like $2", [userId, `${PREFIXO}%`]);
}

test.beforeEach(limpar);
test.afterEach(limpar);

test("até 3 tarefas por pessoa; a tela mostra a fila; excluir tira da fila sem contar no limite", async ({ page }) => {
  const userId = await idDaConta();
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    await page.goto("/painel/pesquisa");
    await page.getByLabel("Dúvida ou tese").fill(`${PREFIXO} ${i}: prazo de prescrição da cobrança de honorários contratuais`);
    await page.getByRole("button", { name: "Pesquisar" }).click();
    await expect(page).toHaveURL(/\/painel\/pesquisa\/[0-9a-f-]{36}$/);
    ids.push(page.url().split("/").pop()!);
  }
  await expect(page.getByText(/Na fila|Em andamento|Você é o próximo da fila/).first()).toBeVisible();

  await page.goto("/painel/pesquisa");
  await page.getByLabel("Dúvida ou tese").fill(`${PREFIXO} 4: esta deve ser recusada pelo teto de tarefas simultâneas`);
  await page.getByRole("button", { name: "Pesquisar" }).click();
  await expect(page.getByText("Você já tem 3 análises de IA na fila ou em andamento")).toBeVisible();

  // O painel lista as análises em andamento.
  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Suas análises de IA" })).toBeVisible();

  // Excluir uma que ainda está na fila: a tarefa é cancelada e não conta no limite.
  const { rows: naFila } = await banco().query<{ referencia_id: string }>(
    "select referencia_id from tarefas_ia where user_id = $1 and status = 'na_fila' and referencia_id = any($2::uuid[]) limit 1",
    [userId, ids],
  );
  test.skip(!naFila.length, "A IA já começou todas as tarefas; não há uma na fila para excluir.");
  await page.goto(`/painel/pesquisa/${naFila[0].referencia_id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/painel\/pesquisa$/);
  const { rows } = await banco().query<{ status: string }>("select status from tarefas_ia where referencia_id = $1", [naFila[0].referencia_id]);
  expect(rows[0].status).toBe("cancelada");
});
