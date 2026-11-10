/**
 * IA local (Ollama) para desenvolvimento, sem chave de API nem instalação.
 *
 * Baixa o binário oficial do Ollama (versão fixa, conferida por SHA-256) e os
 * modelos para %LOCALAPPDATA%/causidico/ollama (ou CAUSIDICO_DADOS), FORA do
 * projeto, para não sincronizar gigabytes com o OneDrive. Em servidor Linux,
 * instale o Ollama pelo pacote oficial e aponte OLLAMA_URL para ele.
 *
 *   npm run ia:iniciar              baixa o Ollama e o modelo na primeira vez e sobe o servidor
 *   npm run ia:parar                desliga
 *   npm run ia:status               versão, modelos baixados e o que está carregado na memória
 *   npm run ia:baixar -- <modelo>   baixa outro modelo (padrão: OLLAMA_MODEL)
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// O servidor do Ollama herda só o ambiente do terminal, não os segredos do .env.local.
const ambienteDoTerminal = { ...process.env };
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa os padrões abaixo
}

const VERSAO = "v0.40.5";
const PACOTE = {
  nome: "ollama-windows-amd64.zip",
  sha256: "5134ce7e3bc8e94d0494721c799ec293b429450d0c52461b0ee3647dd3bb4bb7",
};

const baseDados =
  process.env.CAUSIDICO_DADOS ??
  path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"), "causidico");
const dirIa = path.join(baseDados, "ollama");
const dirBinario = path.join(dirIa, `ollama-${VERSAO}`);
const exe = path.join(dirBinario, "ollama.exe");
const dirModelos = path.join(dirIa, "modelos");
const log = path.join(dirIa, "ollama.log");
const arquivoPid = path.join(dirIa, "ollama.pid");

const url = new URL(process.env.OLLAMA_URL ?? "http://127.0.0.1:11434");
const modeloPadrao = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(new URL(caminho, url), init);
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function respondendo() {
  try {
    await api("/api/version", { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/** Mostra o progresso a cada 5%, sem inundar o terminal. */
function progresso(rotulo: string) {
  let ultimo = -5;
  return (feito: number, total: number) => {
    const pct = total ? Math.floor((feito / total) * 100) : 0;
    if (pct >= ultimo + 5) {
      ultimo = pct - (pct % 5);
      console.log(`${rotulo}: ${pct}% (${gb(feito)} de ${gb(total)})`);
    }
  };
}

async function instalar() {
  if (existsSync(exe)) return;
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("O download automático é só para Windows x64. Instale o Ollama pelo site oficial e defina OLLAMA_URL.");
  }
  mkdirSync(dirIa, { recursive: true });
  const zip = path.join(dirIa, PACOTE.nome);
  const resposta = await fetch(`https://github.com/ollama/ollama/releases/download/${VERSAO}/${PACOTE.nome}`);
  if (!resposta.ok || !resposta.body) throw new Error(`Download do Ollama falhou: HTTP ${resposta.status}`);

  const total = Number(resposta.headers.get("content-length") ?? 0);
  const mostrar = progresso(`Baixando o Ollama ${VERSAO}`);
  const hash = createHash("sha256");
  let feito = 0;
  const contador = new Transform({
    transform(pedaco, _enc, cb) {
      hash.update(pedaco);
      feito += pedaco.length;
      mostrar(feito, total);
      cb(null, pedaco);
    },
  });
  await pipeline(Readable.fromWeb(resposta.body as never), contador, createWriteStream(zip));

  if (hash.digest("hex") !== PACOTE.sha256) {
    rmSync(zip, { force: true });
    throw new Error("O arquivo baixado não confere com o SHA-256 publicado pelo Ollama. Nada foi instalado.");
  }
  console.log("Arquivo conferido (SHA-256). Extraindo …");
  mkdirSync(dirBinario, { recursive: true });
  // O tar do Windows (bsdtar) extrai .zip; o "tar" do Git Bash não.
  const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  try {
    execFileSync(tar, ["-xf", zip, "-C", dirBinario], { stdio: "inherit" });
  } catch (e) {
    rmSync(dirBinario, { recursive: true, force: true });
    throw e;
  }
  rmSync(zip, { force: true });
  if (!existsSync(exe)) throw new Error(`ollama.exe não encontrado em ${dirBinario} depois da extração.`);
}

