/**
 * Sincronização do acervo com o espelho de github.com/ctresb/leis.
 *
 * Reconciliação por versão: compara o ID do objeto Git de cada arquivo com o
 * gravado em normas.git_sha e processa só o que é novo ou mudou; o que saiu do
 * repositório é marcado como removido. A mesma rotina serve para a carga
 * inicial e para as atualizações diárias, e pode ser retomada a qualquer
 * momento (o que já foi gravado não é refeito).
 */
import { pool } from "@/db";
import { ESFERAS, PARSER_VERSAO, classificarCaminho, deveIgnorar, prepararNorma, type Esfera, type NormaPreparada } from "./parser";
import {
  LeitorDeObjetos,
  URL_ARQUIVO,
  atualizarEspelho,
  baixarObjetos,
  espacoLivre,
  listarArquivos,
  prepararEspelho,
} from "./espelho";
import { gravarLote, marcarRemovidas } from "./gravacao";
import { recalcularEstatisticas } from "./estatisticas";

const PRIORIDADE: Record<Esfera, number> = {
  federal: 0,
  jurisprudencia: 1,
  estadual: 2,
  municipal: 3,
  regulador: 4,
  tratado: 5,
};

const LOTE_DOWNLOAD = 20_000;
const LOTE_GRAVACAO = 250;
/** Espaço livre mínimo para continuar gravando (padrão 8 GB). */
const ESPACO_MINIMO = Number(process.env.ACERVO_ESPACO_MINIMO_GB ?? 8) * 1024 ** 3;
const CHAVE_TRAVA = 41_150_001;

const versaoDoArquivo = (oid: string) => `${oid}:v${PARSER_VERSAO}`;

export type OpcoesSincronizacao = {
  escopo?: Esfera[];
  /** Processa no máximo N arquivos novos/alterados (útil para testes e cargas parciais). */
  limite?: number;
  disparadaPor?: string;
  log?: (mensagem: string) => void;
};

export type ResumoSincronizacao = {
  id: number;
  status: "concluida" | "erro";
  commit: string;
  processadas: number;
  inseridas: number;
  atualizadas: number;
  removidas: number;
  inalteradas: number;
  erros: number;
  mensagem: string | null;
};

