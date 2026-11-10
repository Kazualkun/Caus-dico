import { expect, test } from "@playwright/test";
import { calcularPrazo, DIAS_USUAIS_POR_JUSTICA, type ParametrosPrazo } from "../../src/lib/prazos/calculo";
import { banco, iaNoAr, sessao, TEMPO_IA } from "./apoio";

/*
 * Prazos, clientes (CRM), link de triagem e recomendação de peça, com a conta
 * do assinante. Os itens criados ficam na conta para consulta.
 */
test.use({ storageState: sessao("assinante") });

test.describe("cálculo de prazos (casos conferidos à mão)", () => {
  const base = (p: Partial<ParametrosPrazo>): ParametrosPrazo => ({
    ramo: "civel",
    forma: "intimacao",
    data: "2026-03-02",
    dias: 15,
    emDobro: false,
    semSuspensaoFimDeAno: false,
    diasUsuais: DIAS_USUAIS_POR_JUSTICA.estadual,
    diasInformados: [],
    ...p,
  });
  const casos: [string, Partial<ParametrosPrazo>, string][] = [
    ["CPC 15 dias úteis, DJe disponibilizado em 02/03/2026", { forma: "dje" }, "2026-03-24"],
    ["CPP 5 dias, intimação na sexta (Súmula 310 do STF)", { ramo: "penal", data: "2026-03-06", dias: 5 }, "2026-03-13"],
    ["CPP vencendo no domingo é prorrogado para segunda", { ramo: "penal", data: "2026-03-03", dias: 5 }, "2026-03-09"],
    ["CPC com suspensão de 20/12 a 20/01 e Carnaval", { forma: "dje", data: "2026-12-17" }, "2027-02-12"],
    ["CLT 8 dias úteis com o feriado de 20/11", { ramo: "trabalhista", data: "2026-11-19", dias: 8 }, "2026-12-02"],
    ["CPP réu preso: sem suspensão, vence no Natal e vai para 28/12", { ramo: "penal", data: "2026-12-18", dias: 5, semSuspensaoFimDeAno: true }, "2026-12-28"],
    ["CPP com a suspensão do art. 798-A", { ramo: "penal", data: "2026-12-18", dias: 5 }, "2027-01-25"],
    ["CPP: Quarta-feira de Cinzas pode iniciar o prazo", { ramo: "penal", data: "2027-02-05", dias: 3, diasUsuais: ["carnaval", "sextaSanta", "cinzas"] }, "2027-02-12"],
    ["CPC: Quarta-feira de Cinzas não inicia o prazo", { data: "2027-02-05", dias: 3, diasUsuais: ["carnaval", "sextaSanta", "cinzas"] }, "2027-02-15"],
    ["Justiça Federal: Semana Santa (Lei 5.010/1966)", { data: "2026-03-30", dias: 5, diasUsuais: DIAS_USUAIS_POR_JUSTICA.federal }, "2026-04-09"],
    ["Justiça Estadual: só a Sexta-feira da Paixão", { data: "2026-03-30", dias: 5 }, "2026-04-07"],
    ["Prazo em dobro (30 dias úteis)", { emDobro: true }, "2026-04-14"],
    ["Feriado municipal informado pelo advogado", { dias: 5, diasInformados: [{ data: "2026-03-05", descricao: "Aniversário da cidade" }] }, "2026-03-10"],
  ];
  for (const [nome, p, esperado] of casos) {
    test(nome, () => {
      expect(calcularPrazo(base(p)).vencimento).toBe(esperado);
    });
  }
});

test.describe("prazos", () => {
  test("calcula, mostra a linha do tempo e salva o prazo num processo", async ({ page }) => {
    const marca = Date.now();
    await page.goto("/painel/prazos");
    // Sem processos, o formulário já vem aberto; com processos, abre pelo título.
    const nomeDoProcesso = page.getByLabel("Nome do processo");
    if (!(await nomeDoProcesso.isVisible())) await page.getByText("Cadastrar processo").click();
    await nomeDoProcesso.fill(`Teste ${marca}: indenização x Banco`);
    await page.getByRole("button", { name: "Criar processo" }).click();
    await expect(page).toHaveURL(/\/painel\/prazos\/processos\/[0-9a-f-]{36}$/);

    await page.goto("/painel/prazos");
    await page.getByLabel("Data da disponibilização no DJe").fill("2026-03-02");
    await page.getByLabel("Prazo (dias)").fill("15");
    await expect(page.getByText("24/03/2026 (terça-feira)").first()).toBeVisible();
    await expect(page.getByText(/Considera-se publicado/)).toBeVisible();
    await page.getByLabel("Prazo", { exact: true }).fill("Contestação");
    await page.getByLabel("Processo", { exact: true }).selectOption({ label: `Teste ${marca}: indenização x Banco` });
    await page.getByRole("button", { name: "Salvar prazo" }).click();
    await expect(page.getByText("Prazo salvo na linha do tempo.")).toBeVisible();
    await expect(page.getByRole("link", { name: `Teste ${marca}: indenização x Banco` }).first()).toBeVisible();
  });
});

