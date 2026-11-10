import { z } from "zod";

/*
 * Schemas das saídas estruturadas da IA (campo `format` do Ollama). As
 * descrições vão no prompt junto do schema. Restrições numéricas e de tamanho
 * ficam fora do schema e são aplicadas depois, no código.
 *
 * Regra do produto: a IA orienta e recomenda, mas não redige peças, minutas
 * nem cláusulas prontas. Nenhum campo pede texto pronto para uso.
 */

export const Severidade = z.enum(["baixa", "media", "alta", "critica"]);
export type Severidade = z.infer<typeof Severidade>;

const CategoriaAchado = z.enum([
  "brecha",
  "ambiguidade",
  "omissao",
  "abusividade",
  "erro_formal",
  "inconformidade_legal",
]);
export type CategoriaAchado = z.infer<typeof CategoriaAchado>;

const FonteIds = z
  .array(z.string())
  .describe("Identificadores das fontes do bloco <fontes> usadas (ex.: F3). Vazio se nenhuma das fontes embasa o ponto.");

// ---------------------------------------------------------------------------
// Planejamento de busca (passo comum à auditoria de contratos e à pesquisa)
// ---------------------------------------------------------------------------

export const PlanoDeBusca = z.object({
  tipo: z.string().describe("Tipo do contrato ou área da dúvida, ex.: 'Locação residencial' ou 'Direito bancário'"),
  relacao_de_consumo: z.boolean().describe("Se há relação de consumo (CDC) aparente"),
  termos_busca: z
    .array(z.string())
    .describe(
      "De 5 a 10 consultas curtas para busca textual em legislação e súmulas brasileiras, com vocabulário da própria lei. Ex.: 'cláusula penal redução equitativa', 'multa devolução antecipada imóvel locado'",
    ),
});
export type PlanoDeBusca = z.infer<typeof PlanoDeBusca>;

// ---------------------------------------------------------------------------
// Auditoria de contrato — equipe de três papéis
// ---------------------------------------------------------------------------

export const AchadoPreliminar = z.object({
  categoria: CategoriaAchado,
  titulo: z.string().describe("Resumo do problema em até 12 palavras"),
  clausula: z.string().describe("Identificação da cláusula, ex.: 'Cláusula 5.2' ou 'Cláusula sobre multa (sem número)'"),
  trecho: z
    .string()
    .describe("Transcrição literal e contínua do trecho do contrato. String vazia se o problema for ausência de cláusula."),
  problema: z.string(),
  fundamento: z.string().describe("Dispositivo legal ou entendimento que embasa o achado. String vazia se não houver."),
  fonte_ids: FonteIds,
  severidade: Severidade,
});

export const RelatorioEspecialista = z.object({
  achados: z.array(AchadoPreliminar),
  observacoes: z.string().describe("Limitações da análise, trechos ilegíveis ou dúvidas para o advogado"),
});
export type RelatorioEspecialista = z.infer<typeof RelatorioEspecialista>;

export const ParecerContrato = z.object({
  tipo_contrato: z.string(),
  resumo_executivo: z.string().describe("Três a cinco frases para o advogado decidir se assina, negocia ou recusa"),
  nota_risco: z.number().describe("Número inteiro: 0 = sem risco relevante; 100 = inviável como está"),
  pontos_fortes: z.array(z.string()),
  achados: z.array(
    AchadoPreliminar.omit({ problema: true }).extend({
      analise: z.string().describe("Por que é um problema e qual o impacto para a parte representada"),
      medida_corretiva: z
        .string()
        .describe("O que o advogado deve buscar na revisão ou na negociação (ex.: limitar a multa, fixar prazo, prever notificação). Oriente; não redija a cláusula."),
    }),
  ),
  clausulas_ausentes: z.array(
    z.object({
      titulo: z.string(),
      justificativa: z.string(),
      o_que_deve_prever: z
        .string()
        .describe("Os pontos que a cláusula deve cobrir, em frases curtas. Não redija a cláusula."),
    }),
  ),
  proximos_passos: z.array(z.string()),
});
export type ParecerContrato = z.infer<typeof ParecerContrato>;

// ---------------------------------------------------------------------------
// Pesquisa jurídica
// ---------------------------------------------------------------------------

export const ParecerPesquisa = z.object({
  resposta_direta: z.string().describe("Resposta objetiva à pergunta, em duas ou três frases"),
  resumo_tese: z.string().describe("A tese central desenvolvida em um parágrafo"),
  grau_de_consenso: z.enum(["pacifico", "majoritario", "controvertido", "minoritario", "incerto"]),
  fundamentacao_legal: z.array(
    z.object({
      dispositivo: z.string().describe("Ex.: 'CPC, art. 784, § 4º'"),
      sintese: z.string(),
      fonte_ids: FonteIds,
    }),
  ),
  posicao_doutrinaria: z
    .array(z.object({ corrente: z.string(), sintese: z.string() }))
    .describe("Correntes doutrinárias descritas pelo conteúdo, sem citações literais atribuídas a autores"),
  tendencia_jurisprudencial: z.object({
    panorama: z.string(),
    precedentes: z.array(
      z.object({
        referencia: z.string().describe("Somente súmulas e temas presentes nas fontes"),
        sintese: z.string(),
        fonte_ids: FonteIds,
      }),
    ),
  }),
  peca_recomendada: z
    .object({
      peca: z.string().describe("A peça ou medida cabível, ex.: 'Ação de indenização por danos morais no Juizado Especial Cível'"),
      por_que_cabe: z.string().describe("Por que esta é a via adequada para os fatos informados"),
      requisitos: z.array(z.string()).describe("Requisitos de cabimento e documentos que o advogado precisa reunir"),
      prazo: z.string().describe("Prazo de prescrição, decadência ou processual aplicável, com o dispositivo. String vazia se não houver prazo relevante."),
      alternativas: z.array(z.object({ peca: z.string(), quando_preferir: z.string() })).describe("Outras vias possíveis e quando preferi-las"),
    })
    .describe("Recomendação da peça cabível. Não redija a peça nem trechos dela: o advogado redige."),
  argumentos_contrarios: z.array(z.object({ argumento: z.string(), como_responder: z.string() })),
  pontos_de_atencao: z.array(z.string()).describe("Prazos, provas, verificações e riscos"),
});
export type ParecerPesquisa = z.infer<typeof ParecerPesquisa>;

