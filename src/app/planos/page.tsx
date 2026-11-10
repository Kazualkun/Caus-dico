import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = { title: "Planos" };

async function AvisoAssinatura({ searchParams }: { searchParams: PageProps<"/planos">["searchParams"] }) {
  const { assinar } = await searchParams;
  if (!assinar) return null;
  return (
    <p className="mb-6 max-w-2xl rounded-md border border-tinta/25 bg-accent px-4 py-3 text-sm text-tinta">
      Escolha um plano para liberar a calculadora de honorários, a auditoria de contratos e a pesquisa jurídica.
    </p>
  );
}

export default function PlanosPage({ searchParams }: PageProps<"/planos">) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Planos</h1>
        <p className="mt-3 mb-8 max-w-2xl text-muted-foreground">
          Todos os planos incluem os três módulos. O que muda é o volume mensal de auditorias e pesquisas.
        </p>
        <Suspense fallback={null}>
          <AvisoAssinatura searchParams={searchParams} />
        </Suspense>
        <PricingTable />
      </main>
      <SiteFooter />
    </>
  );
}