test.describe("clientes e triagem", () => {
  test("cadastra um cliente e abre a ficha", async ({ page }) => {
    await page.goto("/painel/clientes");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar cliente" }) });
    await form.getByLabel("Nome", { exact: true }).fill("Cliente Teste CRM");
    await form.getByLabel("Telefone ou WhatsApp").fill("(11) 98888-7777");
    await form.getByLabel("Indicado por (opcional)").fill("Dra. Ana, OAB/SP");
    await form.getByRole("button", { name: "Cadastrar cliente" }).click();
    await expect(page).toHaveURL(/\/painel\/clientes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Cliente Teste CRM" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Recomendar peça" })).toBeVisible();
  });

  test("proposta salva entra no CRM e, aceita, torna o lead cliente", async ({ page }) => {
    const nome = `Cliente Proposta ${Date.now()}`;
    await page.goto("/painel/honorarios");
    await page.getByLabel("Cliente", { exact: true }).fill(nome);
    await page.getByLabel("Assunto").fill("Ação de cobrança de aluguéis");
    await page.getByRole("button", { name: "Salvar e abrir a proposta" }).click();
    await expect(page).toHaveURL(/\/painel\/honorarios\/[0-9a-f-]{36}$/);
    await page.getByLabel("Situação da proposta").selectOption("aceita");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Abrir o cliente" }).click();
    await expect(page.getByRole("heading", { name: nome })).toBeVisible();
    await expect(page.getByText(/^Cliente · origem: proposta da calculadora/)).toBeVisible();
  });

  test("o link de triagem recebe um caso sem login e o caso chega como lead", async ({ page, browser }) => {
    await page.goto("/painel/clientes");
    const link = (await page.locator("p.font-mono").first().textContent())!.trim();
    expect(link).toMatch(/\/triagem\/[a-z0-9]{12}$/);

    // Futuro cliente, sem conta e sem sessão.
    const anonimo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await anonimo.newPage();
    await p.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await expect(p.getByRole("heading", { name: "Conte sobre o seu caso" })).toBeVisible();
    await expect(p.getByText("Como seus dados são usados")).toBeVisible();
    const nome = `Lead Triagem ${Date.now()}`;
    await p.getByLabel("Seu nome").fill(nome);
    await p.getByLabel("Telefone ou WhatsApp, com DDD").fill("(21) 97777-6666");
    await p.getByLabel("Sobre o que é o seu caso?").selectOption("consumidor");
    await p
      .getByLabel("Conte o que aconteceu")
      .fill("Paguei a última parcela do cartão em junho, mas o banco continuou cobrando juros e colocou meu nome no Serasa.");
    await p.getByRole("checkbox").check();
    await p.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(p.getByText("Respostas enviadas")).toBeVisible();
    await anonimo.close();

    await page.goto("/painel/clientes?status=lead");
    await expect(page.getByRole("link", { name: nome }).first()).toBeVisible();
    const { rows } = await banco().query("select origem, status from clientes where nome = $1", [nome]);
    expect(rows[0]).toEqual({ origem: "triagem", status: "lead" });
  });

  test("um link de triagem inexistente mostra que está indisponível", async ({ browser }) => {
    const anonimo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await anonimo.newPage();
    await p.goto("/triagem/naoexiste2345");
    await expect(p.getByRole("heading", { name: "Link indisponível" })).toBeVisible();
    await anonimo.close();
  });
});

test.describe("peças", () => {
  test("recomenda a peça a partir dos fatos, sem redigi-la", async ({ page }) => {
    const ia = await iaNoAr();
    test.setTimeout(ia ? TEMPO_IA : 150_000);
    await page.goto("/painel/pecas");
    await page.getByRole("radio", { name: /Autor/ }).check();
    await page.getByLabel("Área").selectOption("consumidor");
    await page.getByLabel("Nome do caso (opcional)").fill("Teste: negativação após quitação");
    await page
      .getByLabel("Fatos do caso")
      .fill(
        "O cliente quitou o financiamento de um veículo em janeiro de 2026 e recebeu a carta de quitação. Mesmo assim, o banco manteve o nome dele nos cadastros de inadimplentes por oito meses, o que o impediu de obter um financiamento imobiliário. Ele tem os comprovantes de pagamento e a carta.",
      );
    await page.getByLabel("O que o cliente quer (opcional)").fill("Retirar o nome dos cadastros e ser indenizado.");
    await page.getByRole("button", { name: "Recomendar peça" }).click();
    await expect(page).toHaveURL(/\/painel\/pecas\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    if (ia) {
      await expect(page.getByText("Peça recomendada", { exact: true })).toBeVisible({ timeout: TEMPO_IA - 60_000 });
      await expect(page.getByRole("heading", { name: "Requisitos legais da peça" })).toBeVisible();
      await expect(page.getByText("não redige peças", { exact: false })).toBeVisible();
    } else {
      await expect(page.getByText("O serviço de IA está indisponível no momento.", { exact: false })).toBeVisible({ timeout: 90_000 });
    }
  });
});
