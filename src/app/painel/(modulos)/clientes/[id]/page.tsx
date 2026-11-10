import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, contracts, pricingProposals, processos, recomendacoesPeca, triagens } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionButton } from "@/components/form-bits";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";
import { ORIGENS_CLIENTE, SITUACOES_PROPOSTA, STATUS_CLIENTE } from "@/lib/crm";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FORMATOS } from "@/lib/pricing/engine";
import { RAMOS } from "@/lib/prazos/calculo";
import { alterarSituacaoProposta, atualizarCliente, excluirCliente } from "../actions";
import { ClienteForm, SelecaoImediata } from "../forms";
import { ResumoTriagem } from "../triagem-bits";

export const metadata: Metadata = { title: "Cliente" };

const linha = "block px-4 py-3 hover:bg-muted/40";
const lista = "divide-y divide-border rounded-lg border border-border bg-folha";

async function Cliente({ params }: { params: PageProps<"/painel/clientes/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.userId, viewer.id)))
    .limit(1);
  if (!c) notFound();

  const [listaTriagens, propostas, auditorias, listaProcessos, pecas] = await Promise.all([
    db.select().from(triagens).where(and(eq(triagens.userId, viewer.id), eq(triagens.clienteId, c.id))).orderBy(desc(triagens.createdAt)),
    db.select().from(pricingProposals).where(and(eq(pricingProposals.userId, viewer.id), eq(pricingProposals.clienteId, c.id))).orderBy(desc(pricingProposals.createdAt)),
    db
      .select({ id: contracts.id, title: contracts.title, status: contracts.status, riskScore: contracts.riskScore, createdAt: contracts.createdAt })
      .from(contracts)
      .where(and(eq(contracts.userId, viewer.id), eq(contracts.clienteId, c.id), eq(contracts.kind, "analise")))
      .orderBy(desc(contracts.createdAt)),
    db.select().from(processos).where(and(eq(processos.userId, viewer.id), eq(processos.clienteId, c.id))).orderBy(desc(processos.updatedAt)),
    db
      .select({ id: recomendacoesPeca.id, titulo: recomendacoesPeca.titulo, status: recomendacoesPeca.status, createdAt: recomendacoesPeca.createdAt })
      .from(recomendacoesPeca)
      .where(and(eq(recomendacoesPeca.userId, viewer.id), eq(recomendacoesPeca.clienteId, c.id)))
      .orderBy(desc(recomendacoesPeca.createdAt)),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={c.nome}
        description={`${STATUS_CLIENTE[c.status]} · origem: ${ORIGENS_CLIENTE[c.origem].toLowerCase()} · desde ${formatDateTime(c.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/painel/honorarios">Calcular honorários</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/painel/pecas?cliente=${c.id}`}>Recomendar peça</Link>
            </Button>
            <ConfirmActionButton
              variant="destructive"
              size="lg"
              action={excluirCliente.bind(null, c.id)}
              confirmText="Excluir este cliente? As triagens dele serão apagadas; propostas, auditorias e processos ficam, sem o vínculo."
            >
              Excluir
            </ConfirmActionButton>
          </>
        }
      />

      {listaTriagens.length > 0 && (
        <Section title="Triagem">
          <div className="space-y-4">
            {listaTriagens.map((t) => (
              <ResumoTriagem key={t.id} t={t} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Propostas de honorários">
        {propostas.length ? (
          <ul className={lista}>
            {propostas.map((p) => (
              <li key={p.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_12rem] sm:items-end">
                <Link href={`/painel/honorarios/${p.id}`} className="min-w-0 hover:text-tinta">
                  <span className="block truncate font-medium">{p.caseTitle}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.proposedValueCents != null ? formatBRL(p.proposedValueCents, { semCentavos: true }) : FORMATOS[p.billingFormat]} ·{" "}
                    {formatDateTime(p.createdAt)}
                  </span>
                </Link>
                <SelecaoImediata
                  rotulo="Situação"
                  valor={p.situacao}
                  opcoes={Object.entries(SITUACOES_PROPOSTA).map(([valor, nome]) => ({ valor, nome }))}
                  action={alterarSituacaoProposta.bind(null, p.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma proposta">Propostas salvas na calculadora com o nome deste cliente aparecem aqui.</EmptyState>
        )}
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Auditorias de contrato">
          {auditorias.length ? (
            <ul className={lista}>
              {auditorias.map((a) => (
                <li key={a.id}>
                  <Link href={`/painel/contratos/${a.id}`} className={linha}>
                    <span className="block truncate font-medium">{a.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {a.status === "concluido" ? `Risco ${a.riskScore}/100` : a.status === "erro" ? "Não concluída" : "Em andamento"} ·{" "}
                      {formatDateTime(a.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma auditoria">Escolha este cliente ao auditar um contrato.</EmptyState>
          )}
        </Section>
        <Section title="Processos">
          {listaProcessos.length ? (
            <ul className={lista}>
              {listaProcessos.map((p) => (
                <li key={p.id}>
                  <Link href={`/painel/prazos/processos/${p.id}`} className={linha}>
                    <span className="block truncate font-medium">{p.titulo}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[p.numero, RAMOS[p.ramo].nome, p.situacao === "arquivado" ? "arquivado" : null].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum processo">Cadastre em Prazos, escolhendo este cliente.</EmptyState>
          )}
        </Section>
      </div>

      {pecas.length > 0 && (
        <Section title="Recomendações de peça">
          <ul className={lista}>
            {pecas.map((p) => (
              <li key={p.id}>
                <Link href={`/painel/pecas/${p.id}`} className={linha}>
                  <span className="block truncate font-medium">{p.titulo}</span>
                  <span className="block text-sm text-muted-foreground">{formatDateTime(p.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Dados do cliente">
        <ClienteForm
          action={atualizarCliente.bind(null, c.id)}
          inicial={c}
          status={STATUS_CLIENTE}
          origens={ORIGENS_CLIENTE}
          rotulo="Salvar alterações"
        />
      </Section>
    </div>
  );
}

export default function ClientePage({ params }: PageProps<"/painel/clientes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Cliente params={params} />
    </Suspense>
  );
}
