import { pool } from "@/db";

/*
 * Contagens do acervo inteiro (por esfera, área e UF). Cada uma percorre as 1,2
 * milhão de normas e leva de segundos a dezenas de segundos com o disco frio, então
 * ficam prontas em acervo_estado: recalculadas pela rotina diária, ao fim de cada
 * sincronização e, na falta delas, na primeira visita.
 */

const CHAVE = "estatisticas";

export type EstatisticasAcervo = {
  esferas: { esfera: string; total: number; vigentes: number }[];
  areas: { area: string; total: number }[];
  conferidas: number;
  porUf: { uf: string; leis: number; decretos: number; municipios: number; municipais: number }[];
  calculadasEm: string;
};

export async function recalcularEstatisticas(): Promise<EstatisticasAcervo> {
  const [esferas, areas, conferidas, porUf] = await Promise.all([
    pool.query<EstatisticasAcervo["esferas"][number]>(
      `select esfera, count(*)::int as total, count(*) filter (where not revogada)::int as vigentes
         from normas where removida_em is null group by esfera order by total desc`,
    ),
    pool.query<EstatisticasAcervo["areas"][number]>(
      `select area, count(*)::int as total
         from normas, unnest(areas) as area
        where removida_em is null and not revogada and esfera in ('federal', 'jurisprudencia')
        group by area order by total desc`,
    ),
    pool.query<{ total: number }>("select count(*)::int as total from normas where conferida_em is not null and removida_em is null"),
    pool.query<EstatisticasAcervo["porUf"][number]>(
      `select uf,
              count(*) filter (where esfera = 'estadual' and tipo_slug in ('leis-ordinarias', 'leis-complementares'))::int as leis,
              count(*) filter (where esfera = 'estadual' and tipo_slug = 'decretos')::int as decretos,
              count(distinct municipio) filter (where esfera = 'municipal')::int as municipios,
              count(*) filter (where esfera = 'municipal')::int as municipais
         from normas
        where removida_em is null and uf is not null and esfera in ('estadual', 'municipal')
        group by uf order by uf`,
    ),
  ]);
  const estatisticas: EstatisticasAcervo = {
    esferas: esferas.rows,
    areas: areas.rows,
    conferidas: conferidas.rows[0].total,
    porUf: porUf.rows,
    calculadasEm: new Date().toISOString(),
  };
  await pool.query(
    `insert into acervo_estado (chave, valor, atualizado_em) values ($1, $2, now())
     on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`,
    [CHAVE, estatisticas],
  );
  return estatisticas;
}

export async function estatisticasDoAcervo(): Promise<EstatisticasAcervo> {
  const { rows } = await pool.query<{ valor: EstatisticasAcervo }>("select valor from acervo_estado where chave = $1", [CHAVE]);
  return rows[0]?.valor ?? recalcularEstatisticas();
}
