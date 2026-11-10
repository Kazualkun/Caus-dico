import "server-only";
import { gerarEstruturado, MODEL, type Rastreio } from "@/lib/ai/ollama";
import { PlanoDeBusca, RecomendacaoPeca, type RecomendacaoPecaData } from "@/lib/ai/schemas";
import { SISTEMA_PECAS, SISTEMA_PLANEJAMENTO } from "@/lib/ai/prompts";
import { ETAPAS_PECA, type ReportarEtapa } from "@/lib/ai/etapas";
import { anonimizar } from "@/lib/anonimizar";
import { buscarFontes, filtrarIds, fontesCitadas, formatarFontes } from "@/lib/legal/retrieval";
import { verificarCitacoes } from "@/lib/acervo/citacoes";
import { AREAS } from "@/lib/pricing/engine";

/**
 * Recomendação de peça processual a partir dos fatos (RAG sobre o acervo): a IA
 * planeja a busca, consulta leis, súmulas e temas (e as leis do estado, se
 * informado) e indica a peça, os requisitos, os fundamentos e os prazos. Não
 * redige a peça: a redação é do advogado.
 */
export async function recomendarPeca(input: {
  polo: "autor" | "reu";
  area: string;
  uf?: string;
  fatos: string;
  objetivo?: string;
  onEtapa?: ReportarEtapa;
  rastreio?: Rastreio;
}): Promise<RecomendacaoPecaData> {
  const etapa = input.onEtapa ?? (() => undefined);
  // Identificadores pessoais não ajudam a escolher a peça: saem antes da IA.
  const fatos = anonimizar(input.fatos).texto;
  const objetivo = input.objetivo ? anonimizar(input.objetivo).texto : "";
  const caso = [
    "<caso>",
    `<polo>${input.polo === "autor" ? "O cliente é o autor (vai iniciar ou provocar o processo)." : "O cliente é o réu (precisa se defender ou responder)."}</polo>`,
    `<area>${AREAS.find((a) => a.id === input.area)?.nome ?? input.area}</area>`,
    input.uf ? `<uf>${input.uf}</uf>` : "",
    `<fatos>${fatos}</fatos>`,
    objetivo ? `<objetivo_do_cliente>${objetivo}</objetivo_do_cliente>` : "",
    "</caso>",
  ]
    .filter(Boolean)
    .join("\n");

  await etapa(ETAPAS_PECA[0]);
  const plano = await gerarEstruturado({
    schema: PlanoDeBusca,
    system: SISTEMA_PLANEJAMENTO,
    content: caso,
    effort: "low",
    maxTokens: 2000,
    rastreio: input.rastreio,
  });

  await etapa(ETAPAS_PECA[1]);
  const fontes = await buscarFontes(plano.termos_busca, { limite: 28, uf: input.uf });

  await etapa(ETAPAS_PECA[2]);
  const recomendacao = await gerarEstruturado({
    schema: RecomendacaoPeca,
    system: SISTEMA_PECAS,
    content: [formatarFontes(fontes), caso],
    effort: "high",
    maxTokens: 8000,
    rastreio: input.rastreio,
  });

  for (const r of recomendacao.requisitos) r.fonte_ids = filtrarIds(r.fonte_ids, fontes);
  for (const f of recomendacao.fundamentos) f.fonte_ids = filtrarIds(f.fonte_ids, fontes);

  // Requisitos, fundamentos e prazos conferidos no acervo de uma vez; os índices são repartidos depois.
  const { requisitos, fundamentos, prazos } = recomendacao;
  const verificacao = await verificarCitacoes(
    [...requisitos.map((r) => r.dispositivo), ...fundamentos.map((f) => f.dispositivo), ...prazos.map((p) => p.dispositivo)],
    fontes,
  );
  const ate = (de: number, n: number) => verificacao.alertas.slice(de, de + n);
  requisitos.forEach((r, i) => (r.fonte_ids = [...new Set([...r.fonte_ids, ...verificacao.ids[i]])]));
  fundamentos.forEach((f, i) => (f.fonte_ids = [...new Set([...f.fonte_ids, ...verificacao.ids[requisitos.length + i]])]));
  const usados = [...requisitos.flatMap((r) => r.fonte_ids), ...fundamentos.flatMap((f) => f.fonte_ids)];

  return {
    recomendacao,
    fontes: fontesCitadas(verificacao.fontes, usados),
    alertasCitacao: {
      requisitos: ate(0, requisitos.length),
      fundamentos: ate(requisitos.length, fundamentos.length),
      prazos: ate(requisitos.length + fundamentos.length, prazos.length),
    },
    modelo: MODEL,
    geradoEm: new Date().toISOString(),
  };
}
