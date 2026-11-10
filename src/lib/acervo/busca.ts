import "server-only";
import { pool } from "@/db";
import type { Esfera } from "./parser";
import type { Conferencia } from "./tipos-curadoria";

export type FiltrosAcervo = {
  q?: string;
  /** "normas": identifica a norma (nome, ementa, indexação). "texto": procura dentro dos artigos. */
  modo?: "normas" | "texto";
  esfera?: Esfera;
  uf?: string;
  tipo?: string;
  area?: string;
  anoDe?: number;
  anoAte?: number;
  incluirRevogadas?: boolean;
  pagina?: number;
};

export type ResultadoNorma = {
  id: number;
  titulo: string;
  apelido: string | null;
  ementa: string | null;
  esfera: Esfera;
  uf: string | null;
  municipio: string | null;
  orgao: string | null;
  tipo: string;
  tipoSlug: string;
  ano: number | null;
  data: string | null;
  revogada: boolean;
  situacao: string | null;
  areas: string[];
  trecho: string | null;
  ancora: string | null;
};

const POR_PAGINA = 20;
const LIMITE_CONTAGEM = 10_000;
/**
 * Busca dentro dos artigos: no máximo isto de artigos encontrados entra na ordenação.
 * Uma palavra comum ("prazo") aparece em milhões de artigos; pontuar todos levava minutos
 * e prendia uma conexão do banco. Acima do teto, a tela pede termos mais específicos.
 */
const CANDIDATOS_TEXTO = 20_000;
/** Nenhuma busca segura uma conexão do banco por mais que isto. */
const TEMPO_MAXIMO_BUSCA_MS = 10_000;
/**
 * Busca de fontes para a IA: termo que passa disto é amplo demais ("prazo") e é ignorado.
 * Os dispositivos não guardam a esfera da norma, então um termo comum com o filtro
 * federal percorre boa parte da tabela antes de juntar os candidatos.
 */
const TEMPO_MAXIMO_FONTES_MS = 4_000;

/** A busca passou do tempo máximo: mensagem pronta para a tela. */
export class BuscaAmplaDemaisError extends Error {
  constructor() {
    super("A busca é ampla demais e passou do tempo limite. Acrescente termos ou use os filtros para refinar.");
    this.name = "BuscaAmplaDemaisError";
  }
}

/** Consulta com tempo máximo no próprio banco (statement_timeout), numa conexão só dela. */
async function consultarComTeto<T extends object>(sql: string, params: unknown[], tetoMs = TEMPO_MAXIMO_BUSCA_MS): Promise<T[]> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query(`set local statement_timeout = ${Math.round(tetoMs)}`);
    const { rows } = await cliente.query<T>(sql, params);
    await cliente.query("commit");
    return rows;
  } catch (e) {
    await cliente.query("rollback").catch(() => undefined);
    if ((e as { code?: string }).code === "57014") throw new BuscaAmplaDemaisError();
    throw e;
  } finally {
    cliente.release();
  }
}

/** Ano plausível de norma (a coluna é smallint: valores fora disso derrubariam a consulta). */
const anoValido = (ano: number | undefined) => (ano && Number.isInteger(ano) && ano >= 1500 && ano <= 2200 ? ano : undefined);

const TIPOS_POR_SIGLA: [RegExp, string[]][] = [
  [/^(lei complementar|lc|lcp)$/, ["leis-complementares"]],
  [/^(decreto-lei|decreto lei|del|dl)$/, ["decretos-lei"]],
  [/^(lei)$/, ["leis-ordinarias"]],
  [/^(decreto|dec)$/, ["decretos"]],
  [/^(medida provisoria|mp|mpv)$/, ["medidas-provisorias"]],
  [/^(emenda constitucional|ec|emc)$/, ["emendas-constitucionais"]],
  [/^(sumula vinculante|sv)$/, ["sumulas-vinculantes"]],
  [/^(sumula)$/, ["sumulas", "sumulas-vinculantes"]],
  [/^(tema)$/, ["repetitivos", "repercussao-geral"]],
  [/^(adi|adc|adpf|ado)$/, ["controle-concentrado"]],
];

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

