/**
 * Fontes oficiais do governo, consultadas com poucas requisições e intervalo
 * entre elas (sem contornar bloqueios de acesso automatizado):
 *
 * - Diário Oficial da União (in.gov.br): índice diário da seção 1, para saber
 *   no mesmo dia que uma lei, MP, emenda ou decreto federal foi publicado,
 *   mesmo antes de o texto chegar ao acervo.
 * - normas.leg.br (Câmara/Senado/LexML): nome popular e indexação temática
 *   oficial de cada norma federal — o "para que serve" que a busca usa.
 */
import { pool } from "@/db";
import { apelidoDosNomesOficiais } from "./apelidos";
import { classificarAreas } from "./areas";
import type { Esfera } from "./parser";

export const USER_AGENT = `Causidico/1.0 (+${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"})`;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function obter(url: string, accept: string) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 30_000);
  try {
    return await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept }, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function registrarExecucao(tipo: "oficial" | "enriquecimento", estrategia: "dou" | "normas-leg", disparadaPor: string) {
  const { rows } = await pool.query<{ id: number }>(
    "insert into acervo_sincronizacoes (tipo, estrategia, disparada_por) values ($1, $2, $3) returning id",
    [tipo, estrategia, disparadaPor],
  );
  return rows[0].id;
}

async function concluirExecucao(id: number, dados: { processadas: number; inseridas: number; atualizadas: number; erros: number; mensagem: string | null; status: "concluida" | "erro" }) {
  await pool.query(
    `update acervo_sincronizacoes set processadas=$2, inseridas=$3, atualizadas=$4, erros=$5, mensagem=$6,
            status=$7, concluida_em=now(), atualizada_em=now() where id=$1`,
    [id, dados.processadas, dados.inseridas, dados.atualizadas, dados.erros, dados.mensagem, dados.status],
  );
}

// ---------------------------------------------------------------------------
// Diário Oficial da União
// ---------------------------------------------------------------------------

const TIPOS_DOU: Record<string, { slug: string; nome: string }> = {
  "lei": { slug: "leis-ordinarias", nome: "Lei" },
  "lei complementar": { slug: "leis-complementares", nome: "Lei Complementar" },
  "medida provisória": { slug: "medidas-provisorias", nome: "Medida Provisória" },
  "emenda constitucional": { slug: "emendas-constitucionais", nome: "Emenda Constitucional" },
  "decreto": { slug: "decretos", nome: "Decreto" },
  "decreto legislativo": { slug: "decretos-legislativos", nome: "Decreto Legislativo" },
};

type AtoDou = { urlTitle: string; title?: string; artType?: string; content?: string; pubDate?: string; hierarchyStr?: string };

function dataDou(d: Date) {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return { url: `${v("day")}-${v("month")}-${v("year")}`, iso: `${v("year")}-${v("month")}-${v("day")}` };
}

/** "LEI Nº 15.300, DE 27 DE OUTUBRO DE 2026" → número e ano. */
export function numeroDoTitulo(titulo: string) {
  const m = titulo.match(/N[º°o.]*\s*([\d.]+(?:-[A-Z0-9]+)?)\s*,?\s*DE\s+\d{1,2}[º°]?\s+DE\s+[A-ZÇÃÉÊÍÓÔÚa-zçãéêíóôú]+\s+DE\s+(\d{4})/i);
  if (!m) return null;
  return { numero: m[1].replace(/\./g, ""), ano: Number(m[2]) };
}

