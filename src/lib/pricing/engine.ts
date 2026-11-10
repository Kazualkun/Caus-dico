/**
 * Motor de precificação de honorários. Funções puras: rodam no navegador
 * (calculadora ao vivo) e no servidor (recalculo ao salvar a proposta).
 * Valores monetários sempre em centavos.
 */

export type Complexidade = "baixa" | "media" | "alta" | "muito_alta";
export type Risco = "baixo" | "medio" | "alto";
export type BillingFormat = "fixo" | "exito" | "misto" | "hora";

export const AREAS = [
  { id: "civel", nome: "Cível" },
  { id: "consumidor", nome: "Consumidor" },
  { id: "familia", nome: "Família e sucessões" },
  { id: "trabalhista", nome: "Trabalhista" },
  { id: "empresarial", nome: "Empresarial" },
  { id: "contratos", nome: "Contratos e consultivo" },
  { id: "tributario", nome: "Tributário" },
  { id: "criminal", nome: "Criminal" },
  { id: "previdenciario", nome: "Previdenciário" },
] as const;

export const FORMATOS: Record<BillingFormat, string> = {
  fixo: "Valor fixo",
  exito: "Êxito (quota litis)",
  misto: "Misto: fixo + êxito",
  hora: "Por hora",
};

export const COMPLEXIDADES: Record<Complexidade, { nome: string; fator: number }> = {
  baixa: { nome: "Baixa", fator: 1 },
  media: { nome: "Média", fator: 1.2 },
  alta: { nome: "Alta", fator: 1.45 },
  muito_alta: { nome: "Muito alta", fator: 1.75 },
};

/** Risco de resultado desfavorável ao cliente. */
export const RISCOS: Record<Risco, { nome: string; fator: number; probabilidadeExito: number; ajusteExito: number }> = {
  baixo: { nome: "Baixo", fator: 1, probabilidadeExito: 0.75, ajusteExito: -5 },
  medio: { nome: "Médio", fator: 1.1, probabilidadeExito: 0.5, ajusteExito: 0 },
  alto: { nome: "Alto", fator: 1.25, probabilidadeExito: 0.3, ajusteExito: 5 },
};

const AJUSTE_EXITO_COMPLEXIDADE: Record<Complexidade, number> = { baixa: 0, media: 0, alta: 2.5, muito_alta: 5 };
const PERCENTUAL_EXITO_BASE = 20;
const PERCENTUAL_REFERENCIA_CAUSA = 0.1;

export type PricingInputs = {
  custosFixosMensaisCents: number;
  horasProdutivasMes: number;
  margemPercentual: number;
  /** Quanto o advogado quer receber por hora, já descontados impostos e repasse. */
  valorHoraCents: number;
  horasEstimadas: number;
  valorCausaCents: number;
  complexidade: Complexidade;
  risco: Risco;
  /** Impostos sobre os honorários recebidos (%). Ausente nas propostas antigas: 0. */
  impostoPercentual?: number;
  /** Parte dos honorários repassada ao advogado que indicou o cliente (%). Ausente: 0. */
  repassePercentual?: number;
};

export type FormatoCalculado = {
  /** Valor principal do formato (no êxito, o valor se o cliente ganhar). */
  valorCents: number;
  percentual?: number;
  valorFixoCents?: number;
  /** Valor esperado ponderado pela probabilidade de êxito. */
  valorEsperadoCents?: number;
  faixaCents?: [number, number];
  observacao: string;
};

export type PricingResult = {
  custoHoraCents: number;
  pisoHoraCents: number;
  /** Valor-hora cobrado do cliente (bruto); o líquido é o valor-hora informado. */
  valorHoraEfetivoCents: number;
  /** Mínimo aceitável, cobrado do cliente: já inclui impostos e repasse. Abaixo dele, o caso não cobre custos e margem. */
  minimoCents: number;
  medioCents: number;
  idealCents: number;
  probabilidadeExito: number;
  /** Percentuais aplicados (ausentes nas propostas antigas). */
  impostoPercentual?: number;
  repassePercentual?: number;
  formatos: Record<BillingFormat, FormatoCalculado>;
  memoria: string[];
  alertas: string[];
};

export const INPUTS_PADRAO: PricingInputs = {
  custosFixosMensaisCents: 1_200_000,
  horasProdutivasMes: 120,
  margemPercentual: 30,
  valorHoraCents: 35_000,
  horasEstimadas: 20,
  valorCausaCents: 8_000_000,
  complexidade: "media",
  risco: "medio",
  impostoPercentual: 4.5,
  repassePercentual: 0,
};

/** Soma máxima de impostos e repasse: acima disso o valor cobrado explode e o cálculo perde sentido. */
const RETENCAO_MAXIMA = 0.8;

