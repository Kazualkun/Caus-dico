/**
 * Leitura de um arquivo do acervo ctresb/leis: cabeçalho YAML, classificação
 * pelo caminho, ementa, situação de vigência, artigos e sumário.
 * Funções puras (sem banco, sem rede) — usadas pela sincronização e pelos testes.
 */
import { apelidoConhecido } from "./apelidos";
import { classificarAreas } from "./areas";

/** Aumente ao mudar a extração: a próxima sincronização reprocessa todo o acervo. */
export const PARSER_VERSAO = 2;

export const ESFERAS = ["federal", "estadual", "municipal", "jurisprudencia", "regulador", "tratado"] as const;
export type Esfera = (typeof ESFERAS)[number];

const RAIZES: Record<string, Esfera> = {
  federal: "federal",
  estaduais: "estadual",
  municipais: "municipal",
  jurisprudencia: "jurisprudencia",
  reguladores: "regulador",
  tratados: "tratado",
};

export type Classificacao = {
  esfera: Esfera;
  uf: string | null;
  municipio: string | null;
  orgao: string | null;
  tipoSlug: string;
  anoPasta: number | null;
};

/** Arquivos internos do repositório (auditorias, índices, falhas) começam com "_". */
export function deveIgnorar(caminho: string) {
  if (!caminho.endsWith(".md")) return true;
  if (caminho === "constituicao.md") return false;
  const partes = caminho.split("/");
  if (partes.some((p) => p.startsWith("_"))) return true;
  return !(partes[0] in RAIZES) || partes.length < 3;
}

const ehAno = (s: string | undefined) => (s && /^\d{4}$/.test(s) ? Number(s) : null);

export function classificarCaminho(caminho: string): Classificacao {
  if (caminho === "constituicao.md") {
    return { esfera: "federal", uf: null, municipio: null, orgao: null, tipoSlug: "constituicao", anoPasta: 1988 };
  }
  const p = caminho.split("/");
  const esfera = RAIZES[p[0]];
  switch (esfera) {
    case "federal":
      return { esfera, uf: null, municipio: null, orgao: null, tipoSlug: p[1], anoPasta: ehAno(p[2]) };
    case "estadual":
      return { esfera, uf: p[1].toUpperCase(), municipio: null, orgao: null, tipoSlug: p[2], anoPasta: ehAno(p[3]) };
    case "municipal":
      return { esfera, uf: p[1].toUpperCase(), municipio: p[2], orgao: null, tipoSlug: p[3], anoPasta: ehAno(p[4]) };
    case "jurisprudencia":
      // jurisprudencia/<tribunal>/<tipo>/arquivo  ou  jurisprudencia/outros-tribunais/<tribunal>/<tipo>/arquivo
      if (p[1] === "outros-tribunais" && p.length >= 5) {
        return { esfera, uf: null, municipio: null, orgao: p[2].toUpperCase(), tipoSlug: p[3], anoPasta: null };
      }
      return { esfera, uf: null, municipio: null, orgao: p[1].toUpperCase(), tipoSlug: p.length >= 4 ? p[2] : "documentos", anoPasta: null };
    case "regulador":
      // reguladores/<orgao>/<tipo>/<ano>/arquivo  ou  reguladores/<orgao>/<ano>/arquivo
      return {
        esfera,
        uf: null,
        municipio: null,
        orgao: p[1].toUpperCase(),
        tipoSlug: ehAno(p[2]) ? "atos" : p[2],
        anoPasta: ehAno(p[2]) ?? ehAno(p[3]),
      };
    case "tratado":
      return { esfera, uf: null, municipio: null, orgao: null, tipoSlug: p[1], anoPasta: null };
  }
}

// ---------------------------------------------------------------------------
// Cabeçalho YAML (formato simples gerado pelo acervo: uma chave por linha)
// ---------------------------------------------------------------------------

