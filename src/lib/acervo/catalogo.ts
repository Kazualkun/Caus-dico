/** Nomes legíveis para filtros e rótulos do acervo (compartilhado com o navegador). */
import type { Esfera } from "./parser";

export const ESFERA_NOME: Record<Esfera, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
  jurisprudencia: "Jurisprudência",
  regulador: "Agências e órgãos federais",
  tratado: "Tratados e convenções",
};

export const TIPOS_FILTRO: { slug: string; nome: string }[] = [
  { slug: "constituicao", nome: "Constituição" },
  { slug: "emendas-constitucionais", nome: "Emendas constitucionais" },
  { slug: "leis-complementares", nome: "Leis complementares" },
  { slug: "leis-ordinarias", nome: "Leis ordinárias" },
  { slug: "decretos-lei", nome: "Decretos-leis" },
  { slug: "medidas-provisorias", nome: "Medidas provisórias" },
  { slug: "decretos", nome: "Decretos" },
  { slug: "decretos-legislativos", nome: "Decretos legislativos" },
  { slug: "portarias", nome: "Portarias" },
  { slug: "resolucoes", nome: "Resoluções" },
  { slug: "sumulas-vinculantes", nome: "Súmulas vinculantes" },
  { slug: "sumulas", nome: "Súmulas" },
  { slug: "repetitivos", nome: "Temas repetitivos (STJ)" },
  { slug: "repercussao-geral", nome: "Repercussão geral (STF)" },
  { slug: "controle-concentrado", nome: "Controle concentrado (ADI, ADC, ADPF)" },
];

export function nomeDoTipo(slug: string) {
  return TIPOS_FILTRO.find((t) => t.slug === slug)?.nome ?? slug.replace(/-/g, " ");
}

/** "Federal", "SP", "SP · São Paulo" etc. para a etiqueta de origem da norma. */
export function origemDaNorma(n: { esfera: Esfera; uf: string | null; municipio: string | null; orgao: string | null }) {
  if (n.esfera === "estadual") return `Estadual, ${n.uf}`;
  if (n.esfera === "municipal") return `${n.municipio ?? "Municipal"}, ${n.uf}`;
  if (n.esfera === "jurisprudencia") return n.orgao ?? "Jurisprudência";
  if (n.esfera === "regulador") return n.orgao ?? "Órgão federal";
  return ESFERA_NOME[n.esfera];
}
