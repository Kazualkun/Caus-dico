import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, diasSemExpediente, prazos, processos } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, ConfirmActionButton } from "@/components/form-bits";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { ListaPrazos } from "@/components/app/lista-prazos";
import { requireSubscriber } from "@/lib/auth";
import { calcularPrazo, formatarData, RAMOS } from "@/lib/prazos/calculo";
import { LinhaDoTempo } from "../../calculadora";
import { arquivarProcesso, excluirProcesso } from "../../actions";

export const metadata: Metadata = { title: "Processo" };

async function Processo({ params }: { params: PageProps<"/painel/prazos/processos/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ p: processos, clienteNome: clientes.nome })
    .from(processos)
    .leftJoin(clientes, eq(clientes.id, processos.clienteId))
    .where(and(eq(processos.id, id), eq(processos.userId, viewer.id)))
    .limit(1);
  if (!row) notFound();
  const { p, clienteNome } = row;

  const [lista, dias] = await Promise.all([
    db.select().from(prazos).where(and(eq(prazos.processoId, p.id), eq(prazos.userId, viewer.id))).orderBy(asc(prazos.vencimento)),
    db.select().from(diasSemExpediente).where(eq(diasSemExpediente.userId, viewer.id)),
  ]);
  const informados = dias.map((d) => ({ data: d.data, descricao: d.descricao, tipo: d.tipo }));

  return (
    <div className="space-y-10">
      <PageHeader
        title={p.titulo}
        description={[p.numero, RAMOS[p.ramo].nome, p.orgao, p.situacao === "arquivado" ? "arquivado" : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/painel/prazos">Calcular prazo</Link>
            </Button>
            <ActionButton variant="outline" size="lg" action={arquivarProcesso.bind(null, p.id, p.situacao === "ativo")} pendingText="…">
              {p.situacao === "ativo" ? "Arquivar" : "Reativar"}
            </ActionButton>
            <ConfirmActionButton
              variant="destructive"
              size="lg"
              action={excluirProcesso.bind(null, p.id)}
              confirmText="Excluir este processo e todos os prazos dele? Essa ação não pode ser desfeita."
            >
              Excluir
            </ConfirmActionButton>
          </>
        }
      />
      {clienteNome && p.clienteId && (
        <p className="text-sm">
          Cliente:{" "}
          <Link href={`/painel/clientes/${p.clienteId}`} className="text-tinta underline underline-offset-2">
            {clienteNome}
          </Link>
        </p>
      )}

      <Section title="Prazos do processo">
        {lista.length ? (
          <ListaPrazos prazos={lista} diasInformados={informados} />
        ) : (
          <EmptyState title="Nenhum prazo neste processo">Calcule um prazo e escolha este processo ao salvar.</EmptyState>
        )}
      </Section>

      {lista.length > 0 && (
        <Section title="Contagem de cada prazo">
          <div className="grid gap-6 md:grid-cols-2">
            {lista.map((pr) => {
              const r = calcularPrazo({ ...pr.parametros, diasInformados: informados });
              return (
                <article key={pr.id} className="space-y-3 rounded-lg border border-border bg-folha p-4">
                  <h3 className="font-medium">
                    {pr.descricao}: {formatarData(r.vencimento, true)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {RAMOS[pr.parametros.ramo].nome}, {pr.parametros.dias} dias{pr.parametros.emDobro ? " em dobro" : ""}
                  </p>
                  <LinhaDoTempo linha={r.linha} vencimento={r.vencimento} />
                </article>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

export default function ProcessoPage({ params }: PageProps<"/painel/prazos/processos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem] w-full" />}>
      <Processo params={params} />
    </Suspense>
  );
}
