import type { Esfera } from "./parser";

/** Dados de identificação de uma norma, como a curadoria os edita. */
export type DadosNorma = {
  esfera: Esfera;
  uf: string | null;
  municipio: string | null;
  orgao: string | null;
  tipo: string;
  tipoSlug: string;
  numero: string | null;
  ano: number | null;
  data: string | null;
  titulo: string;
  apelido: string | null;
  ementa: string | null;
  situacao: string | null;
  revogada: boolean;
};

/**
 * Resultado da conferência automática de um texto com a fonte oficial:
 * cada artigo do texto é procurado na página oficial (sem o texto riscado,
 * que é o revogado), e os artigos da página que faltam no texto são listados.
 */
export type Conferencia = {
  status: "confere" | "divergente" | "indisponivel";
  fonte: string;
  verificadaEm: string;
  /** Artigos (ou parágrafos, em textos sem artigos) do texto conferido. */
  artigos: number;
  conferidos: number;
  /** Artigos do texto que não aparecem iguais na fonte (no máximo 50). */
  divergentes: string[];
  /** Artigos vigentes na fonte que não estão no texto (no máximo 50). */
  faltando: string[];
  detalhe: string | null;
  /** Como a norma foi dada por conferida: só pela máquina ou também por um segundo revisor. */
  metodo?: "automatica" | "revisao";
};

export const TIPO_REVISAO = { inclusao: "Inclusão", edicao: "Correção", conferencia: "Conferência" } as const;
export const STATUS_REVISAO = { pendente: "Pendente", aprovada: "Aprovada", rejeitada: "Rejeitada", cancelada: "Cancelada" } as const;
