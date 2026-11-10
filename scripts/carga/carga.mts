/**
 * Teste de carga: N advogados usando o Causídico ao mesmo tempo, cada um navegando
 * (painel, acervo, prazos) e pedindo uma tarefa de IA. Mede o tempo de cada página,
 * os erros, o tempo até cada resultado da IA, a fila e o uso da máquina.
 *
 *   npx tsx scripts/carga/carga.mts --usuarios 100 --rampa 60 --duracao 1200 --saida carga.json
 *   npx tsx scripts/carga/carga.mts --limpar
 *
 * Só roda com banco local: cria contas carga-NNN@causidico.test com plano Escritório
 * e sessões gravadas direto no banco (sem passar pelo login, que tem limite por IP).
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // usa as variáveis do ambiente
}
const arg = (nome: string, padrao: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const BASE = arg("url", "http://localhost:3000");
const USUARIOS = Number(arg("usuarios", "100"));
const RAMPA_S = Number(arg("rampa", "60"));
const DURACAO_S = Number(arg("duracao", "1200"));
const SAIDA = arg("saida", "carga-resultado.json");
const ROTULO = arg("rotulo", "");
/** Proporção dos pedidos de IA: análise do caso, pesquisa, peça, auditoria. */
const MISTURA: [Tarefa, number][] = [
  ["analise_caso", 0.35],
  ["pesquisa", 0.25],
  ["peca", 0.2],
  ["auditoria", 0.2],
];
type Tarefa = "analise_caso" | "pesquisa" | "peca" | "auditoria";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  console.error("Recusado: o teste de carga só roda com o banco local (cria contas e sessões direto no banco).");
  process.exit(1);
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

const assinar = (token: string) =>
  encodeURIComponent(`${token}.${createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(token).digest("base64")}`);

async function limpar() {
  const { rows } = await db.query<{ id: string }>("select id from users where email like 'carga-%@causidico.test'");
  const ids = rows.map((r) => r.id);
  if (!ids.length) return 0;
  await db.query("update tarefas_ia set status = 'cancelada', concluida_em = now() where user_id = any($1::uuid[]) and status = 'na_fila'", [ids]);
  await db.query("delete from subscriptions where user_id = any($1::uuid[])", [ids]);
  await db.query("delete from users where id = any($1::uuid[])", [ids]);
  return ids.length;
}

async function preparar(n: number) {
  await limpar();
  const contas: { id: string; cookie: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const email = `carga-${String(i).padStart(3, "0")}@causidico.test`;
    const {
      rows: [u],
    } = await db.query<{ id: string }>(
      "insert into users (name, email, email_verified, role) values ($1, $2, true, 'usuario') returning id",
      [`Advogado de Carga ${i}`, email],
    );
    await db.query(
      `insert into subscriptions (user_id, plan, cycle, status, value_cents, current_period_end)
       values ($1, 'escritorio', 'mensal', 'ativa', 44900, now() + interval '30 days')`,
      [u.id],
    );
    const token = randomBytes(24).toString("base64url").slice(0, 32);
    await db.query("insert into sessions (token, user_id, expires_at, updated_at) values ($1, $2, now() + interval '1 day', now())", [token, u.id]);
    contas.push({ id: u.id, cookie: `causidico.session_token=${assinar(token)}` });
  }
  return contas;
}

// ---------------------------------------------------------------------------
// Medições
// ---------------------------------------------------------------------------

type Medida = { rotulo: string; ms: number; status: number; ok: boolean; t: number };
const medidas: Medida[] = [];
type ResultadoIa = {
  tipo: Tarefa;
  aceito: boolean;
  recusa?: string;
  enviadoMs: number;
  concluidoMs?: number;
  situacao: "concluido" | "erro" | "pendente" | "ocupada";
  referenciaId?: string;
};
const resultadosIa: ResultadoIa[] = [];
const serie: { t: number; cpu: number; memGb: number; conexoes: number; naFila: number; processando: number }[] = [];
const T0 = Date.now();
const agora = () => Date.now() - T0;

async function pedir(rotulo: string, caminho: string, cookie: string, init: RequestInit = {}) {
  const inicio = performance.now();
  let status = 0;
  let texto = "";
  let local = "";
  try {
    const r = await fetch(BASE + caminho, { redirect: "manual", ...init, headers: { cookie, ...(init.headers ?? {}) } });
    status = r.status;
    // Redirecionamento: "location" no envio tradicional, "x-action-redirect" na Server Action chamada por fetch.
    local = r.headers.get("location") ?? r.headers.get("x-action-redirect") ?? "";
    texto = await r.text();
  } catch {
    status = 0;
  }
  const ms = performance.now() - inicio;
  medidas.push({ rotulo, ms, status, ok: status > 0 && status < 500, t: agora() });
  return { status, texto, local };
}