/** "Lei nº 8.078/90", "LC 123", "súmula 369" → tipo, número e ano. */
export function interpretarConsulta(q: string) {
  const m = semAcento(q.trim().toLowerCase()).match(
    /^([a-z][a-z -]*?)?\s*(?:n[º°o.]*\s*)?(\d[\d.]*(?:-\d+)?)\s*(?:(?:\/|,|-|\sde\s)\s*(\d{2}|\d{4}))?$/,
  );
  if (!m) return null;
  const sigla = m[1]?.trim();
  const tipos = sigla ? TIPOS_POR_SIGLA.find(([re]) => re.test(sigla))?.[1] : undefined;
  if (sigla && !tipos) return null;
  let ano = m[3] ? Number(m[3]) : undefined;
  if (ano !== undefined && ano < 100) ano += ano >= 30 ? 1900 : 2000;
  return { numero: m[2].replace(/\./g, ""), ano, tipos };
}

function montarFiltros(f: FiltrosAcervo, params: unknown[], alias = "n") {
  const where = [`${alias}.removida_em is null`];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.esfera) where.push(`${alias}.esfera = ${p(f.esfera)}`);
  if (f.uf) where.push(`${alias}.uf = ${p(f.uf.toUpperCase())}`);
  if (f.tipo) where.push(`${alias}.tipo_slug = ${p(f.tipo)}`);
  if (f.area) where.push(`${alias}.areas @> array[${p(f.area)}]::text[]`);
  const anoDe = anoValido(f.anoDe);
  const anoAte = anoValido(f.anoAte);
  if (anoDe) where.push(`${alias}.ano >= ${p(anoDe)}`);
  if (anoAte) where.push(`${alias}.ano <= ${p(anoAte)}`);
  if (!f.incluirRevogadas) where.push(`not ${alias}.revogada`);
  return where;
}

const COLUNAS = `n.id, n.titulo, n.apelido, n.ementa, n.esfera, n.uf, n.municipio, n.orgao, n.tipo, n.tipo_slug as "tipoSlug",
  n.ano, to_char(n.data, 'YYYY-MM-DD') as data, n.revogada, n.situacao, n.areas`;

/** Peso por relevância institucional: códigos e leis antes de decretos e atos infralegais. */
const PESO = `(case when n.apelido is not null then 2.0
                   when n.tipo_slug in ('constituicao','leis-ordinarias','leis-complementares','decretos-lei','emendas-constitucionais') then 1.5
                   when n.esfera = 'jurisprudencia' then 1.4
                   when n.esfera = 'federal' then 1.1 else 1.0 end)`;

