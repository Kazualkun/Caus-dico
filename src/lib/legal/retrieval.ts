import "server-only";
import { buscarDispositivos } from "@/lib/acervo/busca";
import type { Esfera } from "@/lib/acervo/parser";
import type { FonteCitada } from "@/lib/ai/schemas";

/**
 * O contexto da IA local é limitado: o bloco <fontes> fica em ~22 mil caracteres
 * (≈ 6 mil tokens) e cada trecho entra com no máximo 1.800. O texto integral
 * continua acessível pelo link da norma em cada fonte citada.
 */
const MAX_CARACTERES_FONTES = 22_000;
const MAX_CARACTERES_TRECHO = 1_800;

/**
 * Busca no acervo os trechos mais relevantes para as consultas e os numera
 * F1..Fn para o modelo citar. Por padrão: legislação federal e jurisprudência;
 * com `uf`, inclui a legislação daquele estado.
 */
export async function buscarFontes(
  termos: string[],
  opts: { esferas?: Esfera[]; uf?: string; limite?: number; maxCaracteres?: number } = {},
): Promise<FonteCitada[]> {
  const trechos = await buscarDispositivos(termos, { esferas: opts.esferas, uf: opts.uf, limite: opts.limite });
  // Os trechos vêm do mais para o menos relevante; entram até esgotar o orçamento do prompt.
  const orcamento = opts.maxCaracteres ?? MAX_CARACTERES_FONTES;
  const escolhidos: typeof trechos = [];
  let total = 0;
  for (const t of trechos) {
    total += Math.min(t.texto.length, MAX_CARACTERES_TRECHO);
    if (total > orcamento) break;
    escolhidos.push(t);
  }
  return escolhidos.map((t, i) => ({ id: `F${i + 1}`, ...t }));
}

/** Bloco <fontes> para o prompt. */
export function formatarFontes(fontes: FonteCitada[]) {
  if (fontes.length === 0) {
    return "<fontes>\nNenhum trecho relevante foi encontrado no acervo para esta consulta.\n</fontes>";
  }
  const itens = fontes.map((f) => {
    const origem = f.apelido ? `${f.apelido} (${f.titulo})` : f.titulo;
    const texto = f.texto.length > MAX_CARACTERES_TRECHO ? `${f.texto.slice(0, MAX_CARACTERES_TRECHO)} […]` : f.texto;
    return `<fonte id="${f.id}" origem="${origem}" referencia="${f.referencia}">\n${texto}\n</fonte>`;
  });
  return `<fontes>\n${itens.join("\n")}\n</fontes>`;
}

/** Remove das respostas os ids de fonte que não existem (o modelo não pode inventar fonte). */
export function filtrarIds(ids: string[], fontes: FonteCitada[]) {
  const validos = new Set(fontes.map((f) => f.id));
  return ids.filter((id) => validos.has(id));
}

/** Mantém só as fontes efetivamente citadas, para gravar junto do resultado. */
export function fontesCitadas(fontes: FonteCitada[], ids: Iterable<string>) {
  const usados = new Set(ids);
  return fontes.filter((f) => usados.has(f.id));
}