/** Campos ocultos do formulário de Server Action que contém `marcador` (envio sem JavaScript). */
function camposOcultos(html: string, marcador: string) {
  const i = html.indexOf(marcador);
  const form = html.slice(html.lastIndexOf("<form", i), html.indexOf("</form>", i));
  const campos: Record<string, string> = {};
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const nome = m[0].match(/name="([^"]+)"/)?.[1];
    if (nome) campos[nome.replace(/&amp;/g, "&")] = (m[0].match(/value="([^"]*)"/)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  return campos;
}

/**
 * A análise do caso e a auditoria só funcionam com JavaScript (o formulário não tem envio tradicional):
 * chama a Server Action como o navegador, com o id dela no build local e os argumentos
 * no formato do React (estado anterior e o FormData, com os campos prefixados por "_1_").
 */
function idDaAcao(nome: string) {
  const manifesto = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")) as { node: Record<string, { exportedName: string }> };
  const id = Object.entries(manifesto.node).find(([, v]) => v.exportedName === nome)?.[0];
  if (!id) throw new Error(`Server Action ${nome} não encontrada no build (.next): rode npm run build antes do teste.`);
  return id;
}
const ACAO_ANALISE = idDaAcao("analisarCasoComIa");
const ACAO_AUDITORIA = idDaAcao("auditarContrato");

async function chamarAcao(rotulo: string, pagina: string, acao: string, campos: Record<string, string>, cookie: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(`_1_${k}`, v);
  fd.append("0", JSON.stringify(["$undefined", "$K1"]));
  return pedir(rotulo, pagina, cookie, { method: "POST", body: fd, headers: { origin: BASE, accept: "text/x-component", "next-action": acao } });
}

async function enviar(rotulo: string, pagina: string, marcador: string, campos: Record<string, string>, cookie: string) {
  const form = await pedir(`${rotulo} (formulário)`, pagina, cookie);
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...camposOcultos(form.texto, marcador), ...campos })) fd.append(k, v);
  return pedir(rotulo, pagina, cookie, { method: "POST", body: fd, headers: { origin: BASE } });
}

// ---------------------------------------------------------------------------
// Roteiro de cada advogado
// ---------------------------------------------------------------------------

const pausa = (min: number, max: number) => new Promise((r) => setTimeout(r, (min + Math.random() * (max - min)) * 1000));
const um = <T,>(lista: readonly T[]) => lista[Math.floor(Math.random() * lista.length)];
const BUSCAS = [
  ["CDC", "normas"], ["lei 8.245/91", "normas"], ["inquilinato", "normas"], ["código civil", "normas"], ["súmula 297", "normas"],
  ["dano moral", "texto"], ["prescrição honorários", "texto"], ["multa rescisória", "texto"], ["negativação indevida", "texto"], ["aviso prévio", "texto"],
] as const;
const CONTRATOS = readdirSync("tests/e2e/fixtures/contratos").map((f) => readFileSync(path.join("tests/e2e/fixtures/contratos", f), "utf8"));
const CASOS = [
  "Cliente quitou o financiamento do carro em 2024, mas o banco manteve o nome dele negativado por oito meses. Tem os comprovantes e a carta de quitação e perdeu um financiamento imobiliário por isso.",
  "Empregada doméstica trabalhou seis anos sem registro em carteira, cumpria jornada de dez horas e foi dispensada sem receber verbas rescisórias. Tem mensagens de WhatsApp e testemunhas.",
  "Locatário de imóvel comercial quer sair antes do fim do contrato de cinco anos; o contrato prevê multa de doze aluguéis integrais, sem proporcionalidade ao tempo cumprido.",
  "Consumidor comprou geladeira que parou de funcionar em vinte dias; a loja e o fabricante se recusam a trocar e mandam aguardar assistência técnica há dois meses.",
];
const PERGUNTAS = [
  "Qual o prazo prescricional para cobrar honorários advocatícios contratuais e quando ele começa a correr?",
  "A multa por rescisão antecipada em locação comercial pode ser reduzida pelo juiz quando não é proporcional?",
  "Cabe dano moral presumido pela manutenção do nome do consumidor em cadastro de inadimplentes após a quitação?",
  "Contrato bancário assinado eletronicamente sem testemunhas vale como título executivo?",
];

function sortearTarefa(): Tarefa {
  let x = Math.random();
  for (const [t, p] of MISTURA) if ((x -= p) <= 0) return t;
  return "pesquisa";
}

