/** Assuntos do formulário de contato (compartilhado com o navegador). */
export const ASSUNTOS_CONTATO = {
  duvida: "Dúvida sobre o Causídico",
  suporte: "Problema técnico",
  assinatura: "Assinatura, pagamento ou reembolso",
  sugestao: "Sugestão",
  parceria: "Parceria ou imprensa",
  outro: "Outro assunto",
} as const;
export type AssuntoContato = keyof typeof ASSUNTOS_CONTATO;

/** Prazo de resposta: Decreto 7.962/2013, art. 4º, parágrafo único. */
export const PRAZO_CONTATO_DIAS = 5;
