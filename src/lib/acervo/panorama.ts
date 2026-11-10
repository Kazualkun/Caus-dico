import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { pool } from "@/db";
import { estatisticasDoAcervo } from "./estatisticas";

/** Panorama da página inicial da biblioteca: contagens prontas (estatisticas.ts) e as listas curtas, recalculadas a cada hora. */
export async function panoramaDoAcervo() {
  "use cache";
  cacheLife("hours");
  cacheTag("acervo");

  const [estatisticas, principais, publicacoes, sincronizacao] = await Promise.all([
    estatisticasDoAcervo(),
    pool.query<{ id: number; apelido: string; titulo: string; ementa: string | null }>(
      `select id, apelido, titulo, ementa from normas
        where removida_em is null and esfera = 'federal' and apelido is not null and not revogada
          and tipo_slug in ('constituicao','leis-ordinarias','leis-complementares','decretos-lei')
        order by (tipo_slug = 'constituicao') desc, (apelido ilike 'código%' or apelido ilike 'consolidação%') desc, apelido
        limit 40`,
    ),
    pool.query<{ id: number; titulo: string; ementa: string | null; data: string; link: string | null; normaId: number | null }>(
      `select id, titulo, ementa, to_char(data, 'YYYY-MM-DD') as data, link, norma_id as "normaId"
         from acervo_publicacoes order by data desc, id desc limit 8`,
    ),
    pool.query<{ concluidaEm: Date | null; status: string; commit: string | null }>(
      `select concluida_em as "concluidaEm", status, commit_ate as commit from acervo_sincronizacoes
        where tipo in ('completa', 'incremental') order by id desc limit 1`,
    ),
  ]);

  return {
    esferas: estatisticas.esferas,
    total: estatisticas.esferas.reduce((s, e) => s + e.total, 0),
    areas: estatisticas.areas,
    principais: principais.rows,
    publicacoes: publicacoes.rows,
    sincronizacao: sincronizacao.rows[0] ?? null,
    conferidas: estatisticas.conferidas,
  };
}
