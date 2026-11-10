import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recomendacoesPeca } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { SituacaoTarefa } from "@/components/app/situacao";
import { requireSubscriber } from "@/lib/auth";
import { clientesParaSelecao } from "@/lib/crm";
import { formatDateTime } from "@/lib/format";
import { PecaForm } from "./peca-form";

export const metadata: Metadata = { title: "Peças" };
export const maxDuration = 300;

async function Formulario({ searchParams }: { searchParams: PageProps<"/painel/pecas">["searchParams"] }) {
  const viewer = await requireSubscriber();
  const { cliente } = await searchParams;
  return <PecaForm clientes={await clientesParaSelecao(viewer.id)} clienteInicial={typeof cliente === "string" ? cliente : undefined} />;
}

async function Historico() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select({
      id: recomendacoesPeca.id,
      titulo: recomendacoesPeca.titulo,
      status: recomendacoesPeca.status,
      result: recomendacoesPeca.result,
      createdAt: recomendacoesPeca.createdAt,
    })
    .from(recomendacoesPeca)
    .where(eq(recomendacoesPeca.userId, viewer.id))
    .orderBy(desc(recomendacoesPeca.createdAt))
    .limit(40);

  if (!lista.length) return <EmptyState title="Nenhuma recomendação ainda">As recomendações de peça ficam salvas aqui.</EmptyState>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
      {lista.map((r) => (
        <li key={r.id}>
          <Link href={`/painel/pecas/${r.id}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
            <span className="min-w-0">
              <span className="block truncate font-medium">{r.titulo}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {[r.result?.recomendacao.peca.nome, formatDateTime(r.createdAt)].filter(Boolean).join(", ")}
              </span>
            </span>
            <SituacaoTarefa status={r.status} className="sm:self-center" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PecasPage({ searchParams }: PageProps<"/painel/pecas">) {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Peças"
        description="Descreva os fatos e veja qual peça cabe, com os requisitos legais, os fundamentos do acervo, os pedidos cabíveis, as provas e os prazos. A IA recomenda; quem redige a peça é você."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
      <Section title="Histórico">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Historico />
        </Suspense>
      </Section>
    </div>
  );
}
