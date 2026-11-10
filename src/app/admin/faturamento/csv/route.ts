import { getViewer, temPapel } from "@/lib/auth";
import { FORMAS, hojeEmBrasilia, mesValido, pagamentosDoMes } from "@/lib/admin/faturamento";
import { PLANS } from "@/lib/plans";
import { registrarAuditoria } from "@/lib/registros";

/**
 * Cobranças do mês em CSV para a contabilidade: separador ";" e vírgula
 * decimal (abre direto no Excel em português), com BOM para os acentos.
 */

const reais = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));
const data = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

/** Aspas e proteção contra fórmulas (célula começando com = + - @ vira texto). */
function celula(v: string) {
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  // Quem não tem o papel recebe 404, como no resto da administração.
  if (!viewer || !temPapel(viewer, "administrador")) return new Response("Não encontrado", { status: 404 });

  const mes = mesValido(new URL(request.url).searchParams.get("mes"), await hojeEmBrasilia());
  const lista = await pagamentosDoMes(mes);
  const linhas = [
    ["Cobrança", "Situação", "Assinante", "Plano", "Ciclo", "Forma", "Valor (R$)", "Líquido (R$)", "Vencimento", "Pago em", "Estornado em", "Fatura"],
    ...lista.map((p) => [
      p.id,
      p.status,
      p.email ?? "conta excluída",
      p.plano ? PLANS[p.plano].nome : "",
      p.ciclo ?? "",
      FORMAS[p.forma ?? "UNDEFINED"] ?? p.forma ?? "",
      reais(p.valorCents),
      reais(p.valorLiquidoCents),
      p.vencimento ? p.vencimento.split("-").reverse().join("/") : "",
      data(p.pagoEm),
      data(p.estornadoEm),
      p.faturaUrl ?? "",
    ]),
  ];
  await registrarAuditoria({ ator: viewer, acao: "faturamento.exportado", detalhes: { mes, linhas: lista.length } });

  const csv = `﻿${linhas.map((l) => l.map(celula).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faturamento-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