/** Fração do valor cobrado que fica com o advogado depois de impostos e repasse. */
export function fracaoLiquida(i: Pick<PricingInputs, "impostoPercentual" | "repassePercentual">) {
  const retencao = (Math.max(0, i.impostoPercentual ?? 0) + Math.max(0, i.repassePercentual ?? 0)) / 100;
  return 1 - Math.min(RETENCAO_MAXIMA, retencao);
}

/** Como um valor cobrado do cliente se divide entre impostos, repasse por indicação e o líquido do advogado. */
export function dividirValor(brutoCents: number, i: Pick<PricingInputs, "impostoPercentual" | "repassePercentual">) {
  const imposto = Math.max(0, i.impostoPercentual ?? 0);
  const repasse = Math.max(0, i.repassePercentual ?? 0);
  // Acima do teto, os dois são reduzidos na mesma proporção, como no cálculo.
  const escala = imposto + repasse > 0 ? ((1 - fracaoLiquida(i)) * 100) / (imposto + repasse) : 0;
  const impostoCents = Math.round((brutoCents * imposto * escala) / 100);
  const repasseCents = Math.round((brutoCents * repasse * escala) / 100);
  return { brutoCents, impostoCents, repasseCents, liquidoCents: brutoCents - impostoCents - repasseCents };
}