export function lerCabecalho(md: string): { meta: Record<string, string>; corpo: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { meta: {}, corpo: md };
  const meta: Record<string, string> = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const kv = linha.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let valor = kv[2].trim();
    if (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) {
      valor = valor.slice(1, -1).replace(/\\(["\\])/g, "$1");
    } else if (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2) {
      valor = valor.slice(1, -1).replace(/''/g, "'");
    }
    meta[kv[1]] = valor;
  }
  return { meta, corpo: md.slice(m[0].length) };
}

const limparInline = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

export function slug(s: string) {
  return semAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const valido = (v: string | undefined) => (v && v !== "null" && v.trim() !== "" ? v.trim() : null);

function dataValida(v: string | undefined) {
  const s = valido(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}

const CABECALHOS_ATO = /^(O|A)\s+(PRESIDENTE|GOVERNADOR|GOVERNADORA|PREFEITO|PREFEITA|MESA|VICE|PRESIDENTA|MINISTR|SECRET|DIRETOR|CONGRESSO|ASSEMBL|C[ÂA]MARA|DELEGAD|PRIMEIRO|PLEN)/i;

/** Primeiro parágrafo depois da epígrafe que parece uma ementa. */
function ementaDoCorpo(corpo: string) {
  const paragrafos = corpo.split(/\n\s*\n/).map((p) => limparInline(p.replace(/^#+\s*/gm, "")));
  for (const p of paragrafos.slice(0, 8)) {
    if (p.length < 15 || p.length > 900) continue;
    if (/^(LEI|DECRETO|PORTARIA|RESOLU|EMENDA|MEDIDA|ATO|INSTRU|DELIBERA|LEI COMPLEMENTAR)\b.*\d{4}\.?$/i.test(p)) continue;
    if (/^(Art\.?|Artigo|CONSIDERANDO|Faço saber|\||>|PREÂMBULO|Súmula|Registro)/i.test(p) || CABECALHOS_ATO.test(p)) continue;
    if (/\bnº\b.*\bde\b.*\d{4}$/i.test(p) && p.length < 120) continue;
    return p;
  }
  return null;
}

const REVOGACAO = /^(revogad|cancelad|superad|tornad[oa] sem efeito|sem efeito|extint|anulad|caducad|rejeitad|perdeu a efic)/i;

// ---------------------------------------------------------------------------
// Artigos e sumário
// ---------------------------------------------------------------------------

export type Dispositivo = {
  ordem: number;
  referencia: string;
  contexto: string | null;
  ancora: string;
  inicio: number;
  fim: number;
  texto: string;
};

export type ItemSumario = { nivel: number; titulo: string; ancora: string; inicio: number };

// O "o" ordinal ("Art. 1o") só vale colado ao número, e a letra de artigo acrescido ("Art. 12-A")
// colada ao hífen: em "Art. 11. O Prêmio…" e "Artigo 11 - O Plano…", o "O" já é o texto.
const ARTIGO = /^\**\s*(Art(?:igo)?\.?\s*\d[\d.]*(?:\s*[º°ª]|(?<=\d)o\b)?(?:\s*-[A-Z](?![a-z]))?)\s*[.:–-]?\s*\**/i;
const ESTRUTURA = /^\**\s*((?:PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O)\s+[IVXLCDM\d]+[^\n]*?)\**\s*$/i;
const MAX_TRECHO = 60_000;

function nivelDaEstrutura(titulo: string) {
  const t = semAcento(titulo).toUpperCase();
  if (/^(PARTE|LIVRO)/.test(t)) return 1;
  if (t.startsWith("TITULO")) return 2;
  if (t.startsWith("CAPITULO")) return 3;
  if (t.startsWith("SUBSECAO")) return 5;
  return 4;
}

/** "Artigo 1.°" / "ART. 1o" / "Art. 138." → "Art. 1º" / "Art. 1º" / "Art. 138". */
function normalizarReferencia(bruta: string) {
  return bruta
    .replace(/\*/g, "")
    .replace(/^Artigo/i, "Art.")
    .replace(/^ART\./, "Art.")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/, "-")
    .replace(/(\d)\.?\s*[°º]/, "$1º")
    .replace(/(\d)[oO](?=-|$)/, "$1º")
    .replace(/\.$/, "")
    .trim();
}

/** Divide textos muito longos em partes, nos limites de parágrafo, para caber no índice de busca. */
function partirLongo(texto: string, inicio: number): { inicio: number; fim: number }[] {
  if (texto.length <= MAX_TRECHO) return [{ inicio, fim: inicio + texto.length }];
  const partes: { inicio: number; fim: number }[] = [];
  let a = 0;
  while (a < texto.length) {
    let b = Math.min(texto.length, a + MAX_TRECHO);
    if (b < texto.length) {
      const quebra = texto.lastIndexOf("\n", b);
      if (quebra > a + MAX_TRECHO / 2) b = quebra;
    }
    partes.push({ inicio: inicio + a, fim: inicio + b });
    a = b;
  }
  return partes;
}

export function analisarEstrutura(texto: string, opts: { prefixoAdct?: boolean } = {}) {
  const sumario: ItemSumario[] = [];
  const marcos: { referencia: string; contexto: string | null; inicio: number; adct: boolean }[] = [];
  const pilha: string[] = [];
  let adct = false;
  let pos = 0;

  for (const linha of texto.split("\n")) {
    const inicioLinha = pos;
    pos += linha.length + 1;
    // Títulos em markdown (# …) ou, em textos sem markdown, linhas como "CAPÍTULO II".
    // O primeiro "# " no início do texto é o título do próprio documento e fica de fora.
    const md = linha.match(/^(#{1,6})\s+(.+)$/);
    if (md && md[1].length === 1 && inicioLinha < 400 && sumario.length === 0 && marcos.length === 0) continue;
    const estrutura = md ? null : linha.match(ESTRUTURA);
    if (md || estrutura) {
      const t = limparInline(md ? md[2] : estrutura![1]);
      const nivel = md ? Math.max(1, md[1].length - 1) : nivelDaEstrutura(t);
      pilha.length = Math.max(0, nivel - 1);
      pilha[nivel - 1] = t;
      if (/DISPOSI[ÇC][ÕO]ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS/i.test(t)) adct = true;
      if (sumario.length < 400) sumario.push({ nivel, titulo: t, ancora: `s${sumario.length + 1}`, inicio: inicioLinha });
      continue;
    }
    const art = linha.match(ARTIGO);
    if (art && /\d/.test(art[1])) {
      marcos.push({
        referencia: normalizarReferencia(art[1]),
        contexto: pilha.filter(Boolean).join(" › ") || null,
        inicio: inicioLinha,
        adct: adct && Boolean(opts.prefixoAdct),
      });
    }
  }

  const dispositivos: Dispositivo[] = [];
  const usadas = new Map<string, number>();
  const ancoraUnica = (base: string) => {
    const n = (usadas.get(base) ?? 0) + 1;
    usadas.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  if (marcos.length === 0) {
    // Sem artigos (decisões, portarias curtas, tratados): o texto inteiro é o dispositivo.
    const partes = partirLongo(texto, 0);
    partes.forEach((p, i) =>
      dispositivos.push({
        ordem: i,
        referencia: partes.length > 1 ? `Texto (parte ${i + 1})` : "Texto integral",
        contexto: null,
        ancora: ancoraUnica(i === 0 ? "texto" : `texto-${i + 1}`),
        inicio: p.inicio,
        fim: p.fim,
        texto: texto.slice(p.inicio, p.fim),
      }),
    );
    return { dispositivos, sumario };
  }

  marcos.forEach((m, i) => {
    // O artigo vai até o próximo artigo ou o próximo título, o que vier antes.
    const proximoArt = marcos[i + 1]?.inicio ?? texto.length;
    const proximoTitulo = sumario.find((s) => s.inicio > m.inicio)?.inicio ?? texto.length;
    const fim = Math.min(proximoArt, proximoTitulo);
    const referencia = (m.adct ? "ADCT, " : "") + m.referencia;
    const base = slug(referencia);
    const partes = partirLongo(texto.slice(m.inicio, fim), m.inicio);
    partes.forEach((p, j) =>
      dispositivos.push({
        ordem: dispositivos.length,
        referencia: partes.length > 1 ? `${referencia} (parte ${j + 1})` : referencia,
        contexto: m.contexto,
        ancora: ancoraUnica(j === 0 ? base : `${base}-p${j + 1}`),
        inicio: p.inicio,
        fim: p.fim,
        texto: texto.slice(p.inicio, p.fim),
      }),
    );
  });

  return { dispositivos, sumario };
}

/** Enunciado de súmula ou questão/tese de tema, usado como ementa da jurisprudência. */
export function extrairEnunciado(corpo: string) {
  const enunciado = corpo.match(/(?:^|\n)Enunciado\s*\n([\s\S]*?)\n\s*(?:Órgão Julgador|Data da Decisão|Fonte)\b/);
  if (enunciado) return limparInline(enunciado[1]);

  const secoes: Record<string, string> = {};
  let chave: string | null = null;
  for (const linha of corpo.replace(/```[\s\S]*?```/g, "").split("\n")) {
    const t = linha.match(/^#{2,4}\s+(.+)$/);
    if (t) {
      chave = semAcento(t[1]).toLowerCase().replace(/\s+/g, "");
      secoes[chave] = "";
      continue;
    }
    if (chave) secoes[chave] += `${linha}\n`;
  }
  const ok = (v?: string) => (v && !/^\s*n[ãa]o informado\s*$/i.test(v) && v.trim() ? limparInline(v) : undefined);
  const questao = ok(secoes.questaosubmetidaajulgamento) ?? ok(secoes.questao);
  const tese = ok(secoes.tesefirmada) ?? ok(secoes.tese) ?? ok(secoes.enunciado);
  if (tese && questao) return `${tese} (Questão: ${questao})`;
  return tese ?? questao ?? null;
}

// ---------------------------------------------------------------------------
// Norma completa
// ---------------------------------------------------------------------------

export type NormaPreparada = {
  caminho: string;
  esfera: Esfera;
  uf: string | null;
  municipio: string | null;
  orgao: string | null;
  tipo: string;
  tipoSlug: string;
  numero: string | null;
  ano: number | null;
  data: string | null;
  titulo: string;
  apelido: string | null;
  ementa: string | null;
  situacao: string | null;
  revogada: boolean;
  versaoTexto: string | null;
  urn: string | null;
  fonteUrl: string | null;
  repoUrl: string;
  areas: string[];
  texto: string;
  sumario: ItemSumario[];
  gitSha: string;
  dispositivos: Dispositivo[];
};

const humanizar = (s: string) => {
  const t = s.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function prepararNorma(caminho: string, conteudo: string, gitSha: string, repoBase: string): NormaPreparada {
  const c = classificarCaminho(caminho);
  // Bytes nulos não são aceitos pelo PostgreSQL em colunas de texto.
  const { meta, corpo: corpoBruto } = lerCabecalho(conteudo.replace(/\u0000/g, "").replace(/\r\n/g, "\n"));
  const corpo = corpoBruto.trim();

  const tituloCorpo = corpo.match(/^#\s+(.+)$/m)?.[1];
  const titulo = limparInline(valido(meta.titulo) ?? tituloCorpo ?? caminho.split("/").pop()!.replace(/\.md$/, ""));
  const data = dataValida(meta.data) ?? dataValida(meta.data_publicacao);
  const ano = data ? Number(data.slice(0, 4)) : (Number(valido(meta.ano)) || c.anoPasta);
  const numero = valido(meta.numero)?.replace(/\.(?=\d{3}\b)/g, "") ?? null;
  const situacao = valido(meta.situacao) ?? valido(meta.situacao_indice);
  const revogada =
    meta.revogada === "true" ||
    meta.vigente_fonte === "false" ||
    /NotInForce/.test(meta.forca_legal_fonte ?? "") ||
    (situacao ? REVOGACAO.test(situacao.trim()) : false);

  const juris = c.esfera === "jurisprudencia";
  const enunciado = juris ? extrairEnunciado(corpo) : null;
  const ementa =
    caminho === "constituicao.md"
      ? "Constituição da República Federativa do Brasil, promulgada em 5 de outubro de 1988: organiza o Estado e os Poderes e estabelece os direitos e garantias fundamentais."
      : limparInline(valido(meta.ementa) ?? enunciado ?? ementaDoCorpo(corpo.replace(/^#\s+.+$/m, "")) ?? "") || null;

  const tipo = valido(meta.tipo) ?? (c.tipoSlug === "constituicao" ? "Constituição Federal" : humanizar(c.tipoSlug));
  const apelido = apelidoConhecido(caminho, c.tipoSlug, numero, ano);

  const { dispositivos, sumario } = juris
    ? {
        dispositivos: [
          { ordem: 0, referencia: titulo, contexto: null, ancora: "enunciado", inicio: 0, fim: corpo.length, texto: enunciado ?? corpo.slice(0, MAX_TRECHO) },
        ],
        sumario: [],
      }
    : analisarEstrutura(corpo, { prefixoAdct: caminho === "constituicao.md" });

  return {
    caminho,
    esfera: c.esfera,
    uf: valido(meta.uf)?.toUpperCase() ?? c.uf,
    municipio: valido(meta.municipio) ?? c.municipio,
    orgao: valido(meta.orgao) ?? valido(meta.tribunal) ?? c.orgao,
    tipo,
    tipoSlug: c.tipoSlug,
    numero,
    ano: ano && ano > 1500 && ano < 2100 ? ano : null,
    data,
    titulo,
    apelido,
    ementa: ementa ? ementa.slice(0, 2000) : null,
    situacao,
    revogada,
    versaoTexto: valido(meta.versao_texto),
    urn: valido(meta.urn),
    fonteUrl: valido(meta.fonte),
    repoUrl: `${repoBase}${caminho}`,
    areas: classificarAreas({ titulo, apelido, ementa, indexacao: null, esfera: c.esfera, tipoSlug: c.tipoSlug }),
    texto: corpo,
    sumario,
    gitSha,
    dispositivos,
  };
}
