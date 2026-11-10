import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import type { Conferencia, DadosNorma } from "@/lib/acervo/tipos-curadoria";
import type { CartaProposta, ContractAnalysisData, RecomendacaoPecaData, ResearchData } from "@/lib/ai/schemas";
import type { AnaliseCaso } from "@/lib/ai/analise-caso";
import type { RespostasTriagem } from "@/lib/triagem";
import type { ParametrosPrazo, Ramo } from "@/lib/prazos/calculo";
import type { BillingFormat, PricingInputs, PricingResult } from "@/lib/pricing/engine";

/*
 * Tabelas da aplicação. Colunas em snake_case (o cliente usa casing: "snake_case").
 * A autorização é feita no servidor: toda consulta de dado de usuário filtra
 * por user_id na camada de acesso (src/lib/data).
 */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const agora = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const planTier = pgEnum("plan_tier", ["basico", "profissional", "escritorio"]);
export const billingCycle = pgEnum("billing_cycle", ["mensal", "anual"]);
export const subscriptionStatus = pgEnum("subscription_status", ["pendente", "ativa", "inadimplente", "cancelada"]);
export const jobStatus = pgEnum("job_status", ["processando", "concluido", "erro"]);

// ---------------------------------------------------------------------------
// Assinaturas e pagamentos
// ---------------------------------------------------------------------------

