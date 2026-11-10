import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CircleCheckIcon, ClockIcon } from "lucide-react";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "@/components/form-bits";
import { hasActiveAccess, requireViewer } from "@/lib/auth";
import { listSubscriptionPayments } from "@/lib/billing/asaas";
import { formatBRL } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import type { SubscriptionRow } from "@/lib/types";

export const metadata: Metadata = { title: "Pagamento" };

/** Link da cobrança em aberto (a primeira pendente ou vencida). */
async function linkDaFatura(sub: SubscriptionRow) {
  if (!sub.providerSubscriptionId) return sub.lastInvoiceUrl;
  try {
    const cobrancas = await listSubscriptionPayments(sub.providerSubscriptionId);
    const aberta = cobrancas.find((c) => c.status === "PENDING" || c.status === "OVERDUE");
    if (aberta && aberta.invoiceUrl !== sub.lastInvoiceUrl) {
      await db.update(subscriptions).set({ lastInvoiceUrl: aberta.invoiceUrl }).where(eq(subscriptions.id, sub.id));
    }
    return aberta?.invoiceUrl ?? sub.lastInvoiceUrl;
  } catch {
    return sub.lastInvoiceUrl;
  }
}

const INSTRUCOES: Record<string, string> = {
  PIX: "Abra a fatura e pague com o QR Code ou o Pix copia e cola. A confirmação costuma levar poucos segundos.",
  CREDIT_CARD: "Abra a fatura e informe os dados do cartão na página segura do Asaas.",
  BOLETO: "Abra a fatura para baixar o boleto. A liberação acontece após a compensação, em até 3 dias úteis.",
};

async function Situacao() {
  const viewer = await requireViewer();
  const sub = viewer.subscription;
  if (!sub) redirect("/planos?assinar=1");

  if (hasActiveAccess(sub)) {
    return (
      <div className="folha max-w-xl space-y-4 p-8">
        <CircleCheckIcon className="size-8 text-deferido" aria-hidden />
        <h1 className="font-serif text-2xl font-semibold">Acesso liberado</h1>
        <p className="text-muted-foreground">Pagamento confirmado. Seu plano {PLANS[sub.plan].nome} já está ativo.</p>
        <Button asChild size="lg" className="h-10">
          <Link href="/painel">Ir para o painel</Link>
        </Button>
      </div>
    );
  }

  if (sub.status === "cancelada") {
    return (
      <div className="folha max-w-xl space-y-4 p-8">
        <h1 className="font-serif text-2xl font-semibold">Assinatura encerrada</h1>
        <p className="text-muted-foreground">Escolha um plano para voltar a usar o Causídico.</p>
        <Button asChild size="lg" className="h-10">
          <Link href="/planos">Ver planos</Link>
        </Button>
      </div>
    );
  }

  const fatura = await linkDaFatura(sub);
  const atrasada = sub.status === "inadimplente";

  return (
    <div className="folha max-w-xl space-y-5 p-8">
      <AutoRefresh intervalMs={5000} />
      <ClockIcon className="size-8 text-tinta" aria-hidden />
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold">{atrasada ? "Pagamento em atraso" : "Aguardando pagamento"}</h1>
        <p className="text-muted-foreground">
          Plano {PLANS[sub.plan].nome}, {formatBRL(sub.valueCents)} {sub.cycle === "anual" ? "por ano" : "por mês"}.{" "}
          {INSTRUCOES[sub.billingType ?? "PIX"]}
        </p>
      </div>
      {fatura ? (
        <Button asChild size="lg" className="h-11 px-5">
          <a href={fatura} target="_blank" rel="noreferrer">
            Abrir a fatura
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">A fatura está sendo gerada. Esta página atualiza sozinha.</p>
      )}
      <p className="text-sm text-muted-foreground">
        Pode deixar esta página aberta: assim que o Asaas confirmar o pagamento, o acesso é liberado aqui mesmo.
      </p>
      <Link href="/planos" className="inline-block text-sm text-tinta underline underline-offset-2">
        Escolher outro plano ou forma de pagamento
      </Link>
    </div>
  );
}

export default function AguardandoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 max-w-xl" />}>
      <Situacao />
    </Suspense>
  );
}
