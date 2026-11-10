import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { searchHistory } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { SituacaoTarefa } from "@/components/app/situacao";
import { CompromissoAcervo } from "@/components/acervo/compromisso";
import { requireSubscriber } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = { title: "Pesquisa com IA" };
export const maxDuration = 300;

async function Historico() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select({ id: searchHistory.id, query: searchHistory.query, area: searchHistory.area, status: searchHistory.status, createdAt: searchHistory.createdAt })
    .from(searchHistory)
    .where(eq(searchHistory.userId, viewer.id))
    .orderBy(desc(searchHistory.createdAt))
    .limit(40);

  if (!lista.length) return <EmptyState title="Nenhuma pesquisa ainda">Suas pesquisas ficam salvas aqui.</EmptyState>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
      {lista.map((s) => (
        <li key={s.id}>
          <Link href={`/painel/pesquisa/${s.id}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
            <span className="min-w-0">
              <span className="texto-juridico line-clamp-2 text-[0.95rem]">{s.query}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{[s.area, formatDateTime(s.createdAt)].filter(Boolean).join(", ")}</span>
            </span>
            <SituacaoTarefa status={s.status} className="sm:self-center" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function PerguntaSobreNorma({ searchParams }: { searchParams: PageProps<"/painel/pesquisa">["searchParams"] }) {
  const { sobre, norma } = await searchParams;
  return (
    <ResearchForm
      perguntaInicial={typeof sobre === "string" ? sobre : undefined}
      normaId={typeof norma === "string" ? Number(norma) || undefined : undefined}
    />
  );
}

export default function PesquisaPage({ searchParams }: PageProps<"/painel/pesquisa">) {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Pesquisa com IA"
        description={
          <>
            Escreva a dúvida como escreveria a um colega. A nota traz a tese, a lei, a doutrina, a tendência dos tribunais e
            a peça recomendada (sem redigi-la), citando o{" "}
            <Link href="/painel/acervo" className="text-tinta underline underline-offset-2">
              acervo de legislação
            </Link>
            .
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <PerguntaSobreNorma searchParams={searchParams} />
      </Suspense>
      <CompromissoAcervo />
      <p className="-mt-8 text-xs text-muted-foreground">
        Os artigos citados na nota vêm desse acervo e abrem o texto da norma no artigo exato. A análise é gerada por IA: é um ponto de
        partida e deve ser revisada pelo advogado responsável.
      </p>
      <Section title="Histórico">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Historico />
        </Suspense>
      </Section>
    </div>
  );
}
