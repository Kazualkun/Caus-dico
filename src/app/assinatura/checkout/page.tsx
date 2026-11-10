import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutForm } from "./checkout-form";
import { hasActiveAccess, requireViewer } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { PLANS, isCycle, isPlanId, planPriceCents } from "@/lib/plans";

export const metadata: Metadata = { title: "Assinatura" };

async function Checkout({ searchParams }: { searchParams: PageProps<"/assinatura/checkout">["searchParams"] }) {
  const viewer = await requireViewer();
  const { plano, ciclo } = await searchParams;
  if (!isPlanId(plano) || !isCycle(ciclo)) redirect("/planos");
  if (viewer.subscription && hasActiveAccess(viewer.subscription)) redirect("/painel");

  const p = PLANS[plano];
  const preco = planPriceCents(plano, ciclo);

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_17rem]">
      <CheckoutForm plano={plano} ciclo={ciclo} nome={viewer.fullName ?? ""} documento={viewer.cpfCnpj ?? ""} />
      <aside className="h-fit rounded-lg border border-border bg-folha p-5 md:order-last">
        <p className="text-sm text-muted-foreground">Plano escolhido</p>
        <p className="font-serif text-xl font-semibold">{p.nome}</p>
        <p className="mt-3 font-serif text-2xl font-semibold">{formatBRL(preco)}</p>
        <p className="text-sm text-muted-foreground">{ciclo === "anual" ? "por ano" : "por mês"}, primeira cobrança hoje</p>
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          {p.destaques.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <Link href="/planos" className="mt-4 inline-block text-sm text-tinta underline underline-offset-2">
          Trocar de plano
        </Link>
      </aside>
    </div>
  );
}

export default function CheckoutPage({ searchParams }: PageProps<"/assinatura/checkout">) {
  return (
    <>
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight">Assinatura</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </>
  );
}
