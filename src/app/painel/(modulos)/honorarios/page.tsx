import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { oabFeeReferences, pricingProposals } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FORMATOS } from "@/lib/pricing/engine";
import { FeeCalculator } from "./fee-calculator";

export const metadata: Metadata = { title: "Honorários" };

async function Calculadora() {
  const viewer = await requireSubscriber();
  const referencias = await db.select().from(oabFeeReferences).orderBy(asc(oabFeeReferences.servico));
  return <FeeCalculator referencias={referencias} ufPadrao={viewer.oabUf} />;
}

async function Propostas() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select({
      id: pricingProposals.id,
      clientName: pricingProposals.clientName,
      caseTitle: pricingProposals.caseTitle,
      billingFormat: pricingProposals.billingFormat,
      proposedValueCents: pricingProposals.proposedValueCents,
      createdAt: pricingProposals.createdAt,
    })
    .from(pricingProposals)
    .where(eq(pricingProposals.userId, viewer.id))
    .orderBy(desc(pricingProposals.createdAt))
    .limit(30);

  if (!lista.length) return <EmptyState title="Nenhuma proposta salva">As propostas que você gerar aparecem aqui.</EmptyState>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
      {lista.map((p) => (
        <li key={p.id}>
          <Link href={`/painel/honorarios/${p.id}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.clientName}</span>
              <span className="block truncate text-sm text-muted-foreground">{p.caseTitle}</span>
            </span>
            <span className="text-sm sm:text-right">
              <span className="block">
                {p.proposedValueCents != null ? formatBRL(p.proposedValueCents, { semCentavos: true }) : FORMATOS[p.billingFormat]}
              </span>
              <span className="block text-muted-foreground">{formatDateTime(p.createdAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function HonorariosPage() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Honorários"
        description="Analise o caso com IA, ajuste as premissas e veja o mínimo aceitável já com impostos, os formatos de cobrança e o comparativo com a tabela da OAB."
      />
      <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
        <Calculadora />
      </Suspense>
      <Section title="Propostas salvas">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Propostas />
        </Suspense>
      </Section>
    </div>
  );
}
