import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";
import { db } from "@/db";
import { registrosAcesso } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { hasActiveAccess, requireViewer } from "@/lib/auth";
import { prazoDeArrependimento } from "@/lib/billing/arrependimento";
import { getMonthlyUsage } from "@/lib/usage";
import { formatBRL, formatDateTime, formatLongDate } from "@/lib/format";
import { PLANS, RECURSO_LABEL, type Recurso } from "@/lib/plans";
import type { SubscriptionStatus } from "@/lib/types";
import { cancelarAssinatura } from "@/app/assinatura/actions";
import { ExcluirContaForm, PerfilForm } from "./forms";

export const metadata: Metadata = { title: "Minha conta" };

const STATUS: Record<SubscriptionStatus, string> = {
  pendente: "Aguardando o primeiro pagamento",
  ativa: "Ativa",
  inadimplente: "Pagamento em atraso",
  cancelada: "Cancelada",
};

const FORMA: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto" };

async function Conta() {
  const viewer = await requireViewer();
  const sub = viewer.subscription;
  const acesso = hasActiveAccess(sub);
  const arrependimentoAte = prazoDeArrependimento(sub);
  const [uso, acessos] = await Promise.all([
    acesso ? getMonthlyUsage(viewer.id) : null,
    db.select().from(registrosAcesso).where(eq(registrosAcesso.userId, viewer.id)).orderBy(desc(registrosAcesso.createdAt)).limit(5),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Section title="Dados profissionais">
        <PerfilForm
          nome={viewer.fullName ?? ""}
          oabNumber={viewer.oabNumber ?? ""}
          oabUf={viewer.oabUf ?? ""}
          officeName={viewer.officeName ?? ""}
        />
        <p className="text-xs text-muted-foreground">E-mail de acesso: {viewer.email}</p>
      </Section>

      <Section title="Assinatura">
        {!sub ? (
          <div className="space-y-3 rounded-lg border border-border bg-folha p-5 text-sm">
            <p>Você ainda não tem um plano.</p>
            <Button asChild>
              <Link href="/planos">Ver planos</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border bg-folha p-5 text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
              <dt className="text-muted-foreground">Plano</dt>
              <dd>
                {PLANS[sub.plan].nome}, {sub.cycle}
              </dd>
              <dt className="text-muted-foreground">Valor</dt>
              <dd>{formatBRL(sub.valueCents)}</dd>
              <dt className="text-muted-foreground">Situação</dt>
              <dd>{sub.refundedAt ? "Cancelada com reembolso" : STATUS[sub.status]}</dd>
              {sub.billingType && (
                <>
                  <dt className="text-muted-foreground">Pagamento</dt>
                  <dd>{FORMA[sub.billingType] ?? sub.billingType}</dd>
                </>
              )}
              {sub.currentPeriodEnd && (
                <>
                  <dt className="text-muted-foreground">{sub.status === "cancelada" ? "Acesso até" : "Renova em"}</dt>
                  <dd>{formatLongDate(sub.currentPeriodEnd)}</dd>
                </>
              )}
            </dl>
            {arrependimentoAte && (
              <p className="rounded-md bg-accent px-3 py-2 text-tinta">
                Você está no prazo de arrependimento até {formatDateTime(arrependimentoAte)}: se cancelar agora, o valor pago é
                devolvido integralmente.
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {(sub.status === "pendente" || sub.status === "inadimplente") && (
                <Button asChild>
                  <Link href="/assinatura/aguardando">Pagar fatura em aberto</Link>
                </Button>
              )}
              {!acesso && sub.status === "cancelada" && (
                <Button asChild>
                  <Link href="/planos">Assinar novamente</Link>
                </Button>
              )}
              {sub.status !== "cancelada" && (
                <ConfirmActionButton
                  variant="outline"
                  action={cancelarAssinatura}
                  confirmText={
                    arrependimentoAte
                      ? "Cancelar a assinatura? Você está no prazo de arrependimento: o valor pago será devolvido e o acesso termina agora."
                      : "Cancelar a renovação? Você mantém o acesso até o fim do período já pago."
                  }
                >
                  {arrependimentoAte ? "Cancelar e receber o reembolso" : "Cancelar assinatura"}
                </ConfirmActionButton>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Regras completas na{" "}
              <Link href="/cancelamento-e-reembolso" className="underline underline-offset-2">
                Política de Cancelamento e Reembolso
              </Link>
              .
            </p>
          </div>
        )}
      </Section>

      {uso && (
        <Section title="Uso neste mês" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(uso) as Recurso[]).map((r) => (
              <div key={r} className="rounded-lg border border-border bg-folha p-4">
                <dt className="text-sm text-muted-foreground">{RECURSO_LABEL[r]}</dt>
                <dd className="font-serif text-xl font-semibold">
                  {uso[r]}{" "}
                  <span className="font-sans text-sm font-normal text-muted-foreground">
                    de {PLANS[sub?.plan ?? "escritorio"].limites[r]}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section title="Privacidade e seus dados" className="lg:col-span-2">
        <div className="grid gap-6 rounded-lg border border-border bg-folha p-5 text-sm md:grid-cols-2">
          <div className="space-y-3">
            <p>
              Você pode baixar uma cópia de todos os seus dados, pedir informações sobre o tratamento ou excluir a conta. Os
              direitos estão descritos na{" "}
              <Link href="/privacidade" className="text-tinta underline underline-offset-2">
                Política de Privacidade
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href="/api/conta/dados">
                  <DownloadIcon aria-hidden />
                  Baixar meus dados
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/privacidade/solicitacao">Outra solicitação sobre dados</Link>
              </Button>
            </div>
            <ExcluirContaForm email={viewer.email} />
          </div>
          <div>
            <p className="mb-2 font-medium">Últimos acessos</p>
            {acessos.length === 0 ? (
              <p className="text-muted-foreground">Nenhum registro.</p>
            ) : (
              <ul className="space-y-1 text-muted-foreground">
                {acessos.map((a) => (
                  <li key={a.id}>
                    {formatDateTime(a.createdAt)}, {a.evento}
                    {a.ip ? `, IP ${a.ip}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Guardamos data, hora e IP de cada acesso por 6 meses, como exige o Marco Civil da Internet (art. 15).
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function ContaPage() {
  return (
    <>
      <PageHeader title="Minha conta" />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Conta />
      </Suspense>
    </>
  );
}
