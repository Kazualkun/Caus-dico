import "server-only";
import { gerarEstruturado, MODEL, type Rastreio } from "@/lib/ai/ollama";
import { ParecerPesquisa, PlanoDeBusca, type ResearchData } from "@/lib/ai/schemas";
import { SISTEMA_PESQUISA, SISTEMA_PLANEJAMENTO } from "@/lib/ai/prompts";
import { ETAPAS_PESQUISA, type ReportarEtapa } from "@/lib/ai/etapas";
import { buscarFontes, filtrarIds, fontesCitadas, formatarFontes } from "@/lib/legal/retrieval";
import { verificarCitacoes } from "@/lib/acervo/citacoes";

/**
 * Pesquisa jurídica em três passos: planejar consultas, buscar no acervo
 * (leis, súmulas e temas) e sintetizar a nota de pesquisa citando as fontes.
 */
export async function pesquisar(input: {
  pergunta: string;
  area?: string;
  fatos?: string;
  /** Inclui a legislação deste estado na busca. */
  uf?: string;
  onEtapa?: ReportarEtapa;
  rastreio?: Rastreio;
}): Promise<ResearchData> {
  const etapa = input.onEtapa ?? (() => undefined);
  const pergunta = [
    `<pergunta>${input.pergunta}</pergunta>`,
    input.area ? `<area>${input.area}</area>` : "",
    input.fatos ? `<fatos>${input.fatos}</fatos>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await etapa(ETAPAS_PESQUISA[0]);
  const plano = await gerarEstruturado({
    schema: PlanoDeBusca,
    system: SISTEMA_PLANEJAMENTO,
    content: pergunta,
    effort: "low",
    maxTokens: 2000,
    rastreio: input.rastreio,
  });

  await etapa(ETAPAS_PESQUISA[1]);
  const fontes = await buscarFontes([input.pergunta, ...plano.termos_busca], { limite: 28, uf: input.uf });

  await etapa(ETAPAS_PESQUISA[2]);
  const parecer = await gerarEstruturado({
    schema: ParecerPesquisa,
    system: SISTEMA_PESQUISA,
    content: [formatarFontes(fontes), pergunta],
    effort: "high",
    maxTokens: 8000,
    rastreio: input.rastreio,
  });

  for (const item of parecer.fundamentacao_legal) item.fonte_ids = filtrarIds(item.fonte_ids, fontes);
  const verificacao = await verificarCitacoes(
    parecer.fundamentacao_legal.map((f) => f.dispositivo),
    fontes,
  );
  parecer.fundamentacao_legal.forEach((f, i) => (f.fonte_ids = [...new Set([...f.fonte_ids, ...verificacao.ids[i]])]));
  for (const item of parecer.tendencia_jurisprudencial.precedentes) {
    item.fonte_ids = filtrarIds(item.fonte_ids, fontes);
  }
  // Precedente sem fonte do acervo é descartado: a regra é não citar julgado
  // que não possa ser conferido.
  parecer.tendencia_jurisprudencial.precedentes = parecer.tendencia_jurisprudencial.precedentes.filter(
    (p) => p.fonte_ids.length > 0,
  );

  const usados = [
    ...parecer.fundamentacao_legal.flatMap((f) => f.fonte_ids),
    ...parecer.tendencia_jurisprudencial.precedentes.flatMap((p) => p.fonte_ids),
  ];

  return {
    parecer,
    fontes: fontesCitadas(verificacao.fontes, usados),
    alertasCitacao: verificacao.alertas,
    modelo: MODEL,
    geradoEm: new Date().toISOString(),
  };
}
