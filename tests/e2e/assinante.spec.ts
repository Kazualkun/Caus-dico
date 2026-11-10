import { readFileSync } from "node:fs";
import { Document, Packer, Paragraph } from "docx";
import { expect, test, type Page } from "@playwright/test";
import { banco, iaNoAr, sessao, TEMPO_IA } from "./apoio";

/*
 * Tudo o que o assinante do plano Profissional faz. Os itens criados aqui
 * (propostas, auditorias, pesquisa) ficam na conta para consulta.
 */
test.use({ storageState: sessao("assinante") });

const contrato = (arquivo: string) => readFileSync(`tests/e2e/fixtures/contratos/${arquivo}`, "utf8");
const AUDITORIAS = [
  { arquivo: "prestacao-servicos-ti.txt", titulo: "Teste: prestação de serviços de TI", perspectiva: "Contratante" },
  { arquivo: "locacao-residencial.txt", titulo: "Teste: locação residencial", perspectiva: "Revisão neutra" },
  { arquivo: "confidencialidade.txt", titulo: "Teste: acordo de confidencialidade", perspectiva: "Contratado(a)" },
];

/** Espera a tarefa de IA terminar: com a IA no ar, o resultado; sem ela, o erro tratado na tela. */
async function esperarTarefa(pagina: Page, ia: boolean, sucesso: RegExp) {
  if (ia) {
    await expect(pagina.getByText(sucesso).first()).toBeVisible({ timeout: TEMPO_IA - 60_000 });
  } else {
    // Sem a IA local, a tarefa falha com uma mensagem clara, sem detalhe técnico.
    await expect(pagina.getByText("O serviço de IA está indisponível no momento.", { exact: false })).toBeVisible({ timeout: 90_000 });
    await expect(pagina.getByText(/ECONNREFUSED|fetch failed|ollama/i)).toHaveCount(0);
  }
}

