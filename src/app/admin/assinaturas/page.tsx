import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents, subscriptions, users } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { reprocessarEvento } from "./actions";

export const metadata: Metadata = { title: "Assinaturas e pagamentos" };

async function Assinaturas() {
  await requirePapel("administrador");
  const lista = await db
    .select({ s: subscriptions, email: users.email })
    .from(subscriptions)
    .leftJoin(users, eq(users.id, subscriptions.userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(100);
  return (
    <Tabela cabecalho={["Assinante", "Plano", "Valor", "Situação", "Pago até", "Forma", "Atualizada"]} vazio={lista.length === 0}>
      {lista.map(({ s, email }) => (
        <tr key={s.id}>
          <Celula>
            {s.userId ? (
              <Link href={`/admin/usuarios/${s.userId}`} className="hover:text-tinta hover:underline">
                {email}
              </Link>
            ) : (
              <span className="text-muted-foreground">conta excluída</span>
            )}
          </Celula>
          <Celula>{PLANS[s.plan].nome}, {s.cycle}</Celula>
          <Celula>{formatBRL(s.valueCents)}</Celula>
          <Celula className={s.status === "inadimplente" ? "text-carimbo" : undefined}>
            {s.status}
            {s.refundedAt ? " (reembolsada)" : ""}
          </Celula>
          <Celula className="whitespace-nowrap">{s.currentPeriodEnd ? formatDateTime(s.currentPeriodEnd) : "—"}</Celula>
          <Celula>{s.billingType ?? "—"}</Celula>
          <Celula className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.updatedAt)}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Eventos({ soErros }: { soErros: boolean }) {
  await requirePapel("administrador");
  const eventos = await db
    .select()
    .from(billingEvents)
    .where(soErros ? isNotNull(billingEvents.error) : undefined)
    .orderBy(desc(billingEvents.receivedAt))
    .limit(50);
  return (
    <Tabela cabecalho={["Recebido", "Evento", "ID", "Processado", "Erro", ""]} vazio={eventos.length === 0}>
      {eventos.map((e) => (
        <tr key={e.id}>
          <Celula className="whitespace-nowrap">{formatDateTime(e.receivedAt)}</Celula>
          <Celula>{e.event}</Celula>
          <Celula className="font-mono text-xs">{e.id}</Celula>
          <Celula className="whitespace-nowrap">{e.processedAt ? formatDateTime(e.processedAt) : "—"}</Celula>
          <Celula className="max-w-xs text-carimbo">{e.error ?? ""}</Celula>
          <Celula>
            {e.error && (
              <ActionButton size="sm" variant="outline" action={reprocessarEvento.bind(null, e.id)}>
                Reprocessar
              </ActionButton>
            )}
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

export default async function AssinaturasPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-10">
      <PageHeader title="Assinaturas e pagamentos" description="Situação das assinaturas e eventos recebidos do Asaas." />
      <Section title="Eventos do webhook com erro">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <Eventos soErros />
        </Suspense>
      </Section>
      <Section title="Assinaturas">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Assinaturas />
        </Suspense>
      </Section>
      <Section title="Últimos eventos do webhook">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Eventos soErros={false} />
        </Suspense>
      </Section>
    </div>
  );
}