// ---------------------------------------------------------------------------
// Recomendação de peça processual (a IA recomenda; não redige a peça)
// ---------------------------------------------------------------------------

export const RecomendacaoPeca = z.object({
  peca: z.object({
    nome: z.string().describe("A peça cabível, ex.: 'Petição inicial de ação de indenização por danos morais' ou 'Contestação'"),
    procedimento: z.string().describe("Rito ou via, ex.: 'Procedimento comum' ou 'Juizado Especial Cível (Lei 9.099/1995)'"),
    competencia: z.string().describe("Juízo e foro prováveis, com o fundamento, ex.: 'Foro do domicílio do consumidor (CDC, art. 101, I)'"),
    por_que_cabe: z.string().describe("Por que esta peça é a adequada para os fatos e para o polo do cliente"),
  }),
  alternativas: z.array(z.object({ nome: z.string(), quando_preferir: z.string() })).describe("Outras vias possíveis e quando preferi-las"),
  requisitos: z
    .array(z.object({ requisito: z.string(), dispositivo: z.string(), fonte_ids: FonteIds }))
    .describe("Requisitos legais que a peça precisa cumprir, ex.: os do CPC, art. 319, para a inicial; os do art. 336 e seguintes, para a contestação"),
  fundamentos: z
    .array(z.object({ tese: z.string(), dispositivo: z.string(), sintese: z.string(), fonte_ids: FonteIds }))
    .describe("Teses e dispositivos que sustentam a posição do cliente"),
  pedidos_cabiveis: z
    .array(z.string())
    .describe("Tipos de pedido que cabem (ex.: 'tutela de urgência para retirar o nome do cadastro'), em frases curtas. Não redija os pedidos."),
  provas_e_documentos: z.array(z.string()).describe("Provas e documentos que o advogado deve reunir"),
  prazos: z
    .array(z.object({ descricao: z.string(), prazo: z.string(), dispositivo: z.string() }))
    .describe("Prazos relevantes: prescrição, decadência, resposta ou recurso"),
  riscos: z.array(z.string()).describe("Riscos e pontos fracos da posição do cliente"),
  informacoes_faltantes: z.array(z.string()).describe("O que falta saber para confirmar a recomendação. Vazio se nada essencial faltar."),
});
export type RecomendacaoPeca = z.infer<typeof RecomendacaoPeca>;

export type RecomendacaoPecaData = {
  recomendacao: RecomendacaoPeca;
  fontes: FonteCitada[];
  /** Citações não encontradas no acervo, por item. */
  alertasCitacao?: { requisitos: string[][]; fundamentos: string[][]; prazos: string[][] };
  modelo: string;
  geradoEm: string;
};

// ---------------------------------------------------------------------------
// Carta de proposta de honorários
// ---------------------------------------------------------------------------

export const CartaProposta = z.object({
  apresentacao: z.string(),
  escopo: z.array(z.string()),
  fora_do_escopo: z.array(z.string()),
  justificativa_valor: z.string(),
});
export type CartaProposta = z.infer<typeof CartaProposta>;

// ---------------------------------------------------------------------------
// Formatos gravados no banco (colunas jsonb)
// ---------------------------------------------------------------------------

/** Fonte do acervo mostrada ao usuário junto do resultado (link para a norma, no artigo citado). */
export type FonteCitada = {
  id: string;
  normaId: number;
  esfera: "federal" | "estadual" | "municipal" | "jurisprudencia" | "regulador" | "tratado";
  titulo: string;
  apelido: string | null;
  referencia: string;
  ancora: string;
  texto: string;
  fonteUrl: string | null;
  repoUrl: string;
};

export type ContractAnalysisData = {
  tipo: "analise";
  parecer: ParecerContrato;
  /** Posição de cada achado no texto do contrato (mesma ordem de parecer.achados). */
  localizacao: ({ inicio: number; fim: number } | null)[];
  fontes: FonteCitada[];
  equipe: { analista: number; pesquisador: number; observacoes: string[] };
  /** Citações conferidas no acervo que não foram encontradas (por achado). Ausente em pareceres antigos. */
  alertasCitacao?: string[][];
  modelo: string;
  geradoEm: string;
};

export type ResearchData = {
  parecer: ParecerPesquisa;
  fontes: FonteCitada[];
  /** Citações não encontradas no acervo, por item da fundamentação legal. */
  alertasCitacao?: string[][];
  modelo: string;
  geradoEm: string;
};
