import "server-only";
import { gerarEstruturado } from "@/lib/ai/ollama";
import { CartaProposta } from "@/lib/ai/schemas";
import { SISTEMA_PROPOSTA } from "@/lib/ai/prompts";
import { AREAS, COMPLEXIDADES, FORMATOS } from "@/lib/pricing/engine";
import { descreverHonorarios } from "@/lib/pricing/proposal";
import type { ProposalRow } from "@/lib/types";

export async function redigirCarta(proposta: ProposalRow, advogado: { id: string; nome: string; oab: string | null }) {
  return gerarEstruturado({
    schema: CartaProposta,
    system: SISTEMA_PROPOSTA,
    content: [
      `<advogado>${advogado.nome}${advogado.oab ? `, OAB ${advogado.oab}` : ""}</advogado>`,
      `<cliente>${proposta.clientName}</cliente>`,
      `<caso>${proposta.caseTitle}</caso>`,
      `<area>${AREAS.find((a) => a.id === proposta.area)?.nome ?? proposta.area}</area>`,
      `<complexidade>${COMPLEXIDADES[proposta.inputs.complexidade].nome}</complexidade>`,
      `<honorarios formato="${FORMATOS[proposta.billingFormat]}">${descreverHonorarios(proposta)}</honorarios>`,
    ].join("\n"),
    effort: "low",
    maxTokens: 8000,
    rastreio: { userId: advogado.id, recurso: "carta", referenciaId: proposta.id },
  });
}
