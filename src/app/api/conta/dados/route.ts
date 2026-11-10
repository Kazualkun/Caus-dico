import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  aceitesTermos,
  clientes,
  contracts,
  diasSemExpediente,
  prazos,
  pricingProposals,
  processos,
  recomendacoesPeca,
  registrosAcesso,
  searchHistory,
  triagens,
} from "@/db/schema";
import { getViewer } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/registros";

/**
 * Acesso e portabilidade (LGPD, art. 18, II e V): todos os dados da conta em
 * JSON, num formato legível por máquina.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "não autenticado" }, { status: 401 });

  const [contratos, propostas, pesquisas, aceites, acessos, listaClientes, listaTriagens, listaProcessos, listaPrazos, dias, pecas] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.userId, viewer.id)).orderBy(desc(contracts.createdAt)),
    db.select().from(pricingProposals).where(eq(pricingProposals.userId, viewer.id)).orderBy(desc(pricingProposals.createdAt)),
    db.select().from(searchHistory).where(eq(searchHistory.userId, viewer.id)).orderBy(desc(searchHistory.createdAt)),
    db.select().from(aceitesTermos).where(eq(aceitesTermos.userId, viewer.id)),
    db.select().from(registrosAcesso).where(eq(registrosAcesso.userId, viewer.id)).orderBy(desc(registrosAcesso.createdAt)),
    db.select().from(clientes).where(eq(clientes.userId, viewer.id)).orderBy(desc(clientes.createdAt)),
    db.select().from(triagens).where(eq(triagens.userId, viewer.id)).orderBy(desc(triagens.createdAt)),
    db.select().from(processos).where(eq(processos.userId, viewer.id)).orderBy(desc(processos.createdAt)),
    db.select().from(prazos).where(eq(prazos.userId, viewer.id)).orderBy(desc(prazos.vencimento)),
    db.select().from(diasSemExpediente).where(eq(diasSemExpediente.userId, viewer.id)),
    db.select().from(recomendacoesPeca).where(eq(recomendacoesPeca.userId, viewer.id)).orderBy(desc(recomendacoesPeca.createdAt)),
  ]);

  const assinatura = viewer.subscription;
  const dados = {
    geradoEm: new Date().toISOString(),
    perfil: {
      nome: viewer.fullName,
      email: viewer.email,
      oab: viewer.oabNumber ? `${viewer.oabNumber}/${viewer.oabUf ?? ""}` : null,
      escritorio: viewer.officeName,
      cpfCnpj: viewer.cpfCnpj,
      celular: viewer.phone,
      papel: viewer.role,
    },
    assinatura: assinatura && {
      plano: assinatura.plan,
      ciclo: assinatura.cycle,
      situacao: assinatura.status,
      valorCentavos: assinatura.valueCents,
      formaDePagamento: assinatura.billingType,
      periodoPagoAte: assinatura.currentPeriodEnd,
      canceladaEm: assinatura.canceledAt,
      criadaEm: assinatura.createdAt,
    },
    contratos,
    propostasDeHonorarios: propostas,
    pesquisas,
    recomendacoesDePeca: pecas,
    clientes: listaClientes,
    triagens: listaTriagens,
    processos: listaProcessos,
    prazos: listaPrazos,
    diasSemExpediente: dias,
    aceitesDeDocumentos: aceites,
    registrosDeAcesso: acessos,
  };

  await registrarAuditoria({ ator: { id: viewer.id, email: viewer.email }, acao: "conta.dados_exportados", alvoTipo: "usuario", alvoId: viewer.id });

  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-causidico.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
