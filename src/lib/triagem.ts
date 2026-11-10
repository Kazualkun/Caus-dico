/**
 * Triagem pelo link do advogado: perguntas que o futuro cliente responde pelo
 * celular (o advogado manda o link pelo WhatsApp). As respostas viram um cliente
 * em situação "lead" no CRM e um perfil do caso; nada é redigido pela IA.
 */

/** Assuntos em linguagem de quem não é advogado, ligados à área usada na calculadora. */
export const ASSUNTOS_TRIAGEM = [
  { id: "consumidor", nome: "Compra, banco, plano de saúde ou serviço", area: "consumidor" },
  { id: "trabalhista", nome: "Trabalho (emprego, demissão, verbas)", area: "trabalhista" },
  { id: "familia", nome: "Família (divórcio, pensão, guarda, herança)", area: "familia" },
  { id: "previdenciario", nome: "INSS (aposentadoria, benefício)", area: "previdenciario" },
  { id: "civel", nome: "Contrato, dívida, imóvel ou indenização", area: "civel" },
  { id: "criminal", nome: "Polícia ou processo criminal", area: "criminal" },
  { id: "empresarial", nome: "Empresa ou negócio", area: "empresarial" },
  { id: "tributario", nome: "Impostos", area: "tributario" },
  { id: "outro", nome: "Outro assunto", area: "civel" },
] as const;
export type AssuntoTriagem = (typeof ASSUNTOS_TRIAGEM)[number]["id"];

export type RespostasTriagem = {
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  assunto: AssuntoTriagem;
  relato: string;
  quando: string | null;
  temDocumentos: "sim" | "nao" | "nao_sei";
  objetivo: string | null;
  /** Versão do aviso de privacidade aceito na página de triagem. */
  avisoVersao: string;
};

/** Versão do aviso de privacidade mostrado na página de triagem. */
export const VERSAO_AVISO_TRIAGEM = "2026-10-29";

/** Texto para a IA (análise de complexidade e risco): só o que descreve o caso. */
export function textoDoCaso(r: RespostasTriagem) {
  const assunto = ASSUNTOS_TRIAGEM.find((a) => a.id === r.assunto)?.nome ?? r.assunto;
  return [
    `Assunto escolhido pelo cliente: ${assunto}`,
    r.cidade || r.uf ? `Local: ${[r.cidade, r.uf].filter(Boolean).join("/")}` : "",
    `Relato do cliente: ${r.relato}`,
    r.quando ? `Quando aconteceu: ${r.quando}` : "",
    `Tem documentos: ${{ sim: "sim", nao: "não", nao_sei: "não sabe" }[r.temDocumentos]}`,
    r.objetivo ? `O que o cliente espera: ${r.objetivo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
