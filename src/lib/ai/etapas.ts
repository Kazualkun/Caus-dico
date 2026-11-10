/** Etapas exibidas enquanto uma tarefa de IA roda (gravadas na coluna `progress`). */

export const ETAPAS_ANALISE = [
  "Lendo o contrato e planejando a busca",
  "Consultando leis e súmulas no acervo",
  "Analista e Pesquisador revisando as cláusulas",
  "Estrategista consolidando o parecer",
] as const;

export const ETAPAS_PESQUISA = [
  "Planejando a pesquisa",
  "Consultando leis, súmulas e temas no acervo",
  "Redigindo a nota de pesquisa",
] as const;

export const ETAPAS_PECA = [
  "Planejando a busca",
  "Consultando leis, súmulas e temas no acervo",
  "Montando a recomendação da peça",
] as const;

export type ReportarEtapa = (etapa: string) => PromiseLike<unknown> | void;
