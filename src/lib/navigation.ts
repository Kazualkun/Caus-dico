/**
 * Aceita apenas caminhos internos ("/painel"), nunca URLs externas ("//site.com").
 * Espaços e caracteres de controle também são recusados: o navegador remove
 * tabulações e quebras de linha de URLs, e "/\t/site.com" viraria "//site.com".
 */
export function caminhoSeguro(valor: unknown): string | null {
  if (
    typeof valor !== "string" ||
    !valor.startsWith("/") ||
    valor.startsWith("//") ||
    valor.includes("\\") ||
    /[\s\x00-\x1f\x7f]/.test(valor)
  ) {
    return null;
  }
  return valor;
}