export async function verificarDou(opts: { dias?: number; disparadaPor?: string; log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => undefined);
  const dias = Math.min(Math.max(opts.dias ?? 7, 1), 60);
  const id = await registrarExecucao("oficial", "dou", opts.disparadaPor ?? "sistema");
  let processadas = 0;
  let novas = 0;
  let erros = 0;
  let mensagem: string | null = null;

  // Seção 1 e sua edição extra: leis e medidas provisórias costumam sair na extra.
  const edicoes = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = dataDou(new Date(Date.now() - i * 86_400_000));
    for (const secao of ["do1", "do1e"]) edicoes.push({ dia, secao });
  }

  for (const { dia, secao } of edicoes) {
    try {
      const res = await obter(`https://www.in.gov.br/leiturajornal?data=${dia.url}&secao=${secao}`, "text/html");
      if (res.status === 429) {
        mensagem = "O Diário Oficial limitou as requisições; a verificação continua na próxima execução.";
        break;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const m = html.match(/<script\b[^>]*\bid=["']params["'][^>]*>([\s\S]*?)<\/script>/i);
      const atos: AtoDou[] = m ? (JSON.parse(m[1]).jsonArray ?? []) : [];

      for (const ato of atos) {
        const tipo = TIPOS_DOU[(ato.artType ?? "").trim().toLowerCase()];
        if (!tipo || !ato.title) continue;
        const ident = numeroDoTitulo(ato.title);
        processadas++;
        const { rowCount } = await pool.query(
          `insert into acervo_publicacoes (fonte, urn, tipo, numero, ano, data, titulo, ementa, link)
           values ('dou', $1, $2, $3, $4, $5, $6, $7, $8) on conflict (urn) do nothing`,
          [
            `dou:${ato.urlTitle}`,
            tipo.slug,
            ident?.numero ?? null,
            ident?.ano ?? null,
            dia.iso,
            ato.title.trim(),
            (ato.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1000) || null,
            `https://www.in.gov.br/web/dou/-/${ato.urlTitle}`,
          ],
        );
        novas += rowCount ?? 0;
      }
      log(`${dia.iso} (${secao}): ${atos.length} atos no DOU`);
    } catch (e) {
      erros++;
      log(`${dia.iso} (${secao}): falha (${e instanceof Error ? e.message : e})`);
    }
    await espera(1500);
  }

  // Liga as publicações às normas que já chegaram ao acervo.
  const { rowCount: incorporadas } = await pool.query(
    `update acervo_publicacoes p set norma_id = n.id, incorporada_em = now()
       from normas n
      where p.norma_id is null and n.esfera = 'federal' and n.removida_em is null
        and n.tipo_slug = p.tipo and n.numero = p.numero and n.ano = p.ano`,
  );

  await concluirExecucao(id, { processadas, inseridas: novas, atualizadas: incorporadas ?? 0, erros, mensagem, status: "concluida" });
  return { processadas, novas, incorporadas: incorporadas ?? 0, erros, mensagem };
}

// ---------------------------------------------------------------------------
// normas.leg.br: nome popular e indexação oficial
// ---------------------------------------------------------------------------

const lista = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => typeof x === "string");

export async function enriquecerOficial(opts: { limite?: number; disparadaPor?: string; log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => undefined);
  const limite = Math.min(Math.max(opts.limite ?? 500, 1), 5000);
  const id = await registrarExecucao("enriquecimento", "normas-leg", opts.disparadaPor ?? "sistema");

  const { rows } = await pool.query<{
    id: number; urn: string; titulo: string; apelido: string | null; ementa: string | null; esfera: Esfera; tipo_slug: string;
  }>(
    `select id, urn, titulo, apelido, ementa, esfera, tipo_slug from normas
      where esfera = 'federal' and urn is not null and enriquecida_em is null and removida_em is null
      order by case tipo_slug when 'leis-ordinarias' then 0 when 'leis-complementares' then 0
                              when 'decretos-lei' then 1 when 'emendas-constitucionais' then 1
                              when 'medidas-provisorias' then 2 else 3 end,
               ano desc nulls last
      limit $1`,
    [limite],
  );

  let atualizadas = 0;
  let erros = 0;
  let mensagem: string | null = null;
  for (const n of rows) {
    try {
      const res = await obter(
        `https://normas.leg.br/api/public/normas?urn=${encodeURIComponent(n.urn)}&tipo_documento=maior-detalhe`,
        "application/json",
      );
      if (res.status === 429) {
        mensagem = "O normas.leg.br limitou as requisições; o enriquecimento continua na próxima execução.";
        break;
      }
      if (res.status === 404) {
        await pool.query("update normas set enriquecida_em = now() where id = $1", [n.id]);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = (await res.json()) as { alternateName?: unknown; keywords?: unknown; legislationIdentifier?: string };
      if (meta.legislationIdentifier && meta.legislationIdentifier !== n.urn) {
        await pool.query("update normas set enriquecida_em = now() where id = $1", [n.id]);
        continue;
      }
      const nomes = lista(meta.alternateName).filter((x) => !/^[A-Z]+-[\dA-Z-]+$/.test(x));
      const vistos = new Set<string>();
      const palavras = lista(meta.keywords)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k && !vistos.has(k) && vistos.add(k));
      const indexacao = palavras.join(", ") || null;
      const apelido = n.apelido ?? apelidoDosNomesOficiais(nomes);
      const areas = classificarAreas({ titulo: n.titulo, apelido, ementa: n.ementa, indexacao, esfera: n.esfera, tipoSlug: n.tipo_slug });
      await pool.query(
        `update normas set nomes_populares = $2, indexacao = $3, apelido = $4, areas = $5, enriquecida_em = now()
          where id = $1`,
        [n.id, nomes, indexacao, apelido, areas],
      );
      atualizadas++;
      if (atualizadas % 50 === 0) log(`${atualizadas}/${rows.length} normas enriquecidas`);
    } catch (e) {
      erros++;
      log(`${n.urn}: ${e instanceof Error ? e.message : e}`);
    }
    await espera(500);
  }

  await concluirExecucao(id, { processadas: rows.length, inseridas: 0, atualizadas, erros, mensagem, status: "concluida" });
  return { processadas: rows.length, atualizadas, erros, mensagem };
}
