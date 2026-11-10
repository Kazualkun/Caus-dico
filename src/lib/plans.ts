export type PlanId = "basico" | "profissional" | "escritorio";
export type Cycle = "mensal" | "anual";
export type Recurso = "analises" | "pesquisas";

export type Plan = {
  id: PlanId;
  nome: string;
  publico: string;
  precoMensalCents: number;
  /** Anual = 10 mensalidades (dois meses sem custo). */
  precoAnualCents: number;
  limites: Record<Recurso, number>;
  destaques: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  basico: {
    id: "basico",
    nome: "Básico",
    publico: "Para quem advoga sozinho e quer sair do improviso na precificação.",
    precoMensalCents: 8900,
    precoAnualCents: 89000,
    limites: { analises: 15, pesquisas: 40 },
    destaques: [
      "Calculadora de honorários com análise do caso por IA e propostas em PDF",
      "15 auditorias de contrato por mês",
      "40 pesquisas ou recomendações de peça por mês",
      "Prazos, clientes e link de triagem sem limite",
    ],
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    publico: "Para a rotina de quem revisa contratos e pesquisa toda semana.",
    precoMensalCents: 18900,
    precoAnualCents: 189000,
    limites: { analises: 60, pesquisas: 200 },
    destaques: [
      "Tudo do Básico",
      "60 auditorias de contrato por mês",
      "200 pesquisas ou recomendações de peça por mês",
    ],
  },
  escritorio: {
    id: "escritorio",
    nome: "Escritório",
    publico: "Para escritórios com volume alto de contratos e pareceres.",
    precoMensalCents: 44900,
    precoAnualCents: 449000,
    limites: { analises: 250, pesquisas: 1000 },
    destaques: [
      "Tudo do Profissional",
      "250 auditorias de contrato por mês",
      "1.000 pesquisas ou recomendações de peça por mês",
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export function isCycle(value: unknown): value is Cycle {
  return value === "mensal" || value === "anual";
}

export function planPriceCents(plan: PlanId, cycle: Cycle) {
  return cycle === "anual" ? PLANS[plan].precoAnualCents : PLANS[plan].precoMensalCents;
}

export const RECURSO_LABEL: Record<Recurso, string> = {
  analises: "Auditorias de contrato",
  pesquisas: "Pesquisas e recomendações de peça",
};
