import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { diasSemExpediente, prazos, processos } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionButton } from "@/components/form-bits";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { ListaPrazos } from "@/components/app/lista-prazos";
import { requireSubscriber } from "@/lib/auth";
import { clientesParaSelecao } from "@/lib/crm";
import { formatarData, RAMOS } from "@/lib/prazos/calculo";
import { CalculadoraPrazos } from "./calculadora";
import { DiaSemExpedienteForm, NovoProcessoForm } from "./forms";
import { removerDiaSemExpediente } from "./actions";

export const metadata: Metadata = { title: "Prazos" };

async function dadosDoAdvogado(userId: string) {
  const [dias, listaProcessos] = await Promise.all([
    db.select().from(diasSemExpediente).where(eq(diasSemExpediente.userId, userId)).orderBy(asc(diasSemExpediente.data)),
    db
      .select({ id: processos.id, titulo: processos.titulo, numero: processos.numero, ramo: processos.ramo, orgao: processos.orgao })
      .from(processos)
      .where(and(eq(processos.userId, userId), eq(processos.situacao, "ativo")))
      .orderBy(asc(processos.titulo)),
  ]);
  return { dias, listaProcessos };
}

async function Calculadora() {
  const viewer = await requireSubscriber();
  const { dias, listaProcessos } = await dadosDoAdvogado(viewer.id);
  return (
    <CalculadoraPrazos
      diasInformados={dias.map((d) => ({ data: d.data, descricao: d.descricao, tipo: d.tipo }))}
      processos={listaProcessos.map((p) => ({ id: p.id, titulo: p.titulo }))}
    />
  );
}

async function LinhaDoTempoDosPrazos() {
  const viewer = await requireSubscriber();
  const { dias, listaProcessos } = await dadosDoAdvogado(viewer.id);
  const [abertos, cumpridos] = await Promise.all([
    db
      .select()
      .from(prazos)
      .where(and(eq(prazos.userId, viewer.id), isNull(prazos.cumpridoEm)))
      .orderBy(asc(prazos.vencimento))
      .limit(100),
    db
      .select()
      .from(prazos)
      .where(and(eq(prazos.userId, viewer.id), isNotNull(prazos.cumpridoEm)))
      .orderBy(desc(prazos.cumpridoEm))
      .limit(20),
  ]);
  const nomes = new Map(listaProcessos.map((p) => [p.id, p.titulo]));
  const informados = dias.map((d) => ({ data: d.data, descricao: d.descricao, tipo: d.tipo }));

  return (
    <div className="space-y-4">
      {abertos.length ? (
        <ListaPrazos prazos={abertos} diasInformados={informados} processos={nomes} />
      ) : (
        <EmptyState title="Nenhum prazo em aberto">Calcule um prazo acima e salve na linha do tempo.</EmptyState>
      )}
      {cumpridos.length > 0 && (
        <details className="rounded-lg border border-border bg-folha p-4">
          <summary className="cursor-pointer text-sm font-medium">Cumpridos recentemente ({cumpridos.length})</summary>
          <div className="mt-3">
            <ListaPrazos prazos={cumpridos} diasInformados={informados} processos={nomes} />
          </div>
        </details>
      )}
    </div>
  );
}

async function Processos() {
  const viewer = await requireSubscriber();
  const [{ listaProcessos }, clientes] = await Promise.all([dadosDoAdvogado(viewer.id), clientesParaSelecao(viewer.id)]);
  return (
    <div className="space-y-4">
      {listaProcessos.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
          {listaProcessos.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/prazos/processos/${p.id}`} className="block px-4 py-3 hover:bg-muted/40">
                <span className="block font-medium">{p.titulo}</span>
                <span className="block text-sm text-muted-foreground">
                  {[p.numero, RAMOS[p.ramo].nome, p.orgao].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <details className="group" open={listaProcessos.length === 0}>
        <summary className="cursor-pointer text-sm font-medium text-tinta">Cadastrar processo</summary>
        <div className="mt-3">
          <NovoProcessoForm clientes={clientes} />
        </div>
      </details>
    </div>
  );
}

async function DiasSemExpediente() {
  const viewer = await requireSubscriber();
  const { dias } = await dadosDoAdvogado(viewer.id);
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Feriados estaduais e municipais, pontos facultativos e suspensões do tribunal (como indisponibilidade do sistema). Eles
        entram em todos os seus cálculos. Os prazos já salvos avisam se o vencimento mudar.
      </p>
      {dias.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
          {dias.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{formatarData(d.data, true)}</span> · {d.descricao}
                {d.tipo === "reduzido" && <span className="text-muted-foreground"> (expediente reduzido)</span>}
              </span>
              <ConfirmActionButton size="sm" variant="ghost" action={removerDiaSemExpediente.bind(null, d.id)} confirmText="Remover este dia?">
                Remover
              </ConfirmActionButton>
            </li>
          ))}
        </ul>
      )}
      <DiaSemExpedienteForm />
    </div>
  );
}

export default function PrazosPage() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Prazos"
        description="Calcule prazos cíveis, trabalhistas e penais com feriados, fins de semana e suspensões, veja a contagem dia a dia e acompanhe os prazos de cada processo."
      />
      <Suspense fallback={<Skeleton className="h-[28rem] w-full" />}>
        <Calculadora />
      </Suspense>
      <Section title="Linha do tempo dos prazos">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <LinhaDoTempoDosPrazos />
        </Suspense>
      </Section>
      <Section title="Processos">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Processos />
        </Suspense>
      </Section>
      <Section title="Seus dias sem expediente">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <DiasSemExpediente />
        </Suspense>
      </Section>
      <p className="text-xs text-muted-foreground">
        O cálculo segue o CPC, a CLT e o CPP e mostra cada dia contado. Confira sempre o calendário oficial do tribunal: o
        Causídico apoia o controle de prazos, mas a responsabilidade pelo prazo é do advogado.
      </p>
    </div>
  );
}
