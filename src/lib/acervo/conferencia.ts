/**
 * Conferência de um texto legal com a fonte oficial.
 *
 * A página oficial é baixada (só de domínios públicos: gov.br, leg.br, jus.br,
 * mp.br, def.br), o texto riscado — que nas compilações oficiais é o revogado —
 * é descartado, e cada artigo do texto conferido é procurado na página. As
 * notas de alteração ("Redação dada pela Lei…", "Vide…") e a pontuação são
 * ignoradas dos dois lados. Também lista os artigos vigentes na fonte que
 * faltam no texto. Funções puras, exceto a que baixa a página.
 */
import { createHash } from "node:crypto";
import { analisarEstrutura, semAcento, slug } from "./parser";
import { USER_AGENT } from "./oficial";
import type { Conferencia } from "./tipos-curadoria";

const SUFIXOS_OFICIAIS = [".gov.br", ".leg.br", ".jus.br", ".mp.br", ".def.br"];
const LIMITE_BYTES = 25 * 1024 * 1024;
const TEMPO_MAXIMO_MS = 25_000;

/** Endereço aceito como fonte oficial, ou null. */
export function fonteOficialValida(endereco: string): URL | null {
  let u: URL;
  try {
    u = new URL(endereco.trim());
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  return SUFIXOS_OFICIAIS.some((s) => host.endsWith(s)) ? u : null;
}

/** SHA-256 do texto, igual a encode(sha256(convert_to(texto, 'UTF8')), 'hex') no PostgreSQL. */
export const hashDoTexto = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

// ---------------------------------------------------------------------------
// HTML → texto
// ---------------------------------------------------------------------------

const MARCAS: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧" };
const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", deg: "°", sect: "§",
  ndash: "–", mdash: "—", hellip: "…", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", shy: "",
};

function decodificarEntidades(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, nome: string) => {
    if (nome[0] === "#") {
      const codigo = nome[1] === "x" || nome[1] === "X" ? parseInt(nome.slice(2), 16) : Number(nome.slice(1));
      return Number.isFinite(codigo) && codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : " ";
    }
    if (nome in ENTIDADES) return ENTIDADES[nome];
    const acento = nome.match(/^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i);
    return acento ? (acento[1] + MARCAS[acento[2].toLowerCase()]).normalize("NFC") : inteira;
  });
}

/** Texto legível de uma página HTML, um parágrafo por linha, sem o texto riscado (revogado). */
export function htmlParaTexto(html: string) {
  return decodificarEntidades(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|head|noscript)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(strike|s|del)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(span|font|p|div)\b[^>]*line-through[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|tr|td|h[1-6]|table|blockquote|center)>/gi, "\n")
      // Marcas de formatação no meio da palavra ("1<sup>o</sup>") não viram espaço.
      .replace(/<\/?(span|sup|sub|b|strong|i|em|u|a|font|small|abbr)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Comparação
// ---------------------------------------------------------------------------

/** Notas editoriais das compilações, que variam de fonte para fonte. */
const ANOTACAO =
  /\(\s*(?:reda[çc][ãa]o dada|inclu[ií]d[oa]|acrescid[oa]|acrescentad[oa]|revogad[oa]|vide|vig[êe]ncia|renumerad[oa]|regulamento|regulamenta[çc][ãa]o|produ[çc][ãa]o de efeitos?|express[ãa]o suprimida|suprimid[oa]|alterad[oa]|vigora|mensagem de veto|promulga[çc][ãa]o|convers[ãa]o|transformad[oa])[^()]*(?:\([^()]*\)[^()]*)*\)/gi;

/** Forma canônica para comparar: sem notas, acentos, pontuação e marcação. */
export function normalizarParaConferencia(t: string) {
  return semAcento(t.replace(ANOTACAO, " "))
    .toLowerCase()
    .replace(/[º°]/g, "o")
    .replace(/ª/g, "a")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d) o\b/g, "$1o")
    .replace(/\s+/g, " ")
    .trim();
}

const chaveDoArtigo = (referencia: string) => slug(referencia.replace(/\s*\(parte \d+\)$/, ""));

type Trecho = { rotulo: string; texto: string };

/** Artigos do texto; em textos sem artigos, os parágrafos. */
function trechosDe(texto: string): Trecho[] {
  const { dispositivos } = analisarEstrutura(texto);
  if (dispositivos.some((d) => /^(ADCT, )?Art/.test(d.referencia))) {
    return dispositivos.map((d) => ({ rotulo: d.referencia, texto: d.texto }));
  }
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => normalizarParaConferencia(l).length >= 20 && !/^#\s/.test(l))
    .map((l) => ({ rotulo: `"${l.replace(/[*#]/g, "").slice(0, 60)}…"`, texto: l }));
}

function trechoConfere(trecho: string, fonte: string) {
  const n = normalizarParaConferencia(trecho);
  if (!n || fonte.includes(n)) return true;
  // Notas e quebras podem separar os parágrafos de um artigo de outro jeito: confere linha a linha.
  const linhas = trecho
    .split("\n")
    .map(normalizarParaConferencia)
    .filter((l) => l.length >= 8);
  return linhas.length > 0 && linhas.every((l) => fonte.includes(l));
}

