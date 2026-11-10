import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { SituacaoTarefa } from "@/components/app/situacao";
import { requireSubscriber } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { LIMITE_CARACTERES_CONTRATO } from "@/lib/ai/contract-team";
import { AuditForm } from "./contract-forms";
import { clientesParaSelecao } from "@/lib/crm";

export const metadata: Metadata = { title: "Contratos" };

// Minutas geradas antes da retirada do recurso ficam fora do histórico: a IA não redige mais.

async function Formulario() {
  const viewer = await requireSubscriber();
  return <AuditForm limiteCaracteres={LIMITE_CARACTERES_CONTRATO} clientes={await clientesParaSelecao(viewer.id)} />;
}

async function Historico() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select({ id: contracts.id, title: contracts.title, status: contracts.status, riskScore: contracts.riskScore, createdAt: contracts.createdAt })
    .from(contracts)
    .where(and(eq(contracts.userId, viewer.id), eq(contracts.kind, "analise")))
    .orderBy(desc(contracts.createdAt))
    .limit(40);

  if (!lista.length) return <EmptyState title="Nenhum contrato ainda">As auditorias aparecem aqui.</EmptyState>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
      {lista.map((c) => (
        <li key={c.id}>
            <Link href={`/painel/contratos/${c.id}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.title}</span>
                <span className="block text-sm text-muted-foreground">
                  Auditoria, {formatDateTime(c.createdAt)}
                </span>
              </span>
              <SituacaoTarefa status={c.status} risco={c.riskScore} className="sm:self-center" />
            </Link>
          </li>
      ))}
    </ul>
  );
}

export default function ContratosPage() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Contratos"
        description="Audite um contrato para encontrar brechas, cláusulas abusivas e erros formais. A IA aponta o que corrigir e por quê; a redação das cláusulas fica com você."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Formulario />
      </Suspense>
      <Section title="Histórico">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Historico />
        </Suspense>
      </Section>
    </div>
  );
}
