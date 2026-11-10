import { defineConfig, devices } from "@playwright/test";

/*
 * Testes de ponta a ponta no navegador, contra o servidor local e o banco local.
 *
 *   npm run usuario:teste   (uma vez: cria as contas de teste e grava as credenciais)
 *   npm run test:e2e
 *
 * Os testes de IA (auditoria, pesquisa, análise do caso, explicação) só rodam com a
 * IA local no ar (npm run ia:iniciar); sem ela, verificam que a falha é tratada.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // usa as variáveis do ambiente
}

export default defineConfig({
  testDir: "tests/e2e",
  // Um teste por vez: os cenários compartilham o mesmo banco.
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "sessoes", testMatch: /sessoes\.setup\.ts/ },
    { name: "e2e", dependencies: ["sessoes"], use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