/** Arredonda para cima, de R$ 50 em R$ 50, como se apresenta numa proposta. */
const arredondar = (cents: number) => Math.ceil(cents / 5000) * 5000;
const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const meioPonto = (n: number) => Math.round(n * 2) / 2;
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function calcularHonorarios(i: PricingInputs): PricingResult {
  const horasMes = Math.max(1, i.horasProdutivasMes);
  const horas = Math.max(0.5, i.horasEstimadas);
  const complexidade = COMPLEXIDADES[i.complexidade];
  const risco = RISCOS[i.risco];
  const alertas: string[] = [];

  const impostoPct = Math.max(0, i.impostoPercentual ?? 0);
  const repassePct = Math.max(0, i.repassePercentual ?? 0);
  const liquida = fracaoLiquida(i);
  // O advogado precisa receber o líquido; o cliente paga o bruto, que cobre impostos e repasse.
  const bruto = (liquido: number) => liquido / liquida;

  const custoHora = i.custosFixosMensaisCents / horasMes;
  const pisoHora = custoHora * (1 + Math.max(0, i.margemPercentual) / 100);
  const horaLiquida = Math.max(i.valorHoraCents, pisoHora);
  const horaEfetiva = bruto(horaLiquida);

  if (i.valorHoraCents < pisoHora) {
    alertas.push(
      `O valor-hora informado (${reais(i.valorHoraCents)}) não cobre custos e margem. O cálculo usou o piso de ${reais(pisoHora)}/h.`,
    );
  }
  if (horasMes > 180) {
    alertas.push("Mais de 180 horas faturáveis por mês é uma premissa otimista e reduz artificialmente o custo-hora.");
  }
  if (impostoPct + repassePct > RETENCAO_MAXIMA * 100) {
    alertas.push(`Impostos e repasse somam mais de ${RETENCAO_MAXIMA * 100}%. O cálculo limitou a soma a ${RETENCAO_MAXIMA * 100}%; revise os percentuais.`);
  }
  if (repassePct > 0) {
    alertas.push(
      "O repasse por indicação só pode ir para outro advogado: dividir honorários com quem não é advogado por ter trazido o cliente é infração ética (Estatuto da Advocacia, art. 34, III e IV). Formalize a divisão por escrito.",
    );
  }

  const minimoLiquido = horas * pisoHora * complexidade.fator;
  const minimo = arredondar(bruto(minimoLiquido));
  const medio = arredondar(horas * horaEfetiva * complexidade.fator * risco.fator);
  const referenciaCausa = i.valorCausaCents * PERCENTUAL_REFERENCIA_CAUSA;
  const ideal = arredondar(Math.max(medio * 1.3, Math.min(referenciaCausa, medio * 3)));

  const percentualExito = Math.min(
    30,
    Math.max(10, PERCENTUAL_EXITO_BASE + risco.ajusteExito + AJUSTE_EXITO_COMPLEXIDADE[i.complexidade]),
  );
  const percentualMisto = Math.max(5, meioPonto(percentualExito / 2));
  const fixoMisto = arredondar(minimo * 0.6);
  const semCausa = i.valorCausaCents <= 0;

  const avisoQuotaLitis =
    "Pelo art. 50 do Código de Ética e Disciplina da OAB, os honorários de êxito somados aos de sucumbência não podem superar a vantagem obtida pelo cliente.";

  const formatos: Record<BillingFormat, FormatoCalculado> = {
    fixo: {
      valorCents: medio,
      observacao: "Valor recomendado para cobrança fechada. Pode ser parcelado ao longo do caso.",
    },
    exito: {
      valorCents: Math.round(i.valorCausaCents * (percentualExito / 100)),
      percentual: percentualExito,
      valorEsperadoCents: Math.round(i.valorCausaCents * (percentualExito / 100) * risco.probabilidadeExito),
      observacao: semCausa
        ? "Informe o valor da causa para estimar o êxito."
        : liquida < 1
          ? `${avisoQuotaLitis} Impostos e repasse saem do percentual: você fica com ${pct(percentualExito * liquida)} do proveito.`
          : avisoQuotaLitis,
    },
    misto: {
      valorCents: fixoMisto,
      valorFixoCents: fixoMisto,
      percentual: percentualMisto,
      valorEsperadoCents: Math.round(
        fixoMisto + i.valorCausaCents * (percentualMisto / 100) * risco.probabilidadeExito,
      ),
      observacao: "A parte fixa cobre o custo operacional do caso; o êxito remunera o resultado.",
    },
    hora: {
      valorCents: Math.round(horaEfetiva * horas),
      faixaCents: [Math.round(horaEfetiva * horas * 0.8), Math.round(horaEfetiva * horas * 1.3)],
      observacao: "Indicado para consultivo e casos de escopo incerto. Envie relatórios de horas ao cliente.",
    },
  };

  if (!semCausa && formatos.exito.valorEsperadoCents! < minimo) {
    alertas.push(
      "Com o risco informado, o valor esperado do êxito puro fica abaixo do mínimo que cobre seus custos. Considere o formato misto.",
    );
  }

  const memoria = [
    `Custo-hora do escritório: ${reais(i.custosFixosMensaisCents)} ÷ ${horasMes} h = ${reais(custoHora)}/h.`,
    `Piso com margem de ${i.margemPercentual}%: ${reais(pisoHora)}/h líquidos. Valor-hora líquido aplicado: ${reais(horaLiquida)}/h.`,
    liquida < 1
      ? `Impostos de ${pct(impostoPct)}${repassePct ? ` e repasse por indicação de ${pct(repassePct)}` : ""}: o valor cobrado do cliente é o líquido ÷ ${liquida.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}. Valor-hora cobrado: ${reais(horaEfetiva)}/h.`
      : "Sem impostos nem repasse informados: o valor cobrado é igual ao líquido.",
    `Mínimo aceitável: ${horas} h × piso × complexidade ${complexidade.nome.toLowerCase()} (${complexidade.fator}) = ${reais(minimoLiquido)} líquidos, ou ${reais(minimo)} cobrados do cliente. Abaixo disso, o caso não cobre seus custos e sua margem.`,
    `Médio: ${horas} h × valor-hora cobrado × complexidade (${complexidade.fator}) × risco ${risco.nome.toLowerCase()} (${risco.fator}) = ${reais(medio)}.`,
    semCausa
      ? `Ideal: médio + 30% de prêmio pelo valor entregue = ${reais(ideal)}.`
      : `Ideal: o maior entre médio + 30% e ${PERCENTUAL_REFERENCIA_CAUSA * 100}% do valor da causa (limitado a 3× o médio) = ${reais(ideal)}.`,
    `Êxito: ${PERCENTUAL_EXITO_BASE}% de base, ajustado pelo risco e pela complexidade, entre 10% e 30%: ${percentualExito}%. Probabilidade de êxito considerada: ${risco.probabilidadeExito * 100}%.`,
  ];

  return {
    custoHoraCents: Math.round(custoHora),
    pisoHoraCents: Math.round(pisoHora),
    valorHoraEfetivoCents: Math.round(horaEfetiva),
    minimoCents: minimo,
    medioCents: medio,
    idealCents: ideal,
    probabilidadeExito: risco.probabilidadeExito,
    impostoPercentual: impostoPct,
    repassePercentual: repassePct,
    formatos,
    memoria,
    alertas,
  };
}

export type ReferenciaOab = {
  servico: string;
  valorMinimoCents: number | null;
  percentualMinimo: number | null;
  ilustrativo: boolean;
};

/** Mínimo da tabela da OAB para o caso: o maior entre o valor fixo e o percentual sobre a causa. */
export function minimoOab(ref: ReferenciaOab, valorCausaCents: number) {
  const fixo = ref.valorMinimoCents ?? 0;
  const percentual = ref.percentualMinimo ? Math.round(valorCausaCents * (Number(ref.percentualMinimo) / 100)) : 0;
  return Math.max(fixo, percentual);
}

export function valorProposto(result: PricingResult, formato: BillingFormat) {
  return formato === "exito" ? null : result.formatos[formato].valorCents;
}
