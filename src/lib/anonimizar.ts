/**
 * Mascara identificadores pessoais antes de um texto chegar à IA: número de
 * processo (padrão CNJ), CNPJ, CPF, e-mail, CEP, telefone, RG e inscrição na
 * OAB. A ordem importa: os padrões mais longos vêm primeiro para que um número
 * de processo não seja lido como telefone.
 *
 * Nomes de pessoas não são removidos: não há padrão confiável para isso. Por
 * isso as telas que usam esta função pedem para evitar nomes.
 */
const REGRAS: [RegExp, string][] = [
  [/\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/g, "[PROCESSO]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[E-MAIL]"],
  [/\bCEP:?\s*\d{5}-?\d{3}\b/gi, "CEP [CEP]"],
  [/\b\d{5}-\d{3}\b/g, "[CEP]"],
  [/(?:\+?55\s?)?(?:\(\d{2}\)|\b\d{2})\s?9?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]"],
  [/\bRG\s*(?:n[º°o.]?\s*)?:?\s*[\d.]{5,}-?[\dxX]?/gi, "RG [RG]"],
  [/\bOAB\s*\/?\s*[A-Z]{2}\s*(?:n[º°o.]?\s*)?:?\s*[\d.]{3,}/gi, "OAB [OAB]"],
];

export function anonimizar(texto: string): { texto: string; mascarados: number } {
  let mascarados = 0;
  let resultado = texto;
  for (const [padrao, marcador] of REGRAS) {
    resultado = resultado.replace(padrao, () => {
      mascarados++;
      return marcador;
    });
  }
  return { texto: resultado, mascarados };
}
