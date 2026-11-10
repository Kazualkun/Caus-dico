/**
 * Roda uma vez quando o servidor sobe: liga a execução da fila de IA neste
 * processo (src/lib/ai/fila.ts). Só no runtime Node; IA_FILA=false desliga.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarFila } = await import("@/lib/ai/fila");
  iniciarFila();
}
