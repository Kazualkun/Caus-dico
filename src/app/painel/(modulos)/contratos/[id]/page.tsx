import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, AutoRefresh, ConfirmActionButton, FormError } from "@/components/form-bits";
import { JobProgress, PageHeader } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";
import { situacaoNaFila } from "@/lib/ai/fila";
import { ETAPAS_ANALISE } from "@/lib/ai/etapas";
import { formatDateTime } from "@/lib/format";
import type { ContractAnalysisData } from "@/lib/ai/schemas";
import { excluirContrato, reprocessarContrato } from "../actions";
import { vincularAuditoria } from "../../clientes/actions";
import { SelecaoImediata } from "../../clientes/forms";
import { clientesParaSelecao } from "@/lib/crm";
import { AuditReport } from "./audit-report";

export const metadata: Metadata = { title: "Contrato" };
export const maxDuration = 300;

async function Contrato({ params }: { params: PageProps<"/painel/contratos/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.userId, viewer.id)))
    .limit(1);
  // Minutas antigas não são exibidas: a geração de minutas foi retirada (a IA não redige).
  if (!row || row.kind !== "analise") notFound();

  const fila = row.status === "processando" ? await situacaoNaFila("auditoria", row.id) : null;
  const travada = fila?.estado === "inativa";
  const tentarDeNovo = (
    <ActionButton variant="outline" action={reprocessarContrato.bind(null, row.id)} pendingText="Reiniciando…">
      Tentar novamente
    </ActionButton>
  );

  return (
    <>
      <PageHeader
        title={row.title}
        description={`Auditoria criada em ${formatDateTime(row.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/painel/contratos">Nova auditoria</Link>
            </Button>
            <ConfirmActionButton
              variant="destructive"
              size="lg"
              action={excluirContrato.bind(null, row.id)}
              confirmText="Excluir este contrato e o resultado da análise? Essa ação não pode ser desfeita."
            >
              Excluir
            </ConfirmActionButton>
          </>
        }
      />

      {row.status === "processando" && (
        <>
          {!travada && <AutoRefresh />}
          <JobProgress
            etapas={ETAPAS_ANALISE}
            atual={row.progress}
            estimativa="A equipe costuma levar de 5 a 10 minutos, e mais se houver outras análises na fila."
            travada={travada}
            fila={fila}
            acao={travada ? tentarDeNovo : undefined}
          />
        </>
      )}

      {row.status === "erro" && (
        <div className="max-w-xl space-y-4">
          <FormError message={row.error ?? "Não foi possível concluir."} />
          {tentarDeNovo}
        </div>
      )}

      <div className="mb-8 max-w-xs">
        <SelecaoImediata
          rotulo="Cliente no CRM"
          valor={row.clienteId ?? ""}
          vazio="Sem vínculo"
          opcoes={(await clientesParaSelecao(viewer.id)).map((c) => ({ valor: c.id, nome: c.nome }))}
          action={vincularAuditoria.bind(null, row.id)}
        />
      </div>

      {row.status === "concluido" && row.analysis && (
        <AuditReport
          analise={row.analysis as ContractAnalysisData}
          texto={row.content}
          perspectiva={row.params.perspectiva ?? "neutra"}
        />
      )}
    </>
  );
}

export default function ContratoPage({ params }: PageProps<"/painel/contratos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Contrato params={params} />
    </Suspense>
  );
}