export async function sincronizarAcervo(opts: OpcoesSincronizacao = {}): Promise<ResumoSincronizacao> {
  const log = opts.log ?? (() => undefined);
  const escopo = new Set<Esfera>(opts.escopo?.length ? opts.escopo : ESFERAS);
  const cliente = await pool.connect();

  const { rows: trava } = await cliente.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [CHAVE_TRAVA]);
  if (!trava[0].ok) {
    cliente.release();
    throw new Error("Já existe uma sincronização do acervo em andamento.");
  }
  // Com a trava obtida, nenhuma outra execução Git está viva: as que ficaram em
  // "executando" foram interrompidas (servidor reiniciado, máquina desligada).
  await cliente.query(
    `update acervo_sincronizacoes set status='erro', concluida_em=atualizada_em,
            mensagem=coalesce(mensagem, 'Interrompida antes de concluir. A execução seguinte retomou de onde parou.')
      where status='executando' and estrategia='git'`,
  );

  const { rows: vazio } = await cliente.query<{ vazio: boolean }>("select not exists (select 1 from normas) as vazio");
  const { rows: run } = await cliente.query<{ id: number }>(
    `insert into acervo_sincronizacoes (tipo, estrategia, disparada_por) values ($1, 'git', $2) returning id`,
    [vazio[0].vazio ? "completa" : "incremental", opts.disparadaPor ?? "sistema"],
  );
  const runId = run[0].id;
  const c = { processadas: 0, inseridas: 0, atualizadas: 0, removidas: 0, inalteradas: 0, erros: 0 };
  const amostraErros: { caminho: string; erro: string }[] = [];
  let commit = "";
  let mensagem: string | null = null;

  const salvarProgresso = (extra: Record<string, unknown> = {}) =>
    cliente.query(
      `update acervo_sincronizacoes set processadas=$2, inseridas=$3, atualizadas=$4, removidas=$5, inalteradas=$6,
              erros=$7, amostra_erros=$8::jsonb, atualizada_em=now(), commit_ate=coalesce($9, commit_ate),
              mensagem=coalesce($10, mensagem) where id=$1`,
      [runId, c.processadas, c.inseridas, c.atualizadas, c.removidas, c.inalteradas, c.erros,
        JSON.stringify(amostraErros.slice(0, 50)), extra.commit ?? null, extra.mensagem ?? null],
    );

  let leitor: LeitorDeObjetos | null = null;
  try {
    log("Preparando o espelho do repositório…");
    await prepararEspelho();
    const { de, ate } = await atualizarEspelho();
    commit = ate;
    await cliente.query("update acervo_sincronizacoes set commit_de=$2, commit_ate=$3 where id=$1", [runId, de, ate]);
    log(`Commit ${ate.slice(0, 10)}${de && de !== ate ? ` (antes ${de.slice(0, 10)})` : ""}`);

    const arquivos = await listarArquivos(ate, (p) => !deveIgnorar(p) && escopo.has(classificarCaminho(p).esfera));
    // Só as normas que vieram do repositório: as incluídas pela curadoria não estão nele.
    const { rows: existentes } = await cliente.query<{ caminho: string; git_sha: string; curada: boolean }>(
      "select caminho, git_sha, curada from normas where removida_em is null and fonte = 'ctresb/leis' and esfera = any($1::text[])",
      [[...escopo]],
    );
    // A versão gravada de cada norma é "<ID do objeto Git>:v<versão do parser>": muda
    // quando o arquivo muda no repositório ou quando o parser é atualizado.
    const versaoAtual = new Map(existentes.map((r) => [r.caminho, r.git_sha]));
    const curadas = new Set(existentes.filter((r) => r.curada).map((r) => r.caminho));
    let pendentes = [...arquivos].filter(([caminho, oid]) => versaoAtual.get(caminho) !== versaoDoArquivo(oid));
    // Norma corrigida pela curadoria não é sobrescrita: a mudança no repositório vira um alerta para revisão.
    const curadasMudaram = pendentes.filter(([caminho]) => curadas.has(caminho));
    if (curadasMudaram.length) {
      await cliente.query(
        `update normas n set origem_sha = x.sha, origem_mudou_em = now()
           from unnest($1::text[], $2::text[]) as x(caminho, sha)
          where n.caminho = x.caminho and n.origem_sha is distinct from x.sha`,
        [curadasMudaram.map(([caminho]) => caminho), curadasMudaram.map(([, oid]) => versaoDoArquivo(oid))],
      );
      pendentes = pendentes.filter(([caminho]) => !curadas.has(caminho));
    }
    c.inalteradas = arquivos.size - pendentes.length;
    const removidas = [...versaoAtual.keys()].filter((caminho) => !arquivos.has(caminho) && !curadas.has(caminho));
    pendentes.sort(
      ([a], [b]) => PRIORIDADE[classificarCaminho(a).esfera] - PRIORIDADE[classificarCaminho(b).esfera] || b.localeCompare(a),
    );
    if (opts.limite) pendentes = pendentes.slice(0, opts.limite);
    log(`${arquivos.size} arquivos no escopo: ${pendentes.length} para gravar, ${removidas.length} removidos, ${c.inalteradas} sem mudança.`);
    await salvarProgresso();

    leitor = new LeitorDeObjetos();
    for (let i = 0; i < pendentes.length; i += LOTE_DOWNLOAD) {
      if (espacoLivre() < ESPACO_MINIMO) {
        mensagem = `Interrompida para proteger o disco: menos de ${Math.round(ESPACO_MINIMO / 1024 ** 3)} GB livres. Libere espaço e rode de novo para continuar de onde parou.`;
        log(mensagem);
        break;
      }
      const bloco = pendentes.slice(i, i + LOTE_DOWNLOAD);
      log(`Baixando ${bloco.length} conteúdos (${i + bloco.length}/${pendentes.length})…`);
      await baixarObjetos(bloco.map(([, oid]) => oid));

      for (let j = 0; j < bloco.length; j += LOTE_GRAVACAO) {
        const lote: NormaPreparada[] = [];
        for (const [caminho, oid] of bloco.slice(j, j + LOTE_GRAVACAO)) {
          try {
            lote.push(prepararNorma(caminho, await leitor.ler(oid), versaoDoArquivo(oid), URL_ARQUIVO));
          } catch (e) {
            c.erros++;
            amostraErros.push({ caminho, erro: e instanceof Error ? e.message : String(e) });
          }
        }
        try {
          const r = await gravarLote(cliente, lote);
          c.inseridas += r.inseridas;
          c.atualizadas += r.atualizadas;
        } catch {
          // Um lote com problema é regravado norma a norma para isolar o arquivo ruim.
          for (const norma of lote) {
            try {
              const r = await gravarLote(cliente, [norma]);
              c.inseridas += r.inseridas;
              c.atualizadas += r.atualizadas;
            } catch (erroNorma) {
              c.erros++;
              amostraErros.push({ caminho: norma.caminho, erro: erroNorma instanceof Error ? erroNorma.message : String(erroNorma) });
            }
          }
        }
        c.processadas += Math.min(LOTE_GRAVACAO, bloco.length - j);
        await salvarProgresso();
      }
      log(`Gravadas ${c.processadas} de ${pendentes.length}.`);
    }

    // Remoções só quando a passada cobriu todo o escopo (sem limite e sem interrupção).
    if (!opts.limite && !mensagem) {
      c.removidas = await marcarRemovidas(cliente, removidas);
      await cliente.query(
        `insert into acervo_estado (chave, valor) values ('commit', $1::jsonb)
         on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`,
        [JSON.stringify({ commit: ate, sincronizadoEm: new Date().toISOString(), escopo: [...escopo] })],
      );
    }

    await salvarProgresso({ commit: ate, mensagem });
    await cliente.query("update acervo_sincronizacoes set status='concluida', concluida_em=now() where id=$1", [runId]);
    await recalcularEstatisticas().catch((e) => log(`contagens do acervo não recalculadas: ${e instanceof Error ? e.message : e}`));
    return { id: runId, status: "concluida", commit, ...c, mensagem };
  } catch (e) {
    mensagem = e instanceof Error ? e.message : String(e);
    log(`Erro: ${mensagem}`);
    await salvarProgresso({ mensagem }).catch(() => undefined);
    await cliente.query("update acervo_sincronizacoes set status='erro', concluida_em=now() where id=$1", [runId]).catch(() => undefined);
    return { id: runId, status: "erro", commit, ...c, mensagem };
  } finally {
    leitor?.fechar();
    await cliente.query("select pg_advisory_unlock($1)", [CHAVE_TRAVA]).catch(() => undefined);
    cliente.release();
  }
}
