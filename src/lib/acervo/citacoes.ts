import "server-only";
import { pool } from "@/db";
import { NORMAS_CONHECIDAS } from "./apelidos";
import type { FonteCitada } from "@/lib/ai/schemas";

/*
 * Conferência das citações feitas pela IA contra o acervo. Modelos menores
 * erram número de artigo (ex.: "Código Civil, art. 2.261", que não existe) e
 * nem sempre informam o id da fonte. Aqui, sem IA:
 *   1. identificamos a norma citada (por número, "Lei nº 8.245/1991", ou por
 *      nome e sigla, "Código Civil", "CDC", "CLT", "CF");
 *   2. procuramos cada artigo citado no acervo pela âncora ("art-1-219");
 *   3. o artigo encontrado vira fonte com o texto oficial; o que não existe
 *      vira alerta para o advogado conferir.
 */

type Norma = { chave: string; nome: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Siglas e nomes usuais que não estão (ou estão de outra forma) na tabela de apelidos. */
const SIGLAS: [RegExp, string, string][] = [
  [/\b(?:CF|CRFB)(?:\/88)?\b|constituicao(?: federal| da republica)?/i, "constituicao", "Constituição Federal"],
  [/\bCC\b|codigo civil(?! de 1916)/i, "leis-ordinarias:10406:2002", "Código Civil"],
  [/\bCPC\b|codigo de processo civil(?! de 1973)/i, "leis-ordinarias:13105:2015", "Código de Processo Civil"],
  [/\bCDC\b|codigo de defesa do consumidor|lei de defesa do consumidor/i, "leis-ordinarias:8078:1990", "Código de Defesa do Consumidor"],
  [/\bCLT\b|consolidacao das leis do trabalho/i, "decretos-lei:5452:1943", "CLT"],
  [/\bCPP\b|codigo de processo penal(?! militar)/i, "decretos-lei:3689:1941", "Código de Processo Penal"],
  [/\bCP\b|codigo penal(?! militar)/i, "decretos-lei:2848:1940", "Código Penal"],
  [/\bCTN\b|codigo tributario nacional/i, "leis-ordinarias:5172:1966", "Código Tributário Nacional"],
  [/\bECA\b/i, "leis-ordinarias:8069:1990", "ECA"],
  [/\bLGPD\b/i, "leis-ordinarias:13709:2018", "LGPD"],
  [/\bEAOAB\b|estatuto da (?:advocacia|oab)/i, "leis-ordinarias:8906:1994", "Estatuto da Advocacia"],
  [/\bLINDB\b/i, "decretos-lei:4657:1942", "LINDB"],
];

/** Nomes da tabela de apelidos ("Lei do Inquilinato", "Lei Maria da Penha"…), do mais longo ao mais curto. */
const NOMES = NORMAS_CONHECIDAS.map(([chave, nome]) => {
  const base = semAcento(nome.replace(/\s*\(.*?\)\s*/g, " ").trim()).toLowerCase();
  return { chave, nome: nome.replace(/\s*\(.*?\)\s*/g, " ").trim(), regex: new RegExp(`\\b${escapar(base)}\\b`, "i") };
}).sort((a, b) => b.nome.length - a.nome.length);

const NUMERO_DE_LEI =
  /\b(lei complementar|lei|decreto-lei|decreto lei)\s*(?:federal\s*)?(?:n[º°o.]*\s*)?(\d{1,2}(?:\.\d{3})+|\d{1,5})(?:\s*\/\s*(\d{4}|\d{2}))?/gi;
const ARTIGOS = /\barts?\.?\s*((?:\d{1,2}(?:\.\d{3})+|\d{1,4})\s*[º°ª]?(?:\s*-\s*[A-Z]\b)?(?:\s*(?:,|e|a|até|ao)\s*(?:\d{1,2}(?:\.\d{3})+|\d{1,4})\s*[º°ª]?(?:\s*-\s*[A-Z]\b)?)*)/gi;
const UM_ARTIGO = /(\d{1,2}(?:\.\d{3})+|\d{1,4})\s*[º°ª]?(?:\s*-\s*([A-Z])\b)?/gi;

/** "1.219" → "art-1-219"; "477-A" → "art-477-a"; "5º" → "art-5". */
function ancoraDoArtigo(numero: string, letra?: string) {
  const digitos = numero.replace(/\D/g, "").replace(/^0+/, "");
  const comMilhar = digitos.length > 3 ? `${digitos.slice(0, -3)}-${digitos.slice(-3)}` : digitos;
  return `art-${comMilhar}${letra ? `-${letra.toLowerCase()}` : ""}`;
}
const rotuloDoArtigo = (ancora: string) => `art. ${ancora.slice(4).replace(/^(\d+)-(\d{3})/, "$1.$2").replace(/-([a-z])$/, (_, l: string) => `-${l.toUpperCase()}`)}`;

type Mencao = { pos: number; norma: Norma };

function normasMencionadas(texto: string): Mencao[] {
  const mencoes: Mencao[] = [];
  for (const m of texto.matchAll(NUMERO_DE_LEI)) {
    const tipo = /complementar/i.test(m[1]) ? "leis-complementares" : /decreto/i.test(m[1]) ? "decretos-lei" : "leis-ordinarias";
    const numero = m[2].replace(/\D/g, "");
    const ano = m[3] ? (m[3].length === 2 ? (Number(m[3]) > 30 ? 1900 : 2000) + Number(m[3]) : Number(m[3])) : "";
    mencoes.push({ pos: m.index, norma: { chave: `${tipo}:${numero}:${ano}`, nome: m[0].trim() } });
  }
  const plano = semAcento(texto);
  for (const [regex, chave, nome] of SIGLAS) {
    for (const m of plano.matchAll(new RegExp(regex.source, "gi"))) mencoes.push({ pos: m.index, norma: { chave, nome } });
  }
  for (const n of NOMES) {
    const m = n.regex.exec(plano);
    if (m) mencoes.push({ pos: m.index, norma: { chave: n.chave, nome: n.nome } });
  }
  return mencoes.sort((a, b) => a.pos - b.pos);
}

type Pedido = { item: number; norma: Norma; ancora: string };

/**
 * Cada artigo fica com a norma escrita logo depois dele ("art. 51 do CDC"); se
 * não houver, com a mencionada mais perto antes ("CDC, art. 51"); se nenhuma
 * vier antes, com a primeira depois.
 */
function pedidosDoTexto(texto: string, item: number): Pedido[] {
  const normas = normasMencionadas(texto);
  if (!normas.length) return [];
  const pedidos: Pedido[] = [];
  for (const m of texto.matchAll(ARTIGOS)) {
    const fim = m.index + m[0].length;
    const colada = normas.find((n) => n.pos >= fim && /^\s*,?\s*(?:d[aoe]s?\s+)?$/i.test(texto.slice(fim, n.pos)));
    const antes = normas.filter((n) => n.pos < m.index).at(-1);
    const depois = normas.find((n) => n.pos > m.index);
    const norma = (colada ?? antes ?? depois)?.norma;
    if (!norma) continue;
    for (const a of m[1].matchAll(UM_ARTIGO)) pedidos.push({ item, norma, ancora: ancoraDoArtigo(a[1], a[2]) });
  }
  return pedidos;
}

export type ResultadoVerificacao = {
  /** Fontes já existentes mais as encontradas na conferência (ids "V1", "V2"…). */
  fontes: FonteCitada[];
  /** Ids de fonte a acrescentar em cada item. */
  ids: string[][];
  /** Avisos de cada item (artigo inexistente, norma revogada). */
  alertas: string[][];
};

/** Confere no acervo as citações de cada texto. Nunca derruba a tarefa: em erro, devolve sem alterações. */
export async function verificarCitacoes(textos: string[], fontesAtuais: FonteCitada[]): Promise<ResultadoVerificacao> {
  const vazio = { fontes: fontesAtuais, ids: textos.map(() => []), alertas: textos.map(() => []) };
  const pedidos = textos.flatMap((t, i) => pedidosDoTexto(t ?? "", i));
  if (!pedidos.length) return vazio;

  try {
    // 1. Normas citadas.
    const chaves = [...new Set(pedidos.map((p) => p.norma.chave))];
    const normas = new Map<string, { id: number; revogada: boolean }>();
    for (const chave of chaves) {
      const [tipo, numero, ano] = chave.split(":");
      const { rows } =
        tipo === "constituicao"
          ? await pool.query<{ id: number; revogada: boolean }>(
              "select id, revogada from normas where tipo_slug = 'constituicao' and esfera = 'federal' and removida_em is null limit 1",
            )
          : await pool.query<{ id: number; revogada: boolean }>(
              `select id, revogada from normas
                where esfera = 'federal' and tipo_slug = $1 and regexp_replace(coalesce(numero, ''), '\\D', '', 'g') = $2
                  and ($3::int is null or ano = $3) and removida_em is null
                order by revogada, ano desc limit 1`,
              [tipo, numero, ano ? Number(ano) : null],
            );
      if (rows[0]) normas.set(chave, { id: Number(rows[0].id), revogada: rows[0].revogada });
    }
    if (!normas.size) return vazio;

    // 2. Artigos citados das normas encontradas.
    const ids = [...new Set([...normas.values()].map((n) => n.id))];
    const ancoras = [...new Set(pedidos.map((p) => p.ancora))];
    const { rows } = await pool.query<FonteCitada & { normaId: number }>(
      `select n.id as "normaId", n.esfera, n.titulo, n.apelido, d.referencia, d.ancora,
              substring(n.texto from d.inicio + 1 for least(d.fim - d.inicio, 3500)) as texto,
              n.fonte_url as "fonteUrl", n.repo_url as "repoUrl"
         from dispositivos d join normas n on n.id = d.norma_id
        where d.norma_id = any($1::bigint[]) and d.ancora = any($2::text[])`,
      [ids, ancoras],
    );
    const encontrados = new Map(rows.map((r) => [`${Number(r.normaId)}:${r.ancora}`, r]));

    // 3. Liga cada artigo à fonte (reaproveitando a que já estava no prompt) ou gera o alerta.
    const fontes = [...fontesAtuais];
    const porChave = new Map(fontes.map((f) => [`${f.normaId}:${f.ancora}`, f.id]));
    const resultado: ResultadoVerificacao = { fontes, ids: textos.map(() => []), alertas: textos.map(() => []) };
    for (const p of pedidos) {
      const norma = normas.get(p.norma.chave);
      if (!norma) continue; // norma fora do acervo: o aviso geral de "confira na fonte oficial" já cobre
      const chave = `${norma.id}:${p.ancora}`;
      const linha = encontrados.get(chave);
      if (!linha) {
        const alerta = `${p.norma.nome}, ${rotuloDoArtigo(p.ancora)}: artigo não encontrado no acervo. Pode ser erro de citação; confira antes de usar.`;
        if (!resultado.alertas[p.item].includes(alerta)) resultado.alertas[p.item].push(alerta);
        continue;
      }
      let id = porChave.get(chave);
      if (!id) {
        id = `V${porChave.size + 1}`;
        porChave.set(chave, id);
        fontes.push({ ...linha, id, normaId: Number(linha.normaId) });
      }
      if (!resultado.ids[p.item].includes(id)) resultado.ids[p.item].push(id);
      if (norma.revogada) {
        const alerta = `${p.norma.nome} consta como revogada no acervo; confira a norma vigente.`;
        if (!resultado.alertas[p.item].includes(alerta)) resultado.alertas[p.item].push(alerta);
      }
    }
    return resultado;
  } catch (e) {
    console.error("[citacoes] falha na conferência", e);
    return vazio;
  }
}
