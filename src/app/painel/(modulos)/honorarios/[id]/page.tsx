import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, ConfirmActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pricingProposals } from "@/db/schema";
import { formatBRL, formatLongDate, formatPercent } from "@/lib/format";
import { AREAS, COMPLEXIDADES, FORMATOS, RISCOS } from "@/lib/pricing/engine";
import { CONDICOES_GERAIS, cartaPadrao, descreverHonorarios } from "@/lib/pricing/proposal";
import { excluirProposta, redigirCartaProposta } from "../actions";
import { alterarSituacaoProposta, vincularProposta } from "../../clientes/actions";
import { SelecaoImediata } from "../../clientes/forms";
import { clientesParaSelecao, SITUACOES_PROPOSTA } from "@/lib/crm";

export const metadata: Metadata = { title: "Proposta de honorários" };

async function Proposta({ params }: { params: PageProps<"/painel/honorarios/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db
    .select()
    .from(pricingProposals)
    .where(and(eq(pricingProposals.id, id), eq(pricingProposals.userId, viewer.id)))
    .limit(1);
  if (!p) notFound();

  const carta = p.proposalLetter ?? cartaPadrao(p);
  const clientes = await clientesParaSelecao(viewer.id);
  const r = p.result;

  return (
    <>
      <PageHeader
        title={p.clientName}
        description={p.caseTitle}
        actions={
          <>
            <ActionButton
              variant="outline"
              size="lg"
              action={redigirCartaProposta.bind(null, p.id)}
              pendingText="Redigindo…"
              successText="Carta redigida"
            >
              <SparklesIcon aria-hidden />
              {p.proposalLetter ? "Redigir de novo com IA" : "Redigir carta com IA"}
            </ActionButton>
            <Button asChild size="lg">
              <a href={`/api/propostas/${p.id}/pdf`}>
                <DownloadIcon aria-hidden />
                Baixar PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="folha texto-juridico space-y-5 px-6 py-8 sm:px-12 sm:py-12" aria-label="Prévia da proposta">
          <header className="space-y-1 border-b border-tinta pb-4 font-sans">
            <p className="font-semibold text-tinta">{viewer.officeName ?? viewer.fullName ?? viewer.email}</p>
            <p className="text-xs text-muted-foreground">
              {viewer.oabNumber ? `OAB ${viewer.oabNumber}${viewer.oabUf ? `/${viewer.oabUf}` : ""}` : viewer.email}
            </p>
          </header>
          <h2 className="text-xl font-semibold">Proposta de honorários advocatícios</h2>
          <p className="text-sm text-muted-foreground">{formatLongDate(p.createdAt)}</p>
          <p>{carta.apresentacao}</p>
          <div>
            <h3 className="font-sans text-sm font-semibold text-tinta">Escopo dos serviços</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {carta.escopo.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          {carta.fora_do_escopo.length > 0 && (
            <div>
              <h3 className="font-sans text-sm font-semibold text-tinta">Não incluído nesta proposta</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {carta.fora_do_escopo.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="font-sans text-sm font-semibold text-tinta">Honorários ({FORMATOS[p.billingFormat].toLowerCase()})</h3>
            <p className="mt-1 border-l-[3px] border-tinta bg-accent/60 py-2 pl-3">{descreverHonorarios(p)}</p>
            {carta.justificativa_valor && <p className="mt-3">{carta.justificativa_valor}</p>}
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-tinta">Condições gerais</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.95rem]">
              {CONDICOES_GERAIS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </article>

        <aside className="space-y-8">
          <Section title="Acompanhamento">
            <div className="space-y-3">
              <SelecaoImediata
                rotulo="Situação da proposta"
                valor={p.situacao}
                opcoes={Object.entries(SITUACOES_PROPOSTA).map(([valor, nome]) => ({ valor, nome }))}
                action={alterarSituacaoProposta.bind(null, p.id)}
              />
              <SelecaoImediata
                rotulo="Cliente no CRM"
                valor={p.clienteId ?? ""}
                vazio="Sem vínculo"
                opcoes={clientes.map((c) => ({ valor: c.id, nome: c.nome }))}
                action={vincularProposta.bind(null, p.id)}
              />
              {p.clienteId && (
                <Link href={`/painel/clientes/${p.clienteId}`} className="text-sm text-tinta underline underline-offset-2">
                  Abrir o cliente
                </Link>
              )}
            </div>
          </Section>
          <Section title="Premissas">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Área</dt>
              <dd>{AREAS.find((a) => a.id === p.area)?.nome}</dd>
              <dt className="text-muted-foreground">Seccional</dt>
              <dd>OAB/{p.uf}</dd>
              <dt className="text-muted-foreground">Horas</dt>
              <dd>{p.inputs.horasEstimadas}</dd>
              <dt className="text-muted-foreground">Valor da causa</dt>
              <dd>{formatBRL(p.inputs.valorCausaCents)}</dd>
              <dt className="text-muted-foreground">Complexidade</dt>
              <dd>{COMPLEXIDADES[p.inputs.complexidade].nome}</dd>
              <dt className="text-muted-foreground">Risco</dt>
              <dd>{RISCOS[p.inputs.risco].nome}</dd>
              <dt className="text-muted-foreground">Impostos</dt>
              <dd>{formatPercent(p.inputs.impostoPercentual ?? 0)}</dd>
              {(p.inputs.repassePercentual ?? 0) > 0 && (
                <>
                  <dt className="text-muted-foreground">Repasse por indicação</dt>
                  <dd>{formatPercent(p.inputs.repassePercentual ?? 0)}</dd>
                </>
              )}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Premissas internas: não aparecem na proposta enviada ao cliente.</p>
          </Section>
          <Section title="Faixa calculada">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {[
                ["Mínimo aceitável", r.minimoCents],
                ["Médio", r.medioCents],
                ["Ideal", r.idealCents],
              ].map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt className="text-muted-foreground">{rotulo}</dt>
                  <dd className="font-medium">{formatBRL(Number(valor), { semCentavos: true })}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <Section title="Memória de cálculo">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {r.memoria.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Section>
          <ConfirmActionButton
            variant="destructive"
            action={excluirProposta.bind(null, p.id)}
            confirmText="Excluir esta proposta? Essa ação não pode ser desfeita."
          >
            Excluir proposta
          </ConfirmActionButton>
        </aside>
      </div>
    </>
  );
}

export default function PropostaPage({ params }: PageProps<"/painel/honorarios/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Proposta params={params} />
    </Suspense>
  );
}