export async function buscarNormas(f: FiltrosAcervo) {
  // Teto de páginas: a contagem para em LIMITE_CONTAGEM, e um offset enorme obrigaria o banco
  // a percorrer o acervo inteiro a cada requisição.
  const pagina = Math.min(Math.max(1, Math.floor(f.pagina ?? 1) || 1), Math.ceil(LIMITE_CONTAGEM / POR_PAGINA));
  const params: unknown[] = [];
  const where = montarFiltros(f, params);
  const q = f.q?.trim() ?? "";
  const ref = q ? interpretarConsulta(q) : null;
  let sqlBase: string;
  let ordem: string;
  /** Busca dentro dos artigos: o trecho é recortado só para os itens da página. */
  let candidatosSql: string | null = null;

  if (ref) {
    params.push(ref.numero);
    where.push(`regexp_replace(n.numero, '\\D', '', 'g') = regexp_replace($${params.length}, '\\D', '', 'g')`);
    if (ref.ano) {
      params.push(ref.ano);
      where.push(`n.ano = $${params.length}`);
    }
    if (ref.tipos) {
      params.push(ref.tipos);
      where.push(`n.tipo_slug = any($${params.length}::text[])`);
    }
    sqlBase = `select ${COLUNAS}, null::text as trecho, null::text as ancora from normas n where ${where.join(" and ")}`;
    ordem = `order by (n.esfera = 'federal') desc, ${PESO} desc, n.ano desc nulls last`;
  } else if (q && f.modo === "texto") {
    params.push(q);
    const consulta = `websearch_to_tsquery('public.pt_unaccent', $${params.length})`;
    candidatosSql = `select d.norma_id, d.ancora, d.inicio, d.fim, ts_rank_cd(d.tsv, ${consulta}) as r
                       from dispositivos d join normas n on n.id = d.norma_id
                      where d.tsv @@ ${consulta} and ${where.join(" and ")}
                      limit ${CANDIDATOS_TEXTO}`;
    // O melhor artigo de cada norma entre os candidatos.
    sqlBase = `select ${COLUNAS}, m.ancora, m.inicio, m.fim, m.r * ${PESO} as rank
                 from (select distinct on (c.norma_id) c.* from (${candidatosSql}) c order by c.norma_id, c.r desc) m
                 join normas n on n.id = m.norma_id`;
    ordem = "order by rank desc";
  } else if (q) {
    params.push(q);
    const consulta = `websearch_to_tsquery('public.pt_unaccent', $${params.length})`;
    params.push(`%${q}%`);
    sqlBase = `select ${COLUNAS}, null::text as trecho, null::text as ancora,
                      ts_rank_cd(n.tsv, ${consulta}) * ${PESO} + (case when n.apelido ilike $${params.length} then 5 else 0 end) as rank
                 from normas n where (n.tsv @@ ${consulta} or n.apelido ilike $${params.length}) and ${where.join(" and ")}`;
    ordem = "order by rank desc";
  } else {
    sqlBase = `select ${COLUNAS}, null::text as trecho, null::text as ancora from normas n where ${where.join(" and ")}`;
    ordem = "order by n.data desc nulls last, n.id desc";
  }

  const paginaSql = `${sqlBase} ${ordem} limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`;
  const [itens, contagem, candidatos] = await Promise.all([
    consultarComTeto<ResultadoNorma>(
      candidatosSql
        ? `select p.*, substring(t.texto from p.inicio + 1 for least(p.fim - p.inicio, 400)) as trecho
             from (${paginaSql}) p join normas t on t.id = p.id order by p.rank desc`
        : paginaSql,
      params,
    ),
    consultarComTeto<{ total: number }>(`select count(*)::int as total from (${sqlBase} limit ${LIMITE_CONTAGEM + 1}) c`, params),
    candidatosSql ? consultarComTeto<{ total: number }>(`select count(*)::int as total from (${candidatosSql}) c`, params) : null,
  ]);

  const total = contagem[0].total;
  return {
    itens,
    total: Math.min(total, LIMITE_CONTAGEM),
    maisQueLimite: total > LIMITE_CONTAGEM || (candidatos?.[0].total ?? 0) >= CANDIDATOS_TEXTO,
    pagina,
    porPagina: POR_PAGINA,
    referencia: Boolean(ref),
  };
}

export async function obterNorma(id: number) {
  const { rows } = await pool.query(
    `select id, caminho, esfera, uf, municipio, orgao, tipo, tipo_slug as "tipoSlug", numero, ano,
            to_char(data, 'YYYY-MM-DD') as data, titulo, apelido, ementa, situacao, revogada, versao_texto as "versaoTexto",
            urn, fonte_url as "fonteUrl", repo_url as "repoUrl", areas, nomes_populares as "nomesPopulares", indexacao,
            texto, tamanho, sumario, explicacao, explicacao_em as "explicacaoEm", atualizada_em as "atualizadaEm",
            removida_em as "removidaEm", fonte, curada, hash_texto as "hashTexto", conferida_em as "conferidaEm",
            conferencia, origem_mudou_em as "origemMudouEm", git_sha as "gitSha"
       from normas where id = $1`,
    [id],
  );
  return (rows[0] ?? null) as
    | (Omit<ResultadoNorma, "trecho" | "ancora"> & {
        caminho: string; numero: string | null; versaoTexto: string | null; urn: string | null; fonteUrl: string | null;
        repoUrl: string; nomesPopulares: string[]; indexacao: string | null; texto: string; tamanho: number;
        sumario: { nivel: number; titulo: string; ancora: string; inicio: number }[]; explicacao: string | null;
        explicacaoEm: Date | null; atualizadaEm: Date; removidaEm: Date | null;
        fonte: string; curada: boolean; hashTexto: string | null; conferidaEm: Date | null;
        conferencia: Conferencia | null; origemMudouEm: Date | null; gitSha: string;
      })
    | null;
}

