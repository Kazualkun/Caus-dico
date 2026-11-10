import type {
  acervoPublicacoes,
  acervoSincronizacoes,
  clientes,
  contracts,
  diasSemExpediente,
  lgpdSolicitacoes,
  normas,
  oabFeeReferences,
  prazos,
  pricingProposals,
  processos,
  recomendacoesPeca,
  searchHistory,
  subscriptions,
  triagens,
} from "@/db/schema";

export type SubscriptionStatus = "pendente" | "ativa" | "inadimplente" | "cancelada";
export type JobStatus = "processando" | "concluido" | "erro";

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type ContractRow = typeof contracts.$inferSelect;
export type ProposalRow = typeof pricingProposals.$inferSelect;
export type SearchRow = typeof searchHistory.$inferSelect;
export type OabReferenceRow = typeof oabFeeReferences.$inferSelect;
export type NormaRow = typeof normas.$inferSelect;
export type SincronizacaoRow = typeof acervoSincronizacoes.$inferSelect;
export type PublicacaoRow = typeof acervoPublicacoes.$inferSelect;
export type SolicitacaoLgpdRow = typeof lgpdSolicitacoes.$inferSelect;
export type ClienteRow = typeof clientes.$inferSelect;
export type TriagemRow = typeof triagens.$inferSelect;
export type ProcessoRow = typeof processos.$inferSelect;
export type PrazoRow = typeof prazos.$inferSelect;
export type DiaSemExpedienteRow = typeof diasSemExpediente.$inferSelect;
export type RecomendacaoPecaRow = typeof recomendacoesPeca.$inferSelect;

/** Estado devolvido pelas Server Actions usadas com useActionState. */
export type ActionState = { error?: string; ok?: boolean; mensagem?: string } | undefined;
