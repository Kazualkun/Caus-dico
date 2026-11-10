import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { registrarVerificacaoIntegridade } from "@/lib/acervo/curadoria";
import { verificarDou, enriquecerOficial } from "@/lib/acervo/oficial";
import { recalcularEstatisticas } from "@/lib/acervo/estatisticas";
import { aplicarRetencao, registrarAuditoria } from "@/lib/registros";

/*
 * Rotina diária, chamada pelo agendador da hospedagem (ex.: Vercel Cron) com
 * `Authorization: Bearer <CRON_SECRET>`.
 * - Retenção: registros de acesso com mais de 6 meses e e-mails de desenvolvimento.
 * - Acervo: publicações recentes no Diário Oficial, nomes populares oficiais e
 *   integridade dos textos conferidos (impressão digital SHA-256) e as contagens
 *   do acervo mostradas na biblioteca.
 * A sincronização completa com o repositório do acervo precisa do espelho Git
 * e roda num worker (`npm run acervo:sincronizar`), não aqui.
 */

export const maxDuration = 300;

function autorizado(cabecalho: string | null) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !cabecalho) return false;
  const a = Buffer.from(cabecalho);
  const b = Buffer.from(`Bearer ${segredo}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get("authorization"))) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const resultado: Record<string, unknown> = {};
  const etapas: [string, () => Promise<unknown>][] = [
    ["retencao", aplicarRetencao],
    ["dou", () => verificarDou({ dias: 3, disparadaPor: "cron" })],
    ["enriquecimento", () => enriquecerOficial({ limite: 200, disparadaPor: "cron" })],
    ["integridade", async () => ({ violadas: (await registrarVerificacaoIntegridade()).length })],
    ["estatisticas", async () => ({ calculadasEm: (await recalcularEstatisticas()).calculadasEm })],
  ];
  // Uma etapa com falha não impede as seguintes.
  for (const [nome, etapa] of etapas) {
    try {
      resultado[nome] = await etapa();
    } catch (e) {
      console.error(`[cron] falha em ${nome}`, e);
      resultado[nome] = { erro: e instanceof Error ? e.message : String(e) };
    }
  }

  revalidateTag("acervo", "max");
  await registrarAuditoria({ ator: null, acao: "sistema.rotina_diaria", detalhes: resultado }).catch(() => undefined);
  return Response.json({ ok: true, resultado });
}
