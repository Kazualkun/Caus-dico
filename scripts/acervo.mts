/**
 * Acervo jurídico pela linha de comando (local ou num worker agendado).
 *
 *   npm run acervo:sincronizar                         tudo (retomável: só grava o que mudou)
 *   npm run acervo:sincronizar -- --escopo federal,jurisprudencia
 *   npm run acervo:sincronizar -- --limite 1000        no máximo 1.000 normas novas/alteradas
 *   npm run acervo:dou -- --dias 7                     publicações recentes no Diário Oficial da União
 *   npm run acervo:enriquecer -- --limite 500          nomes populares e indexação oficial (normas.leg.br)
 *   npm run acervo:status                              resumo do acervo e das últimas execuções
 *   npm run acervo:rotulos                             refaz rótulo e âncora dos artigos com rótulo suspeito
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // usa as variáveis do ambiente
}

const { sincronizarAcervo } = await import("@/lib/acervo/sincronizacao");
const { verificarDou, enriquecerOficial } = await import("@/lib/acervo/oficial");
const { ESFERAS, analisarEstrutura } = await import("@/lib/acervo/parser");
const { pool } = await import("@/db");

const [comando, ...resto] = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = resto.indexOf(`--${nome}`);
  return i >= 0 ? resto[i + 1] : undefined;
};
const log = (m: string) => console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${m}`);

async function status() {
  const { rows: totais } = await pool.query(
    `select esfera, count(*)::int as normas, count(*) filter (where revogada)::int as revogadas
       from normas where removida_em is null group by esfera order by normas desc`,
  );
  const { rows: tamanho } = await pool.query("select pg_size_pretty(pg_database_size(current_database())) as t");
  const { rows: ultimas } = await pool.query(
    `select id, tipo, status, processadas, inseridas, atualizadas, removidas, erros, iniciada_em, concluida_em, mensagem
       from acervo_sincronizacoes order by id desc limit 5`,
  );
  console.table(totais);
  console.log(`Banco: ${tamanho[0].t}`);
  console.table(ultimas);
}

/**
 * Refaz rótulo e âncora dos artigos com rótulo suspeito ("Art. 11. O", "Art. 11-O"
 * vindo de "Artigo 11 - O…", "Art. 1O"), gravados antes da correção do parser.
 * Só atualiza quando as posições dos artigos continuam as mesmas.
 */
async function corrigirRotulos() {
  const { rows: suspeitas } = await pool.query<{ id: number }>(
    `select distinct d.norma_id as id from dispositivos d
      where d.referencia ~ '(\\d\\.? ?O|\\dO|-[A-Z]| [°º]|\\.[°º])( \\(parte \\d+\\))?$'`,
  );
  log(`${suspeitas.length} normas com rótulo suspeito`);
  let normasAlteradas = 0;
  let dispositivosAlterados = 0;
  let puladas = 0;
  for (let i = 0; i < suspeitas.length; i += 200) {
    const ids = suspeitas.slice(i, i + 200).map((r) => r.id);
    const { rows: normas } = await pool.query<{ id: number; caminho: string; esfera: string; texto: string }>(
      "select id, caminho, esfera, texto from normas where id = any($1::bigint[])",
      [ids],
    );
    const { rows: atuais } = await pool.query<{ id: number; normaId: number; ordem: number; referencia: string; ancora: string; inicio: number; fim: number }>(
      `select id, norma_id as "normaId", ordem, referencia, ancora, inicio, fim from dispositivos
        where norma_id = any($1::bigint[]) order by norma_id, ordem`,
      [ids],
    );
    for (const n of normas) {
      if (n.esfera === "jurisprudencia") continue;
      const antes = atuais.filter((d) => d.normaId === n.id);
      const { dispositivos } = analisarEstrutura(n.texto, { prefixoAdct: n.caminho === "constituicao.md" });
      if (dispositivos.length !== antes.length || dispositivos.some((d, j) => d.inicio !== antes[j].inicio || d.fim !== antes[j].fim)) {
        puladas++;
        continue;
      }
      const mudancas = antes
        .map((d, j) => ({ id: d.id, referencia: dispositivos[j].referencia, ancora: dispositivos[j].ancora, mudou: d.referencia !== dispositivos[j].referencia || d.ancora !== dispositivos[j].ancora }))
        .filter((m) => m.mudou);
      if (!mudancas.length) continue;
      await pool.query(
        `update dispositivos d set referencia = m.referencia, ancora = m.ancora
           from unnest($1::bigint[], $2::text[], $3::text[]) as m(id, referencia, ancora) where d.id = m.id`,
        [mudancas.map((m) => m.id), mudancas.map((m) => m.referencia), mudancas.map((m) => m.ancora)],
      );
      normasAlteradas++;
      dispositivosAlterados += mudancas.length;
    }
    log(`${Math.min(i + 200, suspeitas.length)}/${suspeitas.length}: ${dispositivosAlterados} artigos corrigidos em ${normasAlteradas} normas`);
  }
  console.log({ normasAlteradas, dispositivosAlterados, puladasPorEstruturaDiferente: puladas });
}

try {
  switch (comando) {
    case "sincronizar": {
      const escopo = opcao("escopo")?.split(",").filter((e): e is (typeof ESFERAS)[number] => (ESFERAS as readonly string[]).includes(e));
      const r = await sincronizarAcervo({ escopo, limite: Number(opcao("limite")) || undefined, disparadaPor: "cli", log });
      console.log(r);
      process.exitCode = r.status === "concluida" ? 0 : 1;
      break;
    }
    case "dou":
      console.log(await verificarDou({ dias: Number(opcao("dias")) || undefined, log }));
      break;
    case "enriquecer":
      console.log(await enriquecerOficial({ limite: Number(opcao("limite")) || 500, log }));
      break;
    case "status":
      await status();
      break;
    case "rotulos":
      await corrigirRotulos();
      break;
    default:
      console.error("Uso: tsx scripts/acervo.mts <sincronizar|dou|enriquecer|status|rotulos> [opções]");
      process.exitCode = 1;
  }
} finally {
  await pool.end();
}
