import { formatBRL, formatPercent } from "@/lib/format";
import type { CartaProposta } from "@/lib/ai/schemas";
import type { ProposalRow } from "@/lib/types";

/** Condição de honorários da proposta, em uma frase. */
export function descreverHonorarios(p: Pick<ProposalRow, "billingFormat" | "result" | "inputs" | "proposedValueCents">) {
  const formato = p.result.formatos[p.billingFormat];
  switch (p.billingFormat) {
    case "fixo":
      return `Honorários fixos de ${formatBRL(p.proposedValueCents ?? formato.valorCents)}.`;
    case "exito":
      return `Honorários de êxito de ${formatPercent(formato.percentual ?? 0)} sobre o proveito econômico efetivamente obtido pelo cliente.`;
    case "misto":
      return `Parcela fixa de ${formatBRL(formato.valorFixoCents ?? 0)}, acrescida de honorários de êxito de ${formatPercent(formato.percentual ?? 0)} sobre o proveito econômico efetivamente obtido.`;
    case "hora": {
      const [min, max] = formato.faixaCents ?? [formato.valorCents, formato.valorCents];
      return `${formatBRL(p.result.valorHoraEfetivoCents)} por hora trabalhada, com estimativa inicial de ${p.inputs.horasEstimadas} horas (entre ${formatBRL(min)} e ${formatBRL(max)}).`;
    }
  }
}

/** Carta usada quando o advogado ainda não pediu a redação com IA. */
export function cartaPadrao(p: Pick<ProposalRow, "clientName" | "caseTitle">): CartaProposta {
  return {
    apresentacao: `Prezado(a) ${p.clientName}, conforme conversamos, apresento a proposta de honorários para a atuação em: ${p.caseTitle}.`,
    escopo: [p.caseTitle],
    fora_do_escopo: [
      "Custas processuais, emolumentos, perícias e despesas de deslocamento ou diligência",
      "Atuação em recursos aos tribunais superiores, salvo ajuste específico",
    ],
    justificativa_valor: "",
  };
}

export const CONDICOES_GERAIS = [
  "Esta proposta é válida por 15 dias a contar da data de emissão.",
  "Os honorários de sucumbência, se houver, pertencem ao advogado, nos termos do art. 23 da Lei nº 8.906/1994.",
  "Aceita a proposta, as condições serão formalizadas em contrato de honorários.",
];