export async function dispositivosDaNorma(normaId: number) {
  const { rows } = await pool.query<{ referencia: string; ancora: string; inicio: number; fim: number; contexto: string | null }>(
    "select referencia, ancora, inicio, fim, contexto from dispositivos where norma_id = $1 order by ordem",
    [normaId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Recuperação de fontes para a IA
// ---------------------------------------------------------------------------

export type FonteAcervo = {
  normaId: number;
  esfera: Esfera;
  titulo: string;
  apelido: string | null;
  referencia: string;
  ancora: string;
  texto: string;
  fonteUrl: string | null;
  repoUrl: string;
};

/**
 * Trechos mais relevantes do acervo para um conjunto de consultas. Por padrão,
 * busca na legislação federal e na jurisprudência; a UF inclui a legislação estadual.
 */
export async function buscarDispositivos(
  termos: string[],
  opts: { esferas?: Esfera[]; uf?: string; porTermo?: number; limite?: number } = {},
): Promise<FonteAcervo[]> {
  const esferas = opts.esferas ?? ["federal", "jurisprudencia"];
  const consultas = [...new Set(termos.map((t) => t.trim()).filter(Boolean))].slice(0, 12);

  // Mesmo teto de candidatos da busca na tela; o trecho é recortado só para os melhores.
  // Um termo amplo demais que passe do tempo máximo é ignorado, sem derrubar a tarefa.
  const resultados = await Promise.all(
    consultas.map((termo) =>
      consultarComTeto<FonteAcervo & { rank: number; id: number }>(
        `with q as (select websearch_to_tsquery('public.pt_unaccent', $1) as consulta),
         candidatos as (
           select d.id, d.norma_id, d.referencia, d.ancora, d.inicio, d.fim, n.esfera, n.titulo, n.apelido,
                  n.fonte_url, n.repo_url, ts_rank_cd(d.tsv, q.consulta) * ${PESO} as rank
             from q, dispositivos d join normas n on n.id = d.norma_id
            where d.tsv @@ q.consulta and n.removida_em is null and not n.revogada
              and not (n.areas @> array['homenagens'])
              and (n.esfera = any($2::text[]) or (n.esfera = 'estadual' and n.uf = $3))
            limit ${CANDIDATOS_TEXTO}
         )
         select c.id, c.norma_id as "normaId", c.esfera, c.titulo, c.apelido, c.referencia, c.ancora,
                substring(t.texto from c.inicio + 1 for least(c.fim - c.inicio, 3500)) as texto,
                c.fonte_url as "fonteUrl", c.repo_url as "repoUrl", c.rank
           from (select * from candidatos order by rank desc limit $4) c join normas t on t.id = c.norma_id
          order by c.rank desc`,
        [termo, esferas, opts.uf ?? null, opts.porTermo ?? 6],
        TEMPO_MAXIMO_FONTES_MS,
      ).catch((e) => {
        if (e instanceof BuscaAmplaDemaisError) return [];
        throw e;
      }),
    ),
  );

  const placar = new Map<number, { fonte: FonteAcervo; pontos: number }>();
  for (const linhas of resultados) {
    for (const r of linhas) {
      const atual = placar.get(r.id);
      placar.set(r.id, { fonte: r, pontos: (atual?.pontos ?? 0) + 1 + r.rank });
    }
  }
  return [...placar.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, opts.limite ?? 24)
    .map(({ fonte }) => fonte);
}
