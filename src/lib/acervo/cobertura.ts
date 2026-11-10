import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { estatisticasDoAcervo } from "./estatisticas";

/*
 * Cobertura do acervo, mostrada ao assinante para deixar claro o que existe e o
 * que falta (CDC, arts. 6º, III, e 31: informação clara sobre o serviço).
 *
 * A tabela por série reproduz o PROGRESSO.md do projeto ctresb/leis, de onde o
 * acervo é sincronizado: "tem" conta só documentos das séries com universo
 * estimado ("meta"). Atualize os números junto com a sincronização do acervo.
 */

export const FONTE_PROGRESSO = {
  url: "https://github.com/ctresb/leis/blob/main/PROGRESSO.md",
  geradoEm: "28/10/2026",
};

export type SerieCobertura = { serie: string; detalhe: string; tem: number; meta: number };

export const FASES_COBERTURA: { fase: string; series: SerieCobertura[] }[] = [
  {
    fase: "Legislação federal e leis estaduais",
    series: [
      { serie: "Constituição Federal", detalhe: "Texto vigente, constituições históricas e emendas", tem: 180, meta: 180 },
      { serie: "Leis federais", detalhe: "Ordinárias, complementares, delegadas e decretos-leis", tem: 29_433, meta: 29_534 },
      { serie: "Atos do Congresso", detalhe: "Decretos legislativos, medidas provisórias e resoluções", tem: 37_804, meta: 38_248 },
      { serie: "Decretos do Executivo federal", detalhe: "Numerados, não numerados e regulamentos", tem: 117_937, meta: 153_657 },
      { serie: "Leis estaduais e distritais", detalhe: "Constituições, emendas, leis ordinárias e complementares", tem: 295_230, meta: 347_467 },
      { serie: "Tratados internacionais", detalhe: "Direitos humanos, OIT, bitributação e Mercosul", tem: 150, meta: 5_680 },
    ],
  },
  {
    fase: "Atos infralegais e jurisprudência",
    series: [
      { serie: "Jurisprudência vinculante", detalhe: "Súmulas, repercussão geral, repetitivos e controle concentrado", tem: 11_695, meta: 14_803 },
      { serie: "Atos infralegais federais", detalhe: "Agências, ministérios e conselhos (tributário, saúde, trânsito e outros)", tem: 173_542, meta: 269_463 },
      { serie: "Atos infralegais estaduais", detalhe: "Decretos, portarias e resoluções dos estados", tem: 388_204, meta: 577_054 },
    ],
  },
  {
    fase: "Direito municipal",
    series: [
      { serie: "Legislação municipal", detalhe: "Leis orgânicas, leis, decretos e códigos (capitais primeiro)", tem: 36_214, meta: 10_332_713 },
    ],
  },
];

/** Todo estado tem milhares de leis; abaixo disto, a coleta daquela UF está ausente ou incompleta na fonte. */
export const MINIMO_LEIS_ESTADUAIS = 2_000;

/** Contagens por UF a partir do próprio banco (prontas em estatisticas.ts, relidas a cada hora). */
export async function coberturaPorUf() {
  "use cache";
  cacheLife("hours");
  cacheTag("acervo");
  return (await estatisticasDoAcervo()).porUf;
}
