import { expect, test } from "@playwright/test";

test.describe("páginas públicas", () => {
  test("a página inicial apresenta a legislação com procedência e o contato", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Legislação com procedência" })).toBeVisible();
    for (const garantia of ["Fonte oficial em cada norma", "Conferência artigo por artigo", "Dupla revisão", "Integridade verificada todo dia"]) {
      await expect(page.getByText(garantia, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/vale o Diário Oficial/)).toBeVisible();
    await page.getByRole("contentinfo").getByRole("link", { name: "Contato" }).first().click();
    await expect(page).toHaveURL(/\/contato$/);
    await expect(page.getByRole("heading", { name: "Fale com a gente" })).toBeVisible();
  });

  test("o formulário de contato valida a mensagem", async ({ page }) => {
    await page.goto("/contato");
    await page.getByLabel("Nome").fill("Visitante de Teste");
    await page.getByLabel("E-mail para a resposta").fill("visitante@causidico.test");
    await page.getByLabel("Assunto").selectOption("sugestao");
    await page.getByLabel("Mensagem", { exact: true }).fill("curta");
    await page.getByLabel("Mensagem", { exact: true }).evaluate((el) => el.removeAttribute("minlength"));
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByText("Escreva sua mensagem.")).toBeVisible();
  });

  for (const rota of ["/termos", "/privacidade", "/cancelamento-e-reembolso", "/acessibilidade", "/privacidade/solicitacao", "/planos"]) {
    test(`${rota} abre e tem o link de contato no rodapé`, async ({ page }) => {
      const r = await page.goto(rota);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "Contato" }).first()).toBeVisible();
    });
  }

  test("a política de privacidade informa a guarda das mensagens de contato", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("cell", { name: "Mensagens do formulário de contato" })).toBeVisible();
  });
});