const TABELA = { pesquisa: "search_history", peca: "recomendacoes_peca", auditoria: "contracts" } as const;
const ROTA = { pesquisa: "/painel/pesquisa/", peca: "/painel/pecas/", auditoria: "/painel/contratos/" } as const;

async function esperarResultado(r: ResultadoIa, cookie: string, fim: number) {
  const tipo = r.tipo as keyof typeof TABELA;
  while (agora() < fim) {
    // A página de andamento se atualiza sozinha a cada 4 s (AutoRefresh).
    await pedir(`resultado de ${tipo} (atualização)`, ROTA[tipo] + r.referenciaId, cookie);
    const { rows } = await db.query<{ status: string }>(`select status from ${TABELA[tipo]} where id = $1`, [r.referenciaId]);
    if (rows[0]?.status && rows[0].status !== "processando") {
      r.situacao = rows[0].status === "concluido" ? "concluido" : "erro";
      r.concluidoMs = agora();
      return;
    }
    await pausa(4, 4);
  }
}

async function advogado(conta: { cookie: string }, normas: number[], fim: number) {
  const c = conta.cookie;
  await pedir("painel", "/painel", c);
  await pausa(2, 6);
  const [q, modo] = um(BUSCAS);
  await pedir(`acervo: busca ${modo === "texto" ? "nos artigos" : "por nome"}`, `/painel/acervo?q=${encodeURIComponent(q)}&modo=${modo}`, c);
  await pausa(2, 6);
  await pedir("acervo: norma", `/painel/acervo/${um(normas)}`, c);
  await pausa(2, 6);
  await pedir("prazos", "/painel/prazos", c);
  await pausa(1, 4);

  const tipo = sortearTarefa();
  const r: ResultadoIa = { tipo, aceito: false, enviadoMs: agora(), situacao: "pendente" };
  resultadosIa.push(r);
  if (tipo === "analise_caso") {
    await pedir("honorários", "/painel/honorarios", c);
    const resp = await chamarAcao("IA: análise do caso", "/painel/honorarios", ACAO_ANALISE, { resumo: um(CASOS) }, c);
    r.aceito = true;
    r.concluidoMs = agora();
    r.situacao = resp.texto.includes("muito ocupada") ? "ocupada" : /"complexidade":/.test(resp.texto) ? "concluido" : "erro";
    if (r.situacao === "erro") r.recusa = resp.texto.match(/"error":"([^"]+)"/)?.[1] ?? `HTTP ${resp.status}`;
  } else {
    const campos: Record<string, string> =
      tipo === "pesquisa"
        ? { pergunta: um(PERGUNTAS), area: "civel", uf: "SP", fatos: "" }
        : tipo === "peca"
          ? { polo: "autor", area: "consumidor", uf: "SP", titulo: "", fatos: um(CASOS), objetivo: "Indenização e retirada da negativação.", clienteId: "" }
          : { titulo: "Contrato de teste de carga", perspectiva: "contratante", texto: um(CONTRATOS), observacoes: "", clienteId: "" };
    const pagina = tipo === "pesquisa" ? "/painel/pesquisa" : tipo === "peca" ? "/painel/pecas" : "/painel/contratos";
    const marcador = tipo === "pesquisa" ? 'name="pergunta"' : tipo === "peca" ? 'name="fatos"' : 'name="perspectiva"';
    const resp =
      tipo === "auditoria"
        ? (await pedir("IA: pedido de auditoria (formulário)", pagina, c), await chamarAcao("IA: pedido de auditoria", pagina, ACAO_AUDITORIA, campos, c))
        : await enviar(`IA: pedido de ${tipo}`, pagina, marcador, campos, c);
    const id = resp.local.match(/[0-9a-f-]{36}/)?.[0] ?? resp.texto.match(new RegExp(`${ROTA[tipo]}([0-9a-f-]{36})`))?.[1];
    if (id) {
      r.aceito = true;
      r.referenciaId = id;
      await esperarResultado(r, c, fim);
    } else {
      r.recusa = resp.texto.match(/Você já tem[^<.]*|Você usou[^<.]*|muito ocupada[^<.]*/)?.[0] ?? `HTTP ${resp.status}`;
      r.situacao = "erro";
    }
  }
  await pausa(2, 6);
  await pedir("painel", "/painel", c);
}

// ---------------------------------------------------------------------------
// Uso da máquina
// ---------------------------------------------------------------------------

function amostrarCpu() {
  const tempos = () => os.cpus().reduce((s, c) => ({ ocioso: s.ocioso + c.times.idle, total: s.total + Object.values(c.times).reduce((a, b) => a + b, 0) }), { ocioso: 0, total: 0 });
  let anterior = tempos();
  return () => {
    const atual = tempos();
    const uso = 1 - (atual.ocioso - anterior.ocioso) / (atual.total - anterior.total || 1);
    anterior = atual;
    return Math.round(uso * 100);
  };
}