async function baixarModelo(modelo = process.argv[3] ?? modeloPadrao) {
  const { models } = await api<{ models: { name: string }[] }>("/api/tags");
  if (models.some((m) => m.name === modelo)) return console.log(`Modelo ${modelo} já está baixado.`);

  const resposta = await fetch(new URL("/api/pull", url), { method: "POST", body: JSON.stringify({ model: modelo, stream: true }) });
  if (!resposta.ok || !resposta.body) throw new Error(`Download do modelo falhou: HTTP ${resposta.status}`);
  // Um contador por arquivo do modelo (pesos, projetor de imagem…); só os grandes aparecem.
  const contadores = new Map<string, ReturnType<typeof progresso>>();
  let etapa = "";
  let resto = "";
  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
  for (let lido = await leitor.read(); !lido.done; lido = await leitor.read()) {
    const pedaco = lido.value;
    resto += pedaco;
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    for (const linha of linhas.filter(Boolean)) {
      const ev = JSON.parse(linha) as { status?: string; digest?: string; total?: number; completed?: number; error?: string };
      if (ev.error) throw new Error(`Download do modelo falhou: ${ev.error}`);
      if (ev.digest && ev.total && ev.total > 500 * 1024 ** 2) {
        if (!contadores.has(ev.digest)) contadores.set(ev.digest, progresso(`Baixando ${modelo} (parte ${contadores.size + 1})`));
        contadores.get(ev.digest)!(ev.completed ?? 0, ev.total);
      }
      else if (ev.status && ev.status !== etapa && !ev.status.startsWith("pulling")) console.log(ev.status);
      etapa = ev.status ?? etapa;
    }
  }
}

async function iniciar() {
  if (await respondendo()) {
    console.log(`O Ollama já está rodando em ${url.origin}.`);
  } else {
    await instalar();
    mkdirSync(dirModelos, { recursive: true });
    const saida = openSync(log, "a");
    // detached + stdio em arquivo: o servidor continua depois que o comando termina.
    // cwd na pasta de dados, para não prender a pasta do projeto no Windows.
    const filho = spawn(exe, ["serve"], {
      cwd: dirIa,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", saida, saida],
      env: {
        ...ambienteDoTerminal,
        OLLAMA_HOST: url.host,
        OLLAMA_MODELS: dirModelos,
        // Economia de memória de vídeo: atenção otimizada e cache de contexto em 8 bits.
        OLLAMA_FLASH_ATTENTION: "1",
        OLLAMA_KV_CACHE_TYPE: "q8_0",
        // Tarefas simultâneas iguais às vagas da fila do site (IA_PARALELO, padrão 1: cabe em
        // placas de 8 GB) e um modelo carregado.
        OLLAMA_NUM_PARALLEL: String(Math.max(1, Number(process.env.IA_PARALELO ?? 1) || 1)),
        OLLAMA_MAX_LOADED_MODELS: "1",
      },
    });
    filho.unref();
    closeSync(saida);
    writeFileSync(arquivoPid, String(filho.pid));

    const limite = Date.now() + 60_000;
    while (!(await respondendo())) {
      if (Date.now() > limite) throw new Error(`O Ollama não respondeu em 60 s. Veja o log em ${log}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log(`Ollama ${VERSAO} rodando em ${url.origin} (log: ${log}).`);
  }
  await baixarModelo(modeloPadrao);
  console.log(`Pronto: modelo ${modeloPadrao}.`);
}

function parar() {
  if (!existsSync(arquivoPid)) return console.log("O Ollama iniciado por este projeto não está rodando.");
  const pid = Number(readFileSync(arquivoPid, "utf8"));
  try {
    // /T encerra também os processos que carregam os modelos.
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(pid);
    console.log("Ollama encerrado.");
  } catch {
    console.log("O processo já tinha terminado.");
  }
  rmSync(arquivoPid, { force: true });
}

async function status() {
  console.log(`Pasta:  ${dirIa}`);
  console.log(`Modelo: ${modeloPadrao} (OLLAMA_MODEL)`);
  if (!(await respondendo())) return console.log("Situação: parado (rode npm run ia:iniciar)");
  const { version } = await api<{ version: string }>("/api/version");
  const { models } = await api<{ models: { name: string; size: number }[] }>("/api/tags");
  const { models: carregados } = await api<{ models: { name: string; size: number; size_vram: number }[] }>("/api/ps");
  console.log(`Situação: rodando em ${url.origin}, versão ${version}`);
  console.log(`Baixados: ${models.map((m) => `${m.name} (${gb(m.size)})`).join(", ") || "nenhum"}`);
  for (const m of carregados) {
    const naGpu = m.size ? Math.round((m.size_vram / m.size) * 100) : 0;
    console.log(`Carregado: ${m.name}, ${gb(m.size)}, ${naGpu}% na placa de vídeo`);
  }
  if (!carregados.length) console.log("Carregado: nenhum (o modelo sobe na primeira tarefa)");
}

const comando = process.argv[2];
const acoes: Record<string, () => unknown> = { iniciar, parar, status, baixar: () => baixarModelo() };
if (!comando || !acoes[comando]) {
  console.error("Uso: tsx scripts/ia.mts <iniciar|parar|status|baixar [modelo]>");
  process.exit(1);
}
Promise.resolve(acoes[comando]()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
