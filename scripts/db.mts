/**
 * PostgreSQL local para desenvolvimento, sem instalação nem Docker.
 *
 * Usa os binários do pacote embedded-postgres (PostgreSQL 17, mesma versão
 * principal suportada pelo Neon) e guarda os dados FORA do projeto, em
 * %LOCALAPPDATA%/causidico/pgdata (ou CAUSIDICO_DADOS), para não sincronizar
 * gigabytes com o OneDrive.
 *
 *   npm run db:iniciar   cria o cluster na primeira vez e sobe o servidor
 *   npm run db:parar     desliga
 *   npm run db:status    mostra se está rodando, onde estão os dados e o tamanho
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa os padrões abaixo
}

const baseDados =
  process.env.CAUSIDICO_DADOS ??
  path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"), "causidico");

// O pacote de binários da plataforma exporta os caminhos de pg_ctl e initdb.
// O PostgreSQL no Windows falha se a pasta dos binários tiver acentos (ex.:
// "Área de Trabalho"), então eles são copiados uma vez para a pasta de dados.
const pacote = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
const binarios = (await import(pacote)) as { pg_ctl: string; initdb: string };
const nativoOriginal = path.dirname(path.dirname(binarios.pg_ctl));
const nativo = /^[\x20-\x7e]*$/.test(nativoOriginal) ? nativoOriginal : path.join(baseDados, "pgsql-17");
if (nativo !== nativoOriginal && !existsSync(path.join(nativo, "bin"))) {
  console.log(`Copiando os binários do PostgreSQL para ${nativo} …`);
  cpSync(nativoOriginal, nativo, { recursive: true });
}
const exe = (nome: "pg_ctl" | "initdb") => path.join(nativo, "bin", path.basename(binarios[nome]));
const pgdata = path.join(baseDados, "pgdata");
const log = path.join(baseDados, "postgres.log");

const url = new URL(process.env.DATABASE_URL ?? "postgres://causidico:causidico@localhost:5433/causidico");
const porta = url.port || "5433";
const usuario = decodeURIComponent(url.username);
const senha = decodeURIComponent(url.password);
const banco = url.pathname.slice(1);

function rodando() {
  const r = spawnSync(exe("pg_ctl"), ["status", "-D", pgdata], { encoding: "utf8" });
  return r.status === 0;
}

async function garantirBanco() {
  const cliente = new pg.Client({ host: "localhost", port: Number(porta), user: usuario, password: senha, database: "postgres" });
  await cliente.connect();
  const { rowCount } = await cliente.query("select 1 from pg_database where datname = $1", [banco]);
  if (!rowCount) {
    await cliente.query(`create database "${banco.replace(/"/g, "")}" encoding 'UTF8' template template0 locale 'C'`);
    console.log(`Banco "${banco}" criado.`);
  }
  await cliente.end();
}

async function iniciar() {
  mkdirSync(baseDados, { recursive: true });
  if (!existsSync(path.join(pgdata, "PG_VERSION"))) {
    console.log(`Criando o cluster em ${pgdata} …`);
    const arquivoSenha = path.join(baseDados, ".senha-inicial");
    writeFileSync(arquivoSenha, senha);
    try {
      execFileSync(
        exe("initdb"),
        ["-D", pgdata, "-U", usuario, "--pwfile", arquivoSenha, "--auth", "scram-sha-256", "-E", "UTF8", "--locale", "C"],
        { stdio: "inherit" },
      );
    } finally {
      rmSync(arquivoSenha, { force: true });
    }
  }
  if (rodando()) {
    console.log("O PostgreSQL já está rodando.");
  } else {
    // Só escuta em localhost; memória ajustada para a ingestão do acervo.
    const opcoes = `-p ${porta} -c listen_addresses=localhost -c shared_buffers=256MB -c maintenance_work_mem=512MB -c max_wal_size=4GB`;
    // stdio "ignore": o servidor não pode herdar o terminal, senão o comando nunca termina.
    // cwd na pasta de dados: o servidor herdaria a pasta do projeto como diretório de
    // trabalho, e o Windows impediria mover ou renomear o projeto enquanto ele roda.
    try {
      execFileSync(exe("pg_ctl"), ["start", "-D", pgdata, "-l", log, "-w", "-o", opcoes], { stdio: "ignore", cwd: baseDados });
    } catch {
      throw new Error(`O PostgreSQL não subiu. Veja o log em ${log}`);
    }
  }
  await garantirBanco();
  console.log(`Pronto: postgres://${usuario}:***@localhost:${porta}/${banco}`);
}

function parar() {
  if (!rodando()) return console.log("O PostgreSQL não está rodando.");
  execFileSync(exe("pg_ctl"), ["stop", "-D", pgdata, "-m", "fast", "-w"], { stdio: "inherit" });
}

async function status() {
  console.log(`Dados: ${pgdata}`);
  console.log(`Log:   ${log}`);
  if (!rodando()) return console.log("Situação: parado (rode npm run db:iniciar)");
  const cliente = new pg.Client({ connectionString: url.toString() });
  await cliente.connect();
  const { rows } = await cliente.query(
    "select version() as versao, pg_size_pretty(pg_database_size(current_database())) as tamanho",
  );
  console.log(`Situação: rodando na porta ${porta}`);
  console.log(`Versão:  ${rows[0].versao}`);
  console.log(`Tamanho: ${rows[0].tamanho}`);
  await cliente.end();
}

const comando = process.argv[2];
const acoes: Record<string, () => unknown> = { iniciar, parar, status };
if (!comando || !acoes[comando]) {
  console.error("Uso: tsx scripts/db.mts <iniciar|parar|status>");
  process.exit(1);
}
Promise.resolve(acoes[comando]()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