test.describe("painel do assinante", () => {
  test("abre o painel e os módulos do plano", async ({ page }) => {
    await page.goto("/painel");
    for (const modulo of ["Clientes", "Honorários", "Contratos", "Peças", "Pesquisa com IA", "Prazos", "Acervo de legislação", "Minha conta", "Fale conosco"]) {
      await expect(page.getByRole("navigation", { name: "Módulos" }).getByRole("link", { name: modulo })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
  });
});

test.describe("honorários", () => {
  for (const caso of [
    { cliente: "Cliente Teste Cível", assunto: "Ação revisional de contrato bancário", horas: "40", causa: "120.000" },
    { cliente: "Cliente Teste Trabalhista", assunto: "Reclamação trabalhista com pedido de horas extras", horas: "25", causa: "45.000" },
  ]) {
    test(`calcula, salva a proposta e gera o PDF (${caso.cliente})`, async ({ page }) => {
      await page.goto("/painel/honorarios");
      await page.getByLabel("Horas estimadas para o caso").fill(caso.horas);
      await page.getByLabel("Valor da causa ou proveito econômico (R$)").fill(caso.causa);
      await expect(page.getByText(/R\$\s?\d/).filter({ visible: true }).first()).toBeVisible();
      await page.getByLabel("Cliente", { exact: true }).fill(caso.cliente);
      await page.getByLabel("Assunto").fill(caso.assunto);
      await page.getByRole("button", { name: "Salvar e abrir a proposta" }).click();
      await expect(page).toHaveURL(/\/painel\/honorarios\/[0-9a-f-]{36}$/);
      await expect(page.getByText(caso.cliente).first()).toBeVisible();

      const href = await page.getByRole("link", { name: "Baixar PDF" }).getAttribute("href");
      const pdf = await page.request.get(href!);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    });
  }

  test("o mínimo aceitável inclui impostos e o repasse por indicação", async ({ page }) => {
    await page.goto("/painel/honorarios");
    await page.getByLabel("Impostos sobre os honorários (%)").fill("10");
    await page.getByText("O cliente veio por indicação de outro advogado").click();
    await page.getByLabel("Repasse ao advogado que indicou (% dos honorários)").fill("20");
    await expect(page.getByText(/O mínimo aceitável já inclui os impostos \(10%\) e o repasse por indicação \(20%\)/)).toBeVisible();
    await expect(page.getByText("Repasse por indicação (20%)", { exact: true })).toBeVisible();
    await expect(page.getByText("Fica com você")).toBeVisible();
    await expect(page.getByText(/Estatuto da Advocacia, art\. 34/)).toBeVisible();
  });

  test("analisa o caso com IA sem guardar o texto enviado", async ({ page }) => {
    const ia = await iaNoAr();
    test.setTimeout(ia ? TEMPO_IA : 150_000);
    const marca = `marca-${Date.now()}`;
    await page.goto("/painel/honorarios");
    await page
      .getByLabel("Resumo do caso")
      .fill(
        `Cliente (CPF 123.456.789-09, ${marca}) quitou o financiamento do carro em 2024, mas o banco manteve o nome dele negativado por oito meses. Tem os comprovantes e a carta de quitação. Perdeu um financiamento imobiliário por causa disso.`,
      );
    await page.getByRole("button", { name: "Analisar caso" }).click();
    if (ia) {
      await expect(page.getByText("Por que essa complexidade:")).toBeVisible({ timeout: TEMPO_IA - 60_000 });
      await expect(page.getByText(/dado\(s\) pessoal\(is\) foram mascarados/)).toBeVisible();
      await page.getByRole("button", { name: "Usar na calculadora" }).click();
      await expect(page.getByText("Área, complexidade e risco aplicados.", { exact: false })).toBeVisible();
    } else {
      await expect(page.getByText("O serviço de IA está indisponível no momento.", { exact: false })).toBeVisible({ timeout: 90_000 });
    }
    // Nada do que foi enviado fica no banco, nem em erro registrado no uso da IA.
    const { rows } = await banco().query(
      `select (select count(*) from ai_usage where erro like $1)::int
            + (select count(*) from pricing_proposals where case_title like $1 or client_name like $1)::int as n`,
      [`%${marca}%`],
    );
    expect(rows[0].n).toBe(0);
  });
});

test.describe("auditoria de contratos", () => {
  for (const a of AUDITORIAS) {
    test(`audita "${a.titulo}" (texto colado)`, async ({ page }) => {
      const ia = await iaNoAr();
      test.setTimeout(ia ? TEMPO_IA : 150_000);
      await page.goto("/painel/contratos");
      await page.getByLabel("Nome do contrato").fill(a.titulo);
      await page.getByRole("radio", { name: a.perspectiva }).check();
      await page.getByRole("radio", { name: "Colar texto" }).click();
      await page.getByPlaceholder(/Cole aqui o texto integral do contrato/).fill(contrato(a.arquivo));
      await page.getByRole("button", { name: "Auditar contrato" }).click();
      await expect(page).toHaveURL(/\/painel\/contratos\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { name: a.titulo })).toBeVisible();
      await esperarTarefa(page, ia, /^Achados$/);
      if (ia) {
        await expect(page.locator("section[aria-labelledby='titulo-achados'] h3").first()).toBeVisible();
        // A IA orienta, não redige: não há redação pronta de cláusula.
        await expect(page.getByText("Redação sugerida")).toHaveCount(0);
      }
    });
  }

  test("audita um contrato enviado em DOCX", async ({ page }) => {
    const ia = await iaNoAr();
    test.setTimeout(ia ? TEMPO_IA : 150_000);
    const doc = new Document({ sections: [{ children: contrato("prestacao-servicos-ti.txt").split("\n").map((l) => new Paragraph(l)) }] });
    const buffer = await Packer.toBuffer(doc);
    await page.goto("/painel/contratos");
    await page.getByLabel("Nome do contrato").fill("Teste: contrato em DOCX");
    await page.locator("input[type=file][name=arquivo]").setInputFiles({
      name: "contrato-ti.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    });
    await expect(page.getByText("contrato-ti.docx")).toBeVisible();
    await page.getByRole("button", { name: "Auditar contrato" }).click();
    await expect(page).toHaveURL(/\/painel\/contratos\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await esperarTarefa(page, ia, /^Achados$/);
  });

  test("não oferece geração de minutas (a IA não redige)", async ({ page }) => {
    await page.goto("/painel/contratos");
    await expect(page.getByRole("button", { name: "Auditar contrato" })).toBeVisible();
    await expect(page.getByText(/gerar minuta/i)).toHaveCount(0);
  });

  test("recusa contrato acima do limite da IA local antes de enviar", async ({ page }) => {
    await page.goto("/painel/contratos");
    await page.getByRole("radio", { name: "Colar texto" }).click();
    await page.getByPlaceholder(/Cole aqui o texto integral do contrato/).fill("Cláusula de teste. ".repeat(3000));
    await page.getByRole("button", { name: "Auditar contrato" }).click();
    await expect(page.getByText(/Divida o contrato em partes/)).toBeVisible();
    await expect(page).toHaveURL(/\/painel\/contratos$/);
  });
});

test.describe("pesquisa com IA", () => {
  test("registra uma pesquisa e recomenda a peça sem redigi-la", async ({ page }) => {
    const ia = await iaNoAr();
    test.setTimeout(ia ? TEMPO_IA : 150_000);
    await page.goto("/painel/pesquisa");
    await expect(page.getByRole("heading", { name: "Nosso compromisso com o texto da lei" })).toBeVisible();
    await page.getByLabel("Dúvida ou tese").fill("Multa rescisória de 100% das parcelas vincendas em contrato de prestação de serviços é abusiva?");
    await page.getByRole("button", { name: "Pesquisar" }).click();
    await expect(page).toHaveURL(/\/painel\/pesquisa\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await esperarTarefa(page, ia, /^Tese central$/);
    if (ia) {
      await expect(page.getByRole("heading", { name: "Peça recomendada" })).toBeVisible();
      await expect(page.getByText("Roteiro de peça")).toHaveCount(0);
    }
  });
});

test.describe("acervo de legislação", () => {
  test("mostra o panorama e o compromisso com a fonte oficial", async ({ page }) => {
    await page.goto("/painel/acervo");
    await expect(page.getByRole("heading", { name: "Nosso compromisso com o texto da lei" })).toBeVisible();
    await expect(page.getByText(/normas já conferidas individualmente/)).toBeVisible();
  });

  test("mostra a cobertura e avisa que a legislação municipal é parcial", async ({ page }) => {
    await page.goto("/painel/acervo");
    await expect(page.getByRole("heading", { name: "O que o acervo cobre" })).toBeVisible();
    await expect(page.getByText("Municipal: parcial.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Cobertura do acervo por série de normas" })).toBeVisible();
    await page.goto("/painel/acervo?q=plano+diretor&esfera=municipal");
    await expect(page.getByText(/A legislação municipal do acervo é parcial/)).toBeVisible();
  });

  test("encontra o Código de Defesa do Consumidor e abre o art. 49", async ({ page }) => {
    await page.goto("/painel/acervo?q=lei+8.078%2F90");
    const resultado = page.getByRole("link", { name: /Código de Defesa do Consumidor|Lei nº 8\.078/ }).first();
    await expect(resultado).toBeVisible();
    await resultado.click();
    await expect(page).toHaveURL(/\/painel\/acervo\/\d+/);
    await expect(page.getByRole("heading", { name: /Texto (conferido|ainda não conferido)/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Fonte oficial" })).toHaveAttribute("href", /^https?:\/\//);
    await page.goto(`${page.url().split("#")[0]}#art-49`);
    await expect(page.getByText(/prazo de 7 dias|sete dias/i).first()).toBeVisible();
  });

  test("busca dentro dos artigos", async ({ page }) => {
    await page.goto("/painel/acervo?q=direito+de+arrependimento&modo=texto&esfera=federal");
    await expect(page.getByText(/resultados?/).first()).toBeVisible();
    await expect(page.locator("ol li").first()).toBeVisible();
  });

  test("explica uma norma em linguagem simples", async ({ page }) => {
    test.skip(!(await iaNoAr()), "Precisa da IA local no ar (npm run ia:iniciar)");
    test.setTimeout(TEMPO_IA);
    await page.goto("/painel/acervo?q=lei+13.709");
    await page.getByRole("link", { name: /Lei Geral de Proteção de Dados|Lei nº 13\.709/ }).first().click();
    const botao = page.getByRole("button", { name: "Explicar em linguagem simples" });
    const explicacao = page.getByRole("heading", { name: "Em linguagem simples" });
    // isVisible() não espera: sem isto, com a página ainda carregando, o botão nunca era clicado.
    await expect(botao.or(explicacao)).toBeVisible();
    if (await botao.isVisible()) await botao.click();
    await expect(explicacao).toBeVisible({ timeout: TEMPO_IA - 60_000 });
  });
});

test.describe("minha conta", () => {
  test("atualiza o escritório e baixa os próprios dados (LGPD)", async ({ page }) => {
    await page.goto("/painel/conta");
    await page.getByLabel("Escritório (aparece nas propostas)").fill("Escritório Teste Advocacia");
    await page.getByRole("button", { name: "Salvar dados" }).click();
    await expect(page.getByText("Dados atualizados.")).toBeVisible();

    const dados = await page.request.get("/api/conta/dados");
    expect(dados.status()).toBe(200);
    const json = await dados.json();
    expect(json.perfil.email).toBe("assinante@causidico.test");
    expect(json.perfil.escritorio).toBe("Escritório Teste Advocacia");
  });
});

test.describe("contato", () => {
  test("envia uma mensagem pelo formulário de contato", async ({ page }) => {
    await page.goto("/contato?assunto=assinatura");
    await expect(page.getByLabel("E-mail para a resposta")).toHaveValue("assinante@causidico.test");
    await expect(page.getByLabel("Assunto")).toHaveValue("assinatura");
    await page.getByLabel("Mensagem", { exact: true }).fill("Teste automatizado: gostaria de saber como emitir a nota fiscal da assinatura.");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByText(/Mensagem enviada com o protocolo [0-9A-F]{8}/)).toBeVisible();
  });
});
