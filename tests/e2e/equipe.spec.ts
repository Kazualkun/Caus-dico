import { expect, test, type Browser } from "@playwright/test";
import { banco, sessao, type Papel } from "./apoio";

/*
 * Administração: desempenho, faturamento, contato e a curadoria do acervo com
 * dupla revisão (um propõe, outro aprova). E as fronteiras de cada papel.
 */

async function comoPapel(browser: Browser, papel: Papel) {
  const contexto = await browser.newContext({ storageState: sessao(papel) });
  return { contexto, pagina: await contexto.newPage() };
}

test.describe("painéis de gestão", () => {
  test.use({ storageState: sessao("admin") });

  test("desempenho mostra clientes, receita e gráficos em cada período", async ({ page }) => {
    await page.goto("/admin/desempenho");
    for (const rotulo of ["Clientes cadastrados", "Assinantes ativos", "Receita recorrente mensal", "Ticket médio"]) {
      await expect(page.getByText(rotulo, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Novos clientes por dia")).toBeVisible();
    await expect(page.getByText("Receita recebida por mês (R$), últimos 12 meses")).toBeVisible();
    await expect(page.getByText("Uso dos módulos em 30 dias")).toBeVisible();
    await page.getByRole("link", { name: "12 meses" }).click();
    await expect(page).toHaveURL(/dias=365/);
    await expect(page.getByText("Novos clientes por mês")).toBeVisible();
    await expect(page.getByRole("link", { name: "assinante@causidico.test" }).or(page.getByText("assinante@causidico.test")).first()).toBeVisible();
  });

  test("faturamento lista o pagamento da assinatura de teste e exporta CSV", async ({ page }) => {
    await page.goto("/admin/faturamento");
    await expect(page.getByText("Recebido (bruto)")).toBeVisible();
    await expect(page.getByText("Conferência entre assinaturas e cobranças")).toBeVisible();
    // O pagamento de teste foi há 10 dias: pode cair no mês anterior.
    const meses = page.locator("section", { hasText: "Últimos 12 meses" });
    await expect(meses.getByRole("cell", { name: /R\$\s?189,00/ }).first()).toBeVisible();

    const csv = await page.request.get(`/admin/faturamento/csv?mes=${new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 7)}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const texto = await csv.text();
    expect(texto).toContain("Cobrança;Situação;Assinante");
    expect(texto).toContain("assinante@causidico.test");
    expect(texto).toContain("189,00");
  });

  test("responde a mensagem de contato e o e-mail vai para a caixa de saída", async ({ page, browser }) => {
    const marca = `#${Date.now()}`;
    const { contexto, pagina } = await comoPapel(browser, "novo");
    await pagina.goto("/contato");
    await pagina.getByLabel("Assunto").selectOption("duvida");
    await pagina.getByLabel("Mensagem", { exact: true }).fill(`Teste automatizado ${marca}: o plano Básico inclui a pesquisa com IA?`);
    await pagina.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(pagina.getByText(/protocolo/)).toBeVisible();
    await contexto.close();

    await page.goto("/admin/contato");
    const linha = page.getByRole("row").filter({ hasText: marca });
    await linha.getByRole("textbox").fill(`Sim ${marca}: todos os planos incluem a pesquisa com IA, com limites mensais diferentes.`);
    await linha.getByRole("button", { name: "Responder" }).click();
    // Respondida, a mensagem sai da fila e vai para o histórico.
    await expect(page.getByRole("row").filter({ hasText: `Sim ${marca}` })).toContainText("Respondida em");

    const { rows } = await banco().query("select assunto from emails_saida where para = 'novo@causidico.test' order by id desc limit 1");
    expect(rows[0]?.assunto).toMatch(/Resposta à sua mensagem/);
  });
});

test.describe("curadoria do acervo", () => {
  test.describe.configure({ mode: "serial" });
  const TITULO = "Norma de teste da curadoria automatizada";
  let base: { id: string; fonte_url: string; texto: string };

  test.beforeAll(async () => {
    // Uma norma real cuja fonte oficial (Câmara dos Deputados) responde a leitura automática.
    const { rows } = await banco().query(
      `select id, fonte_url, texto from normas where fonte_url like 'https://www2.camara.leg.br/%' and removida_em is null
          and not curada and tamanho between 3000 and 20000 order by ano desc nulls last limit 1`,
    );
    base = rows[0];
  });

  test.afterAll(async () => {
    const db = banco();
    const { rows } = await db.query("select id from normas where titulo = $1", [TITULO]);
    const ids = [...rows.map((r) => r.id), base.id];
    await db.query("delete from normas_revisoes where norma_id = any($1::bigint[]) or dados->>'titulo' = $2", [ids, TITULO]);
    await db.query("delete from normas where titulo = $1", [TITULO]);
    await db.query("update normas set conferida_em = null, conferencia = null, hash_texto = null where id = $1", [base.id]);
  });

  test("inclusão: o dev propõe, a conferência confere e o admin aprova", async ({ browser }) => {
    const dev = await comoPapel(browser, "dev");
    await dev.pagina.goto("/admin/acervo/normas/nova");
    await dev.pagina.getByLabel("Categoria").selectOption("resolucoes");
    await dev.pagina.getByLabel("Tipo", { exact: true }).fill("Resolução");
    await dev.pagina.getByLabel("Número").fill("9999");
    await dev.pagina.getByLabel("Data de assinatura").fill("2026-06-16");
    await dev.pagina.getByLabel("Título").fill(TITULO);
    await dev.pagina.getByLabel("Ementa oficial").fill("Norma usada só pelos testes automatizados.");
    await dev.pagina.getByLabel("Link da fonte oficial").fill(base.fonte_url);
    await dev.pagina.getByLabel("Texto integral").fill(base.texto);
    await dev.pagina.getByLabel("Por que incluir").fill("Teste automatizado do fluxo de inclusão com dupla revisão.");
    await dev.pagina.getByRole("button", { name: "Enviar inclusão para revisão" }).click();
    await expect(dev.pagina).toHaveURL(/\/admin\/acervo\/revisoes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await expect(dev.pagina.getByText("Confere com a fonte oficial", { exact: true })).toBeVisible();
    // Quem propõe não aprova.
    await expect(dev.pagina.getByRole("button", { name: "Aprovar e publicar" })).toHaveCount(0);
    await expect(dev.pagina.getByText("Quem propõe não aprova a própria alteração")).toBeVisible();
    const endereco = dev.pagina.url();
    await dev.contexto.close();

    const admin = await comoPapel(browser, "admin");
    await admin.pagina.goto(endereco);
    await admin.pagina.getByLabel(/Abri a fonte oficial e conferi/).check();
    await admin.pagina.getByRole("button", { name: "Aprovar e publicar" }).click();
    // Publicada, a página é revalidada e mostra a nova situação no lugar do formulário.
    await expect(admin.pagina.getByRole("definition").filter({ hasText: /^Aprovada$/ })).toBeVisible();
    await expect(admin.pagina.getByText(/por admin@causidico\.test/)).toBeVisible();
    await admin.contexto.close();

    const assinante = await comoPapel(browser, "assinante");
    const { rows } = await banco().query("select id, fonte, curada, conferida_em from normas where titulo = $1", [TITULO]);
    expect(rows[0]).toMatchObject({ fonte: "curadoria", curada: true });
    await assinante.pagina.goto(`/painel/acervo/${rows[0].id}`);
    await expect(assinante.pagina.getByRole("heading", { name: "Texto conferido com a fonte oficial" })).toBeVisible();
    await expect(assinante.pagina.getByText(/Conferido por dois revisores/)).toBeVisible();
    await assinante.contexto.close();
  });

  test("correção divergente: precisa de parecer e pode ser rejeitada", async ({ browser }) => {
    const admin = await comoPapel(browser, "admin");
    await admin.pagina.goto(`/admin/acervo/normas/${base.id}/editar`);
    const texto = admin.pagina.getByLabel("Texto integral");
    const original = await texto.inputValue();
    const alterado = original.replace(/(\*\*Art\. 1º\*\*\s*)/, "$1Trecho inventado para o teste. ");
    // Em textos longos, o preenchimento direto às vezes insere em vez de substituir: limpa antes e confere.
    await texto.clear();
    await texto.fill(alterado);
    await expect(texto).toHaveValue(alterado);
    await admin.pagina.getByLabel("O que mudou e por quê").fill("Teste automatizado: correção que diverge da fonte oficial.");
    await admin.pagina.getByRole("button", { name: "Enviar correção para revisão" }).click();
    await expect(admin.pagina).toHaveURL(/\/admin\/acervo\/revisoes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await expect(admin.pagina.getByText("Diverge da fonte oficial", { exact: true })).toBeVisible();
    await expect(admin.pagina.getByText("Art. 1º").first()).toBeVisible();
    // Salvar sem mexer nos dados não troca a categoria nem outro campo.
    await expect(admin.pagina.getByRole("heading", { name: "Dados alterados" })).toHaveCount(0);
    const endereco = admin.pagina.url();
    await admin.contexto.close();

    const dev = await comoPapel(browser, "dev");
    await dev.pagina.goto(endereco);
    await expect(dev.pagina.getByText(/Texto alterado \(1 trecho\)/)).toBeVisible();
    await dev.pagina.getByLabel("Motivo").fill("O trecho incluído não existe na publicação oficial.");
    await dev.pagina.getByRole("button", { name: "Rejeitar" }).click();
    await expect(dev.pagina.getByRole("definition").filter({ hasText: /^Rejeitada$/ })).toBeVisible();
    await expect(dev.pagina.getByText("O trecho incluído não existe na publicação oficial.")).toBeVisible();
    await dev.contexto.close();
  });

  test("conferência: todos os artigos batem e é registrada na hora", async ({ browser }) => {
    const admin = await comoPapel(browser, "admin");
    await admin.pagina.goto(`/admin/acervo/normas/${base.id}`);
    await admin.pagina.getByRole("button", { name: "Conferir com a fonte oficial" }).click();
    await expect(admin.pagina.getByText("Todos os artigos batem com a fonte oficial. A conferência foi registrada.")).toBeVisible({ timeout: 60_000 });
    await admin.pagina.reload();
    await expect(admin.pagina.getByText(/Conferida em .* \(automática\)/)).toBeVisible();
    await admin.contexto.close();
  });

  test("integridade: detecta texto alterado fora da curadoria", async ({ browser }) => {
    await banco().query("update normas set texto = texto || ' ' where id = $1", [base.id]);
    const admin = await comoPapel(browser, "admin");
    await admin.pagina.goto("/admin/acervo/curadoria");
    await admin.pagina.getByRole("button", { name: "Verificar agora" }).click();
    await expect(admin.pagina.getByText(/com o texto alterado fora da curadoria/)).toBeVisible();
    // Restaurado o texto, a nova verificação volta a dar tudo íntegro (e não deixa alerta falso na tela).
    await banco().query("update normas set texto = rtrim(texto) where id = $1", [base.id]);
    await admin.pagina.getByRole("button", { name: "Verificar agora" }).click();
    await expect(admin.pagina.getByText("Todos os textos conferidos estão íntegros.").first()).toBeVisible();
    await admin.contexto.close();
  });
});

test.describe("fronteiras de cada papel", () => {
  test("suporte atende o contato, mas não vê faturamento nem curadoria", async ({ browser }) => {
    const { contexto, pagina } = await comoPapel(browser, "suporte");
    await pagina.goto("/admin/contato");
    await expect(pagina.getByRole("heading", { name: "Contato" })).toBeVisible();
    const nav = pagina.getByRole("navigation", { name: "Administração" });
    await expect(nav.getByRole("link", { name: "Faturamento" })).toHaveCount(0);
    // Com streaming, a página "não encontrada" chega com status 200, mas sem nada da área restrita.
    for (const rota of ["/admin/desempenho", "/admin/faturamento", "/admin/acervo/curadoria"]) {
      await pagina.goto(rota);
      await expect(pagina.getByRole("heading", { name: "404" }), rota).toBeVisible();
      await expect(pagina.getByText(/Clientes cadastrados|Recebido \(bruto\)|Aguardando revisão/)).toHaveCount(0);
    }
    expect((await pagina.request.get("/admin/faturamento/csv")).status()).toBe(404);
    await contexto.close();
  });

  test("cliente sem assinatura não entra na administração nem nos módulos", async ({ browser }) => {
    const { contexto, pagina } = await comoPapel(browser, "novo");
    await pagina.goto("/admin");
    await expect(pagina.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(pagina.getByRole("navigation", { name: "Administração" })).toHaveCount(0);
    await pagina.goto("/painel/honorarios");
    await expect(pagina).toHaveURL(/\/planos/);
    await contexto.close();
  });
});
