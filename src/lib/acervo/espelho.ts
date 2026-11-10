/**
 * Espelho local do repositório ctresb/leis.
 *
 * É um clone raso (só a versão atual) e parcial (conteúdos baixados sob
 * demanda), sem checkout: as normas são lidas direto dos objetos Git. Assim
 * 1,2 milhão de arquivos não viram arquivos soltos no disco, e nomes inválidos
 * no Windows não são problema. A versão de cada arquivo é o ID do objeto Git
 * (blob), que muda sempre que o conteúdo muda.
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const REPOSITORIO = "https://github.com/ctresb/leis.git";
export const RAMO = "main";
export const URL_ARQUIVO = "https://github.com/ctresb/leis/blob/main/";

export function pastaDoEspelho() {
  return (
    process.env.ACERVO_DIR ??
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"), "causidico", "acervo", "leis")
  );
}

const ambienteGit = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };

async function git(args: string[], cwd = pastaDoEspelho()) {
  const { stdout } = await execFileAsync("git", ["-c", "core.longpaths=true", ...args], {
    cwd,
    env: ambienteGit,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

export function espelhoExiste() {
  // A pasta fica fora do projeto: o comentário evita que o bundler rastreie arquivos por causa desta checagem.
  return existsSync(/*turbopackIgnore: true*/ path.join(pastaDoEspelho(), ".git"));
}

/** Espaço livre (bytes) no disco onde ficam o espelho e, em geral, o banco local. */
export function espacoLivre() {
  const pasta = existsSync(/*turbopackIgnore: true*/ pastaDoEspelho()) ? pastaDoEspelho() : os.homedir();
  const s = statfsSync(/*turbopackIgnore: true*/ pasta);
  return s.bavail * s.bsize;
}

export async function prepararEspelho() {
  if (espelhoExiste()) return;
  const pasta = pastaDoEspelho();
  mkdirSync(path.dirname(pasta), { recursive: true });
  await git(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", "--branch", RAMO, REPOSITORIO, pasta], path.dirname(pasta));
}

/** Busca a versão mais recente do repositório e devolve o commit anterior e o novo. */
export async function atualizarEspelho() {
  const de = await git(["rev-parse", "HEAD"]).catch(() => null);
  await git(["fetch", "--depth", "1", "--filter=blob:none", "--no-tags", "origin", RAMO]);
  const ate = await git(["rev-parse", "FETCH_HEAD"]);
  // Sem checkout: basta mover a referência do ramo local.
  await git(["update-ref", `refs/heads/${RAMO}`, ate]);
  await git(["symbolic-ref", "HEAD", `refs/heads/${RAMO}`]);
  return { de, ate };
}

/** Lista todos os arquivos do commit: caminho → ID do objeto (blob). */
export function listarArquivos(commit: string, filtro: (caminho: string) => boolean): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const mapa = new Map<string, string>();
    const proc = spawn("git", ["-c", "core.longpaths=true", "ls-tree", "-r", "-z", commit], {
      cwd: pastaDoEspelho(),
      env: ambienteGit,
    });
    let resto = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (pedaco: string) => {
      const registros = (resto + pedaco).split("\0");
      resto = registros.pop() ?? "";
      for (const r of registros) {
        // "<modo> blob <oid>\t<caminho>"
        const tab = r.indexOf("\t");
        const [, tipo, oid] = r.slice(0, tab).split(" ");
        const caminho = r.slice(tab + 1);
        if (tipo === "blob" && filtro(caminho)) mapa.set(caminho, oid);
      }
    });
    proc.on("error", reject);
    proc.on("close", (codigo) => (codigo === 0 ? resolve(mapa) : reject(new Error(`git ls-tree terminou com código ${codigo}`))));
  });
}

/** Baixa, em um único pacote, os conteúdos ainda ausentes do clone parcial. */
export function baixarObjetos(oids: string[]): Promise<void> {
  if (oids.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "git",
      [
        "-c", "fetch.negotiationAlgorithm=noop",
        "fetch", "origin", "--no-tags", "--no-write-fetch-head", "--recurse-submodules=no", "--filter=blob:none", "--stdin",
      ],
      { cwd: pastaDoEspelho(), env: ambienteGit, stdio: ["pipe", "ignore", "pipe"] },
    );
    let erro = "";
    proc.stderr.on("data", (d) => (erro += d));
    proc.on("error", reject);
    proc.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`git fetch de objetos falhou: ${erro.slice(-500)}`))));
    proc.stdin.end(`${oids.join("\n")}\n`);
  });
}

/**
 * Lê conteúdos de objetos com um único processo `git cat-file --batch`.
 * As leituras são atendidas em ordem.
 */
export class LeitorDeObjetos {
  private proc = spawn("git", ["-c", "core.longpaths=true", "cat-file", "--batch"], {
    cwd: pastaDoEspelho(),
    env: ambienteGit,
    stdio: ["pipe", "pipe", "ignore"],
  });
  private buffer = Buffer.alloc(0);
  private fila: { resolve: (s: string) => void; reject: (e: Error) => void }[] = [];

  constructor() {
    this.proc.stdout.on("data", (d: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, d]);
      this.processar();
    });
    this.proc.on("close", () => this.fila.splice(0).forEach((p) => p.reject(new Error("git cat-file encerrado"))));
  }

  private processar() {
    while (this.fila.length) {
      const quebra = this.buffer.indexOf(10);
      if (quebra < 0) return;
      const cabecalho = this.buffer.subarray(0, quebra).toString("utf8");
      if (cabecalho.endsWith(" missing")) {
        this.buffer = this.buffer.subarray(quebra + 1);
        this.fila.shift()!.reject(new Error(`objeto ausente: ${cabecalho}`));
        continue;
      }
      const tamanho = Number(cabecalho.split(" ")[2]);
      if (this.buffer.length < quebra + 1 + tamanho + 1) return;
      const conteudo = this.buffer.subarray(quebra + 1, quebra + 1 + tamanho).toString("utf8");
      this.buffer = this.buffer.subarray(quebra + 1 + tamanho + 1);
      this.fila.shift()!.resolve(conteudo);
    }
  }

  ler(oid: string) {
    return new Promise<string>((resolve, reject) => {
      this.fila.push({ resolve, reject });
      this.proc.stdin.write(`${oid}\n`);
    });
  }

  fechar() {
    this.proc.stdin.end();
  }
}