export const subscriptions = pgTable("subscriptions", {
  id: uuid().primaryKey().defaultRandom(),
  // set null: o histórico de cobrança é guardado após a exclusão da conta
  // (obrigação legal/fiscal, LGPD art. 16, I).
  userId: uuid().unique().references(() => users.id, { onDelete: "set null" }),
  plan: planTier().notNull(),
  cycle: billingCycle().notNull(),
  status: subscriptionStatus().notNull().default("pendente"),
  provider: text().notNull().default("asaas"),
  providerCustomerId: text(),
  providerSubscriptionId: text().unique(),
  billingType: text(),
  valueCents: integer().notNull(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  firstPaymentAt: timestamp({ withTimezone: true }),
  lastPaymentAt: timestamp({ withTimezone: true }),
  lastPaymentId: text(),
  lastInvoiceUrl: text(),
  canceledAt: timestamp({ withTimezone: true }),
  refundedAt: timestamp({ withTimezone: true }),
  createdAt: agora(),
  updatedAt: agora().$onUpdate(() => new Date()),
});

export const billingEvents = pgTable("billing_events", {
  id: text().primaryKey(),
  provider: text().notNull().default("asaas"),
  event: text().notNull(),
  payload: jsonb().notNull(),
  receivedAt: agora(),
  processedAt: timestamp({ withTimezone: true }),
  error: text(),
});

/**
 * Livro de cobranças: uma linha por cobrança do Asaas, com a situação mais
 * recente. Base do faturamento na administração (bruto, líquido, estornos).
 */
export const pagamentos = pgTable(
  "pagamentos",
  {
    /** ID da cobrança no Asaas (pay_...). */
    id: text().primaryKey(),
    provider: text().notNull().default("asaas"),
    assinaturaId: uuid().references(() => subscriptions.id, { onDelete: "set null" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: text({ enum: ["pendente", "vencido", "confirmado", "recebido", "cancelado", "estornado", "contestado"] }).notNull(),
    forma: text(),
    valorCents: integer().notNull(),
    valorLiquidoCents: integer(),
    vencimento: date(),
    pagoEm: timestamp({ withTimezone: true }),
    estornadoEm: timestamp({ withTimezone: true }),
    faturaUrl: text(),
    criadoEm: agora(),
    atualizadoEm: agora(),
  },
  (t) => [index().on(t.pagoEm), index().on(t.userId), index().on(t.status)],
);

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

export const contracts = pgTable(
  "contracts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text({ enum: ["analise", "minuta"] }).notNull(),
    title: text().notNull(),
    source: text({ enum: ["texto", "pdf", "docx", "modelo"] }).notNull(),
    content: text().notNull().default(""),
    templateId: text(),
    params: jsonb().$type<Record<string, string>>().notNull().default({}),
    // Minutas antigas (kind = 'minuta', recurso retirado) guardavam outro formato e não são mais exibidas.
    analysis: jsonb().$type<ContractAnalysisData>(),
    riskScore: smallint(),
    clienteId: uuid().references(() => clientes.id, { onDelete: "set null" }),
    status: jobStatus().notNull().default("processando"),
    progress: text(),
    error: text(),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const pricingProposals = pgTable(
  "pricing_proposals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientName: text().notNull(),
    caseTitle: text().notNull(),
    area: text().notNull(),
    uf: text().notNull(),
    inputs: jsonb().$type<PricingInputs>().notNull(),
    result: jsonb().$type<PricingResult>().notNull(),
    billingFormat: text().$type<BillingFormat>().notNull(),
    proposedValueCents: bigint({ mode: "number" }),
    proposalLetter: jsonb().$type<CartaProposta>(),
    clienteId: uuid().references(() => clientes.id, { onDelete: "set null" }),
    situacao: text({ enum: ["rascunho", "enviada", "aceita", "recusada"] }).notNull().default("rascunho"),
    situacaoEm: timestamp({ withTimezone: true }),
    createdAt: agora(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const searchHistory = pgTable(
  "search_history",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    query: text().notNull(),
    area: text(),
    params: jsonb().$type<{ fatos?: string; uf?: string; normaId?: number }>().notNull().default({}),
    result: jsonb().$type<ResearchData>(),
    status: jobStatus().notNull().default("processando"),
    progress: text(),
    error: text(),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const oabFeeReferences = pgTable(
  "oab_fee_references",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    uf: text().notNull(),
    area: text().notNull(),
    servico: text().notNull(),
    valorMinimoCents: bigint({ mode: "number" }),
    percentualMinimo: numeric({ precision: 5, scale: 2, mode: "number" }),
    observacao: text(),
    fonteUrl: text(),
    vigencia: text(),
    ilustrativo: boolean().notNull().default(false),
  },
  (t) => [unique().on(t.uf, t.area, t.servico)],
);

// ---------------------------------------------------------------------------
// Acervo jurídico (sincronizado com github.com/ctresb/leis)
// ---------------------------------------------------------------------------

export const normas = pgTable(
  "normas",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    /** Caminho do arquivo no repositório: identificador estável da norma. */
    caminho: text().notNull().unique(),
    fonte: text().notNull().default("ctresb/leis"),
    esfera: text({ enum: ["federal", "estadual", "municipal", "jurisprudencia", "regulador", "tratado"] }).notNull(),
    uf: text(),
    municipio: text(),
    /** Tribunal (jurisprudência) ou órgão (atos de reguladores). */
    orgao: text(),
    tipo: text().notNull(),
    tipoSlug: text().notNull(),
    numero: text(),
    ano: smallint(),
    data: date(),
    titulo: text().notNull(),
    /** Nome pelo qual a norma é conhecida ("Código Civil", "Lei Maria da Penha"). */
    apelido: text(),
    /** Ementa: o resumo oficial de para que a norma serve. */
    ementa: text(),
    situacao: text(),
    revogada: boolean().notNull().default(false),
    versaoTexto: text(),
    urn: text(),
    fonteUrl: text(),
    repoUrl: text().notNull(),
    areas: text().array().notNull().default(sql`'{}'::text[]`),
    /** Nomes populares oficiais (normas.leg.br, alternateName). */
    nomesPopulares: text().array().notNull().default(sql`'{}'::text[]`),
    /** Indexação temática oficial (normas.leg.br, keywords), em texto corrido. */
    indexacao: text(),
    enriquecidaEm: timestamp({ withTimezone: true }),
    texto: text().notNull(),
    tamanho: integer().notNull(),
    sumario: jsonb().$type<{ nivel: number; titulo: string; ancora: string }[]>().notNull().default([]),
    /** Explicação em linguagem simples, gerada sob demanda e guardada. */
    explicacao: text(),
    explicacaoEm: timestamp({ withTimezone: true }),
    gitSha: text().notNull(),
    removidaEm: timestamp({ withTimezone: true }),
    ingeridaEm: agora(),
    atualizadaEm: agora(),
    /** Incluída ou corrigida pela curadoria: a sincronização não sobrescreve. */
    curada: boolean().notNull().default(false),
    /** SHA-256 do texto aprovado pela curadoria (verificação de integridade). */
    hashTexto: text(),
    conferidaEm: timestamp({ withTimezone: true }),
    conferencia: jsonb().$type<Conferencia>(),
    /** Norma curada que mudou no repositório de origem depois da curadoria. */
    origemSha: text(),
    origemMudouEm: timestamp({ withTimezone: true }),
    tsv: tsvector()
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('public.pt_unaccent', coalesce(apelido, '') || ' ' || titulo), 'A') || setweight(to_tsvector('public.pt_unaccent', coalesce(ementa, '')), 'B') || setweight(to_tsvector('public.pt_unaccent', coalesce(indexacao, '')), 'C')`,
      ),
  },
  (t) => [
    index("normas_tsv_idx").using("gin", t.tsv),
    index("normas_areas_idx").using("gin", t.areas),
    index("normas_filtro_idx").on(t.esfera, t.uf, t.tipoSlug, t.ano),
    index("normas_numero_idx").on(t.numero, t.ano),
    // Índices parciais: contam curadas e conferidas sem varrer o acervo inteiro.
    index("normas_curadas_idx").on(t.id).where(sql`curada`),
    index("normas_conferidas_idx").on(t.conferidaEm).where(sql`conferida_em is not null`),
    // A busca por nome procura o apelido ("CDC") com ilike '%…%': sem este índice, cada
    // busca lia a tabela inteira. Só as poucas normas com apelido entram.
    index("normas_apelido_trgm_idx").using("gin", sql`${t.apelido} gin_trgm_ops`).where(sql`apelido is not null`),
  ],
);

/**
 * Inclusões, correções e conferências do acervo feitas pela equipe. Nada é
 * publicado sem a aprovação de um revisor diferente do autor (ou, na
 * conferência sem mudança de texto, sem a confirmação automática da fonte
 * oficial). As aprovadas formam o histórico de versões de cada norma.
 */
export const normasRevisoes = pgTable(
  "normas_revisoes",
  {
    id: uuid().primaryKey().defaultRandom(),
    normaId: bigint({ mode: "number" }).references(() => normas.id, { onDelete: "set null" }),
    tipo: text({ enum: ["inclusao", "edicao", "conferencia"] }).notNull(),
    status: text({ enum: ["pendente", "aprovada", "rejeitada", "cancelada"] }).notNull().default("pendente"),
    dados: jsonb().$type<DadosNorma>(),
    texto: text(),
    hashTexto: text(),
    fonteOficial: text().notNull(),
    justificativa: text().notNull(),
    conferencia: jsonb().$type<Conferencia>(),
    /** Versão substituída (edições), para comparar e desfazer. */
    anterior: jsonb().$type<{ dados: DadosNorma; texto: string; hashTexto: string }>(),
    autorId: uuid().references(() => users.id, { onDelete: "set null" }),
    autorEmail: text().notNull(),
    revisorId: uuid().references(() => users.id, { onDelete: "set null" }),
    revisorEmail: text(),
    revisadaEm: timestamp({ withTimezone: true }),
    /** Observação do revisor, motivo da rejeição ou justificativa para aprovar com divergência. */
    parecer: text(),
    createdAt: agora(),
  },
  (t) => [
    index().on(t.status, t.createdAt),
    index().on(t.normaId, t.createdAt),
    // Uma revisão pendente por norma, para duas pessoas não editarem a mesma lei ao mesmo tempo.
    uniqueIndex("normas_revisoes_pendente_unica").on(t.normaId).where(sql`status = 'pendente' and norma_id is not null`),
  ],
);

/**
 * Artigos (ou enunciados) de cada norma. O texto não é duplicado: guarda-se a
 * posição dentro de normas.texto e o tsvector para a busca.
 */
export const dispositivos = pgTable(
  "dispositivos",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    normaId: bigint({ mode: "number" })
      .notNull()
      .references(() => normas.id, { onDelete: "cascade" }),
    ordem: integer().notNull(),
    referencia: text().notNull(),
    contexto: text(),
    ancora: text().notNull(),
    inicio: integer().notNull(),
    fim: integer().notNull(),
    tsv: tsvector().notNull(),
  },
  (t) => [index("dispositivos_tsv_idx").using("gin", t.tsv), index().on(t.normaId, t.ordem)],
);

export const acervoSincronizacoes = pgTable("acervo_sincronizacoes", {
  id: bigserial({ mode: "number" }).primaryKey(),
  tipo: text({ enum: ["completa", "incremental", "oficial", "enriquecimento"] }).notNull(),
  estrategia: text({ enum: ["git", "dou", "normas-leg"] }).notNull(),
  status: text({ enum: ["executando", "concluida", "erro"] }).notNull().default("executando"),
  commitDe: text(),
  commitAte: text(),
  processadas: integer().notNull().default(0),
  inseridas: integer().notNull().default(0),
  atualizadas: integer().notNull().default(0),
  removidas: integer().notNull().default(0),
  inalteradas: integer().notNull().default(0),
  erros: integer().notNull().default(0),
  mensagem: text(),
  amostraErros: jsonb().$type<{ caminho: string; erro: string }[]>().notNull().default([]),
  disparadaPor: text(),
  iniciadaEm: agora(),
  atualizadaEm: agora(),
  concluidaEm: timestamp({ withTimezone: true }),
});

export const acervoEstado = pgTable("acervo_estado", {
  chave: text().primaryKey(),
  valor: jsonb().notNull(),
  atualizadoEm: agora(),
});

/** Normas federais publicadas em fonte oficial (LexML) ainda sem texto no acervo. */
export const acervoPublicacoes = pgTable(
  "acervo_publicacoes",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    fonte: text().notNull(),
    urn: text().notNull().unique(),
    tipo: text().notNull(),
    numero: text(),
    ano: smallint(),
    data: date(),
    titulo: text().notNull(),
    ementa: text(),
    link: text(),
    normaId: bigint({ mode: "number" }).references(() => normas.id, { onDelete: "set null" }),
    detectadaEm: agora(),
    incorporadaEm: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.tipo, t.numero, t.ano)],
);

// ---------------------------------------------------------------------------
// Operação, auditoria e conformidade
// ---------------------------------------------------------------------------

/** Cada chamada ao modelo: tokens, duração e custo estimado (painel do desenvolvedor). */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    recurso: text().notNull(),
    referenciaId: text(),
    modelo: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    cacheReadTokens: integer().notNull().default(0),
    cacheWriteTokens: integer().notNull().default(0),
    duracaoMs: integer().notNull(),
    sucesso: boolean().notNull(),
    erro: text(),
    createdAt: agora(),
  },
  (t) => [index().on(t.createdAt), index().on(t.recurso, t.createdAt)],
);

/**
 * Fila das tarefas de IA em segundo plano (src/lib/ai/fila.ts) e, ao mesmo tempo,
 * o registro de consumo do plano: a linha não guarda conteúdo e continua aqui
 * quando o usuário apaga o item, então excluir não devolve a cota. Tarefa que
 * termina em erro ou é cancelada antes de começar não conta.
 */
export const tarefasIa = pgTable(
  "tarefas_ia",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    tipo: text({ enum: ["auditoria", "pesquisa", "peca", "triagem"] }).notNull(),
    referenciaId: uuid().notNull(),
    status: text({ enum: ["na_fila", "processando", "concluida", "erro", "cancelada"] }).notNull().default("na_fila"),
    /** 0 = alguém espera o resultado; 1 = segundo plano (triagem pública). */
    prioridade: smallint().notNull().default(0),
    tentativas: smallint().notNull().default(0),
    erro: text(),
    criadaEm: agora(),
    iniciadaEm: timestamp({ withTimezone: true }),
    concluidaEm: timestamp({ withTimezone: true }),
    /** Sinal de vida do processo que executa a tarefa: parado por muito tempo, ela volta para a fila. */
    batimentoEm: timestamp({ withTimezone: true }),
  },
  (t) => [
    index().on(t.status, t.prioridade, t.criadaEm),
    index().on(t.userId, t.tipo, t.criadaEm),
    index().on(t.tipo, t.referenciaId),
  ],
);

/** Trilha de auditoria de ações administrativas e de privacidade. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    atorId: uuid().references(() => users.id, { onDelete: "set null" }),
    atorEmail: text(),
    acao: text().notNull(),
    alvoTipo: text(),
    alvoId: text(),
    detalhes: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: agora(),
  },
  (t) => [index().on(t.createdAt), index().on(t.acao)],
);

/**
 * Registros de acesso (Marco Civil da Internet, art. 15): guardados por 6 meses.
 * Sem chave estrangeira de propósito — a obrigação de guarda continua mesmo se a conta for excluída.
 */
export const registrosAcesso = pgTable(
  "registros_acesso",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid(),
    ip: text(),
    userAgent: text(),
    evento: text().notNull(),
    createdAt: agora(),
  },
  (t) => [index().on(t.createdAt), index().on(t.userId)],
);

/** Aceite dos documentos legais (versão aceita, quando e de onde). */
export const aceitesTermos = pgTable("aceites_termos", {
  id: bigserial({ mode: "number" }).primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documento: text({ enum: ["termos", "privacidade"] }).notNull(),
  versao: text().notNull(),
  ip: text(),
  aceitoEm: agora(),
});

/** Solicitações de titulares de dados (LGPD art. 18). */
export const lgpdSolicitacoes = pgTable(
  "lgpd_solicitacoes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    nome: text().notNull(),
    email: text().notNull(),
    tipo: text({
      enum: ["confirmacao", "acesso", "correcao", "anonimizacao", "portabilidade", "exclusao", "compartilhamento", "revogacao", "oposicao", "outro"],
    }).notNull(),
    descricao: text(),
    status: text({ enum: ["aberta", "em_andamento", "concluida", "indeferida"] }).notNull().default("aberta"),
    resposta: text(),
    prazoEm: timestamp({ withTimezone: true }).notNull(),
    respondidaEm: timestamp({ withTimezone: true }),
    respondidaPor: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: agora(),
  },
  (t) => [index().on(t.status, t.prazoEm)],
);

/** Mensagens do formulário de contato (Decreto 7.962/2013, art. 4º: resposta em até 5 dias). */
export const contatos = pgTable(
  "contatos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    nome: text().notNull(),
    email: text().notNull(),
    assunto: text({ enum: ["duvida", "suporte", "assinatura", "sugestao", "parceria", "outro"] }).notNull(),
    mensagem: text().notNull(),
    status: text({ enum: ["aberta", "respondida", "arquivada"] }).notNull().default("aberta"),
    resposta: text(),
    respondidaEm: timestamp({ withTimezone: true }),
    respondidaPor: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: agora(),
  },
  (t) => [index().on(t.status, t.createdAt)],
);

/** Caixa de saída de e-mails: em desenvolvimento, sem provedor, as mensagens ficam aqui. */
export const emailsSaida = pgTable("emails_saida", {
  id: bigserial({ mode: "number" }).primaryKey(),
  para: text().notNull(),
  assunto: text().notNull(),
  texto: text().notNull(),
  via: text({ enum: ["console", "resend"] }).notNull(),
  erro: text(),
  createdAt: agora(),
});

/**
 * Contadores de tentativas (login, cadastro, senha, formulários). Ficam no banco
 * para valer entre instâncias do servidor. A chave é um hash: não guarda IP nem e-mail.
 */
export const limitesTaxa = pgTable(
  "limites_taxa",
  {
    chave: text().primaryKey(),
    contagem: integer().notNull().default(0),
    inicioJanela: agora(),
  },
  (t) => [index().on(t.inicioJanela)],
);

// ---------------------------------------------------------------------------
// CRM: clientes, triagem, processos e prazos, recomendações de peça
// Em relação a esses dados, o advogado é o controlador e o Causídico, operador.
// ---------------------------------------------------------------------------

export const clienteStatus = pgEnum("cliente_status", ["lead", "negociacao", "cliente", "encerrado", "perdido"]);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    email: text(),
    telefone: text(),
    documento: text(),
    cidade: text(),
    uf: text(),
    origem: text({ enum: ["indicacao", "triagem", "calculadora", "site", "retorno", "outro"] }).notNull().default("outro"),
    indicadoPor: text(),
    status: clienteStatus().notNull().default("lead"),
    observacoes: text(),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.status, t.updatedAt)],
);

/** Link público de triagem de cada advogado (um por conta). */
export const triagemLinks = pgTable("triagem_links", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  codigo: text().notNull().unique(),
  ativo: boolean().notNull().default(true),
  createdAt: agora(),
});

export const triagens = pgTable(
  "triagens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clienteId: uuid().references(() => clientes.id, { onDelete: "cascade" }),
    respostas: jsonb().$type<RespostasTriagem>().notNull(),
    /** Sugestão da IA (área, complexidade e risco), feita depois do envio. */
    analise: jsonb().$type<AnaliseCaso>(),
    status: jobStatus().notNull().default("processando"),
    error: text(),
    vistaEm: timestamp({ withTimezone: true }),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const processos = pgTable(
  "processos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clienteId: uuid().references(() => clientes.id, { onDelete: "set null" }),
    titulo: text().notNull(),
    numero: text(),
    ramo: text().$type<Ramo>().notNull(),
    orgao: text(),
    situacao: text({ enum: ["ativo", "arquivado"] }).notNull().default("ativo"),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.situacao)],
);

export const prazos = pgTable(
  "prazos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    processoId: uuid().references(() => processos.id, { onDelete: "cascade" }),
    descricao: text().notNull(),
    vencimento: date().notNull(),
    /** Parâmetros usados no cálculo, para refazer a conta e mostrar a linha do tempo. */
    parametros: jsonb().$type<ParametrosPrazo>().notNull(),
    cumpridoEm: timestamp({ withTimezone: true }),
    createdAt: agora(),
  },
  (t) => [index().on(t.userId, t.vencimento)],
);

/** Feriados locais e suspensões do tribunal informados pelo advogado. */
export const diasSemExpediente = pgTable(
  "dias_sem_expediente",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: date().notNull(),
    descricao: text().notNull(),
    tipo: text({ enum: ["sem_expediente", "reduzido"] }).notNull().default("sem_expediente"),
    createdAt: agora(),
  },
  (t) => [unique().on(t.userId, t.data)],
);

export const recomendacoesPeca = pgTable(
  "recomendacoes_peca",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clienteId: uuid().references(() => clientes.id, { onDelete: "set null" }),
    titulo: text().notNull(),
    params: jsonb()
      .$type<{ polo: "autor" | "reu"; area: string; uf?: string; fatos: string; objetivo?: string }>()
      .notNull(),
    result: jsonb().$type<RecomendacaoPecaData>(),
    status: jobStatus().notNull().default("processando"),
    progress: text(),
    error: text(),
    createdAt: agora(),
    updatedAt: agora().$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);
