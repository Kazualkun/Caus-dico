/**
 * Gravação em lote das normas e de seus dispositivos. Usa SQL direto (pg) para
 * inserir centenas de normas e milhares de artigos por transação; o tsvector
 * de cada artigo é calculado pelo próprio PostgreSQL a partir do texto, que
 * não é guardado em duplicidade (só a posição dentro de normas.texto).
 */
import type { PoolClient } from "pg";
import type { NormaPreparada } from "./parser";

/**
 * `antesDeConfirmar` roda na mesma transação, com o id de cada norma gravada
 * (a curadoria usa para marcar a norma e aprovar a revisão de uma só vez).
 */
export async function gravarLote(
  cliente: PoolClient,
  lote: NormaPreparada[],
  antesDeConfirmar?: (ids: Map<string, number>) => Promise<void>,
) {
  if (lote.length === 0) return { inseridas: 0, atualizadas: 0 };

  await cliente.query("begin");
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os dispositivos são gravados à parte
    const registros = lote.map(({ dispositivos: _d, texto, ...n }) => ({
      ...n,
      texto,
      tamanho: texto.length,
      tipo_slug: n.tipoSlug,
      versao_texto: n.versaoTexto,
      fonte_url: n.fonteUrl,
      repo_url: n.repoUrl,
      git_sha: n.gitSha,
    }));

    const { rows } = await cliente.query<{ id: number; caminho: string; inserida: boolean }>(
      `insert into normas (caminho, esfera, uf, municipio, orgao, tipo, tipo_slug, numero, ano, data, titulo, apelido,
                           ementa, situacao, revogada, versao_texto, urn, fonte_url, repo_url, areas, texto, tamanho,
                           sumario, git_sha, removida_em, atualizada_em)
       select caminho, esfera, uf, municipio, orgao, tipo, tipo_slug, numero, ano, data, titulo, apelido,
              ementa, situacao, revogada, versao_texto, urn, fonte_url, repo_url, areas, texto, tamanho,
              sumario, git_sha, null, now()
         from jsonb_to_recordset($1::jsonb) as x(
              caminho text, esfera text, uf text, municipio text, orgao text, tipo text, tipo_slug text,
              numero text, ano smallint, data date, titulo text, apelido text, ementa text, situacao text,
              revogada boolean, versao_texto text, urn text, fonte_url text, repo_url text, areas text[],
              texto text, tamanho integer, sumario jsonb, git_sha text)
       on conflict (caminho) do update set
              esfera = excluded.esfera, uf = excluded.uf, municipio = excluded.municipio, orgao = excluded.orgao,
              tipo = excluded.tipo, tipo_slug = excluded.tipo_slug, numero = excluded.numero, ano = excluded.ano,
              data = excluded.data, titulo = excluded.titulo,
              -- nome popular vindo do enriquecimento oficial é preservado
              apelido = coalesce(excluded.apelido, normas.apelido),
              ementa = excluded.ementa, situacao = excluded.situacao, revogada = excluded.revogada,
              versao_texto = excluded.versao_texto, urn = excluded.urn, fonte_url = excluded.fonte_url,
              repo_url = excluded.repo_url, areas = excluded.areas, texto = excluded.texto,
              tamanho = excluded.tamanho, sumario = excluded.sumario, git_sha = excluded.git_sha,
              removida_em = null, atualizada_em = now(),
              -- texto mudou: a explicação e o enriquecimento precisam ser refeitos
              explicacao = null, explicacao_em = null, enriquecida_em = null,
              -- a conferência vale para o texto conferido; texto novo precisa ser conferido de novo
              conferida_em = case when normas.texto = excluded.texto then normas.conferida_em end,
              conferencia = case when normas.texto = excluded.texto then normas.conferencia end,
              hash_texto = case when normas.texto = excluded.texto then normas.hash_texto end
       returning id, caminho, (xmax = 0) as inserida`,
      [JSON.stringify(registros)],
    );

    const idPorCaminho = new Map(rows.map((r) => [r.caminho, r.id]));
    await cliente.query("delete from dispositivos where norma_id = any($1::bigint[])", [rows.map((r) => r.id)]);

    const cols = { norma: [] as number[], ordem: [] as number[], ref: [] as string[], ctx: [] as (string | null)[], ancora: [] as string[], ini: [] as number[], fim: [] as number[], texto: [] as string[] };
    for (const n of lote) {
      const id = idPorCaminho.get(n.caminho)!;
      for (const d of n.dispositivos) {
        cols.norma.push(id);
        cols.ordem.push(d.ordem);
        cols.ref.push(d.referencia);
        cols.ctx.push(d.contexto);
        cols.ancora.push(d.ancora);
        cols.ini.push(d.inicio);
        cols.fim.push(d.fim);
        cols.texto.push(d.texto);
      }
    }
    if (cols.norma.length) {
      await cliente.query(
        `insert into dispositivos (norma_id, ordem, referencia, contexto, ancora, inicio, fim, tsv)
         select x.norma_id, x.ordem, x.referencia, x.contexto, x.ancora, x.inicio, x.fim,
                to_tsvector('public.pt_unaccent', x.texto)
           from unnest($1::bigint[], $2::int[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::text[])
             as x(norma_id, ordem, referencia, contexto, ancora, inicio, fim, texto)`,
        [cols.norma, cols.ordem, cols.ref, cols.ctx, cols.ancora, cols.ini, cols.fim, cols.texto],
      );
    }

    await antesDeConfirmar?.(idPorCaminho);
    await cliente.query("commit");
    const inseridas = rows.filter((r) => r.inserida).length;
    return { inseridas, atualizadas: rows.length - inseridas };
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  }
}

/** Marca como removidas as normas que saíram do repositório (e limpa seus índices). */
export async function marcarRemovidas(cliente: PoolClient, caminhos: string[]) {
  let total = 0;
  for (let i = 0; i < caminhos.length; i += 5000) {
    const parte = caminhos.slice(i, i + 5000);
    const { rows } = await cliente.query<{ id: number }>(
      "update normas set removida_em = now() where caminho = any($1::text[]) and removida_em is null returning id",
      [parte],
    );
    await cliente.query("delete from dispositivos where norma_id = any($1::bigint[])", [rows.map((r) => r.id)]);
    total += rows.length;
  }
  return total;
}