async function monitorar(fim: () => boolean) {
  const cpu = amostrarCpu();
  while (!fim()) {
    await pausa(5, 5);
    const [{ rows: c }, { rows: f }] = await Promise.all([
      db.query<{ n: number }>("select count(*)::int n from pg_stat_activity where datname = current_database()"),
      db.query<{ na_fila: number; processando: number }>(
        `select count(*) filter (where status = 'na_fila')::int na_fila, count(*) filter (where status = 'processando')::int processando
           from tarefas_ia where status in ('na_fila', 'processando')`,
      ),
    ]);
    serie.push({ t: agora(), cpu: cpu(), memGb: +((os.totalmem() - os.freemem()) / 1e9).toFixed(1), conexoes: c[0].n, naFila: f[0].na_fila, processando: f[0].processando });
  }
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

const percentil = (v: number[], p: number) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return Math.round(o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))]);
};

function resumir(contas: { id: string }[]) {
  const porRotulo = Object.entries(Object.groupBy(medidas, (m) => m.rotulo)).map(([rotulo, ms]) => {
    const v = ms!.map((m) => m.ms);
    return { rotulo, pedidos: v.length, erros: ms!.filter((m) => !m.ok).length, p50: percentil(v, 50), p95: percentil(v, 95), max: percentil(v, 100) };
  });
  const ia = Object.entries(Object.groupBy(resultadosIa, (r) => r.tipo)).map(([tipo, rs]) => {
    const tempos = rs!.filter((r) => r.situacao === "concluido").map((r) => (r.concluidoMs! - r.enviadoMs) / 1000);
    return {
      tipo,
      pedidos: rs!.length,
      concluidos: tempos.length,
      erros: rs!.filter((r) => r.situacao === "erro").length,
      ocupada: rs!.filter((r) => r.situacao === "ocupada").length,
      pendentes: rs!.filter((r) => r.situacao === "pendente").length,
      recusas: rs!.filter((r) => r.recusa).map((r) => r.recusa),
      p50s: percentil(tempos, 50),
      p95s: percentil(tempos, 95),
      maxs: percentil(tempos, 100),
    };
  });
  return {
    rotulo: ROTULO,
    url: BASE,
    usuarios: contas.length,
    rampaS: RAMPA_S,
    duracaoS: Math.round(agora() / 1000),
    ambiente: { ollama: process.env.OLLAMA_URL ?? "padrão", cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memoriaGb: Math.round(os.totalmem() / 1e9) },
    paginas: porRotulo,
    ia,
    serie,
    medidas: medidas.map((m) => [m.rotulo, Math.round(m.ms), m.status, m.t]),
    tarefas: resultadosIa,
  };
}

// ---------------------------------------------------------------------------

if (process.argv.includes("--limpar")) {
  console.log(`${await limpar()} contas de carga removidas.`);
  await db.end();
  process.exit(0);
}

const contas = await preparar(USUARIOS);
const { rows: normas } = await db.query<{ id: number }>("select id from normas where apelido is not null and removida_em is null limit 60");
console.log(`${contas.length} advogados virtuais prontos; entram ao longo de ${RAMPA_S} s; teto de ${DURACAO_S} s.`);
const fim = DURACAO_S * 1000;
let terminou = false;
const monitor = monitorar(() => terminou);
const progresso = setInterval(() => {
  const ia = resultadosIa.filter((r) => r.situacao !== "pendente").length;
  const ultimas = medidas.slice(-200).map((m) => m.ms);
  console.log(`[${Math.round(agora() / 1000)} s] páginas ${medidas.length} (p95 recente ${percentil(ultimas, 95)} ms), IA resolvidas ${ia}/${resultadosIa.length}, fila ${serie.at(-1)?.naFila ?? "?"} + ${serie.at(-1)?.processando ?? "?"} em andamento`);
}, 30_000);

await Promise.all(
  contas.map(async (conta, i) => {
    await pausa((RAMPA_S * i) / contas.length, (RAMPA_S * i) / contas.length);
    await advogado(conta, normas.map((n) => n.id), fim).catch((e) => console.error("advogado", i, e));
  }),
);
terminou = true;
clearInterval(progresso);
await monitor;
const resumo = resumir(contas);
writeFileSync(SAIDA, JSON.stringify(resumo, null, 1));
console.table(resumo.paginas);
console.table(resumo.ia.map(({ recusas, ...r }) => ({ ...r, recusas: recusas.length })));
console.log(`Resultado completo em ${SAIDA}. Contas mantidas para conferência; remova com --limpar.`);
await db.end();