/** Compara um texto com o texto (já extraído) da página oficial. */
export function compararComFonte(texto: string, textoFonte: string, fonte: string): Conferencia {
  const verificadaEm = new Date().toISOString();
  const fonteNormalizada = ` ${normalizarParaConferencia(textoFonte)} `;
  if (fonteNormalizada.length < 200) {
    return { status: "indisponivel", fonte, verificadaEm, artigos: 0, conferidos: 0, divergentes: [], faltando: [], detalhe: "A página da fonte não tem texto legível suficiente para conferir." };
  }

  const trechos = trechosDe(texto);
  const divergentes = trechos.filter((t) => !trechoConfere(t.texto, fonteNormalizada)).map((t) => t.rotulo);

  // Artigos vigentes na fonte (o riscado já saiu) que não existem no texto.
  const nossos = new Set(trechos.map((t) => chaveDoArtigo(t.rotulo)));
  const daFonte = analisarEstrutura(textoFonte).dispositivos.filter((d) => /^Art/.test(d.referencia));
  const vistos = new Set<string>();
  const faltando = daFonte
    .map((d) => d.referencia.replace(/\s*\(parte \d+\)$/, ""))
    .filter((r) => {
      const k = chaveDoArtigo(r);
      if (nossos.has(k) || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

  const confere = trechos.length > 0 && divergentes.length === 0 && faltando.length === 0;
  return {
    status: confere ? "confere" : "divergente",
    fonte,
    verificadaEm,
    artigos: trechos.length,
    conferidos: trechos.length - divergentes.length,
    divergentes: divergentes.slice(0, 50),
    faltando: faltando.slice(0, 50),
    detalhe: trechos.length === 0 ? "O texto conferido não tem artigos nem parágrafos para comparar." : null,
  };
}

// ---------------------------------------------------------------------------
// Download da fonte
// ---------------------------------------------------------------------------

async function lerComLimite(res: Response) {
  const leitor = res.body?.getReader();
  if (!leitor) return new Uint8Array();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      throw new Error("a página passa de 25 MB");
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    bytes.set(p, pos);
    pos += p.byteLength;
  }
  return bytes;
}

function decodificar(bytes: Uint8Array, contentType: string) {
  const inicio = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const charset =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? inicio.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Baixa a página oficial e devolve o texto legível, ou o motivo de não ter conseguido. */
export async function textoDaFonte(endereco: string): Promise<{ texto: string } | { erro: string }> {
  const url = fonteOficialValida(endereco);
  if (!url) return { erro: "A fonte precisa ser um endereço oficial (gov.br, leg.br, jus.br, mp.br ou def.br)." };
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_MAXIMO_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
      redirect: "follow",
      signal: controle.signal,
    });
    if (!fonteOficialValida(res.url)) return { erro: "A fonte redirecionou para um endereço fora dos domínios oficiais." };
    if (!res.ok) return { erro: `A fonte respondeu com erro HTTP ${res.status}.` };
    const tipo = res.headers.get("content-type") ?? "";
    if (/pdf|msword|officedocument/i.test(tipo)) {
      return { erro: "A fonte é um arquivo (PDF ou Word); a conferência automática lê páginas HTML ou texto." };
    }
    const conteudo = decodificar(await lerComLimite(res), tipo);
    const html = /html/i.test(tipo) || /<(html|body|p)[\s>]/i.test(conteudo.slice(0, 5000));
    return { texto: html ? htmlParaTexto(conteudo) : conteudo };
  } catch (e) {
    return {
      erro: controle.signal.aborted
        ? `A fonte não respondeu em ${TEMPO_MAXIMO_MS / 1000} segundos.`
        : `Não foi possível acessar a fonte (${e instanceof Error ? e.message : String(e)}).`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Baixa a fonte e confere o texto com ela. */
export async function conferirComFonte(texto: string, endereco: string): Promise<Conferencia> {
  const r = await textoDaFonte(endereco);
  if ("erro" in r) {
    return { status: "indisponivel", fonte: endereco, verificadaEm: new Date().toISOString(), artigos: 0, conferidos: 0, divergentes: [], faltando: [], detalhe: r.erro };
  }
  return compararComFonte(texto, r.texto, endereco);
}

// ---------------------------------------------------------------------------
// Diferenças entre duas versões (para o revisor)
// ---------------------------------------------------------------------------

export type DiferencaArtigo = { referencia: string; antes: string | null; depois: string | null };

/** Artigos incluídos, removidos e alterados entre duas versões de um texto. */
export function compararVersoes(antes: string, depois: string): DiferencaArtigo[] {
  if (antes === depois) return [];
  const mapa = (t: string) => {
    const m = new Map<string, { referencia: string; texto: string }>();
    for (const tr of trechosDe(t)) {
      const chave = chaveDoArtigo(tr.rotulo);
      const existente = m.get(chave);
      m.set(chave, { referencia: tr.rotulo, texto: existente ? `${existente.texto}\n${tr.texto}` : tr.texto });
    }
    return m;
  };
  const a = mapa(antes);
  const d = mapa(depois);
  const saida: DiferencaArtigo[] = [];
  for (const [chave, x] of d) {
    const y = a.get(chave);
    if (!y) saida.push({ referencia: x.referencia, antes: null, depois: x.texto });
    else if (y.texto.trim() !== x.texto.trim()) saida.push({ referencia: x.referencia, antes: y.texto, depois: x.texto });
  }
  for (const [chave, y] of a) if (!d.has(chave)) saida.push({ referencia: y.referencia, antes: y.texto, depois: null });
  // Mudança fora dos artigos (preâmbulo, títulos): mostra que o texto mudou mesmo sem artigo alterado.
  if (saida.length === 0) saida.push({ referencia: "Fora dos artigos (títulos, preâmbulo ou fecho)", antes: null, depois: null });
  return saida;
}
