import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, recomendacoesPeca } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, AutoRefresh, ConfirmActionButton, FormError } from "@/components/form-bits";
import { JobProgress, Section } from "@/components/app/page-parts";
import { AlertasCitacao, AvisoRevisao, FontesDeIds, ListaDeFontes } from "@/components/legal-bits";
import { requireSubscriber } from "@/lib/auth";
import { situacaoNaFila } from "@/lib/ai/fila";
import { ETAPAS_PECA } from "@/lib/ai/etapas";
import { AREAS } from "@/lib/pricing/engine";
import { formatDateTime } from "@/lib/format";
import type { RecomendacaoPecaData } from "@/lib/ai/schemas";
import { excluirRecomendacao, reprocessarRecomendacao } from "../actions";

export const metadata: Metadata = { title: "Recomendação de peça" };
export const maxDuration = 300;

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Recomendacao({ data }: { data: RecomendacaoPecaData }) {
  const r = data.recomendacao;
  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-3 border-l-[3px] border-tinta pl-5">
        <p className="text-sm font-medium text-tinta">Peça recomendada</p>
        <p className="font-serif text-2xl leading-snug font-semibold">{r.peca.nome}</p>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Procedimento</dt>
          <dd>{r.peca.procedimento}</dd>
          <dt className="text-muted-foreground">Competência</dt>
          <dd>{r.peca.competencia}</dd>
        </dl>
        <p className="texto-juridico">{r.peca.por_que_cabe}</p>
      </section>

      {r.requisitos.length > 0 && (
        <Section title="Requisitos legais da peça">
          <ul className="space-y-3">
            {r.requisitos.map((q, i) => (
              <li key={q.requisito} className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">{q.requisito}</span> <span className="text-muted-foreground">({q.dispositivo})</span>
                </p>
                {q.fonte_ids.length > 0 ? (
                  <FontesDeIds ids={q.fonte_ids} fontes={data.fontes} />
                ) : (
                  <p className="text-xs text-atencao">Dispositivo fora do acervo: confira na fonte oficial.</p>
                )}
                <AlertasCitacao alertas={data.alertasCitacao?.requisitos[i]} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.fundamentos.length > 0 && (
        <Section title="Fundamentos">
          <ul className="space-y-4">
            {r.fundamentos.map((f, i) => (
              <li key={f.tese} className="space-y-1 text-sm">
                <p className="font-medium">{f.tese}</p>
                <p className="text-muted-foreground">
                  {f.dispositivo}: {f.sintese}
                </p>
                {f.fonte_ids.length > 0 ? (
                  <FontesDeIds ids={f.fonte_ids} fontes={data.fontes} />
                ) : (
                  <p className="text-xs text-atencao">Fundamento fora do acervo: confira na fonte oficial.</p>
                )}
                <AlertasCitacao alertas={data.alertasCitacao?.fundamentos[i]} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {r.pedidos_cabiveis.length > 0 && (
          <Section title="Pedidos que cabem">
            <Lista itens={r.pedidos_cabiveis} />
          </Section>
        )}
        {r.provas_e_documentos.length > 0 && (
          <Section title="Provas e documentos">
            <Lista itens={r.provas_e_documentos} />
          </Section>
        )}
      </div>

      {r.prazos.length > 0 && (
        <Section title="Prazos">
          <ul className="space-y-2 text-sm">
            {r.prazos.map((p, i) => (
              <li key={p.descricao} className="space-y-1">
                <p>
                  <span className="font-medium">{p.descricao}:</span> {p.prazo} <span className="text-muted-foreground">({p.dispositivo})</span>
                </p>
                <AlertasCitacao alertas={data.alertasCitacao?.prazos[i]} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Para contar um prazo processual em dias, use a{" "}
            <Link href="/painel/prazos" className="text-tinta underline underline-offset-2">
              calculadora de prazos
            </Link>
            .
          </p>
        </Section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {r.alternativas.length > 0 && (
          <Section title="Alternativas">
            <ul className="space-y-1.5 text-sm">
              {r.alternativas.map((a) => (
                <li key={a.nome}>
                  <span className="font-medium">{a.nome}:</span> <span className="text-muted-foreground">{a.quando_preferir}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {r.riscos.length > 0 && (
          <Section title="Riscos e pontos fracos">
            <Lista itens={r.riscos} />
          </Section>
        )}
      </div>

      {r.informacoes_faltantes.length > 0 && (
        <Section title="Para confirmar a recomendação, falta saber">
          <Lista itens={r.informacoes_faltantes} />
        </Section>
      )}

      <Section title="Fontes do acervo citadas">
        <ListaDeFontes fontes={data.fontes} />
      </Section>

      <p className="text-sm text-muted-foreground">
        O Causídico recomenda a via processual e o que a peça precisa conter, mas não redige peças: a redação e a estratégia
        final são do advogado.
      </p>
      <AvisoRevisao modelo={data.modelo} geradoEm={data.geradoEm} />
    </div>
  );
}

async function Detalhe({ params }: { params: PageProps<"/painel/pecas/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ r: recomendacoesPeca, clienteNome: clientes.nome })
    .from(recomendacoesPeca)
    .leftJoin(clientes, eq(clientes.id, recomendacoesPeca.clienteId))
    .where(and(eq(recomendacoesPeca.id, id), eq(recomendacoesPeca.userId, viewer.id)))
    .limit(1);
  if (!row) notFound();
  const { r: rec, clienteNome } = row;

  const fila = rec.status === "processando" ? await situacaoNaFila("peca", rec.id) : null;
  const travada = fila?.estado === "inativa";
  const tentarDeNovo = (
    <ActionButton variant="outline" action={reprocessarRecomendacao.bind(null, rec.id)} pendingText="Reiniciando…">
      Tentar novamente
    </ActionButton>
  );

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm text-muted-foreground">
            {[
              rec.params.polo === "autor" ? "Cliente autor" : "Cliente réu",
              AREAS.find((a) => a.id === rec.params.area)?.nome,
              rec.params.uf ? `inclui leis de ${rec.params.uf}` : null,
              formatDateTime(rec.createdAt),
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <h1 className="font-serif text-2xl leading-snug font-semibold">{rec.titulo}</h1>
          {clienteNome && rec.clienteId && (
            <p className="text-sm">
              Cliente:{" "}
              <Link href={`/painel/clientes/${rec.clienteId}`} className="text-tinta underline underline-offset-2">
                {clienteNome}
              </Link>
            </p>
          )}
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Fatos informados</summary>
            <p className="mt-2 whitespace-pre-wrap">{rec.params.fatos}</p>
            {rec.params.objetivo && <p className="mt-2">Objetivo: {rec.params.objetivo}</p>}
          </details>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/painel/pecas">Nova recomendação</Link>
          </Button>
          <ConfirmActionButton
            variant="destructive"
            size="lg"
            action={excluirRecomendacao.bind(null, rec.id)}
            confirmText="Excluir esta recomendação? Essa ação não pode ser desfeita."
          >
            Excluir
          </ConfirmActionButton>
        </div>
      </header>

      {rec.status === "processando" && (
        <>
          {!travada && <AutoRefresh />}
          <JobProgress
            etapas={ETAPAS_PECA}
            atual={rec.progress}
            estimativa="A recomendação costuma levar de 3 a 6 minutos, e mais se houver outras tarefas na fila."
            travada={travada}
            fila={fila}
            acao={travada ? tentarDeNovo : undefined}
          />
        </>
      )}

      {rec.status === "erro" && (
        <div className="max-w-xl space-y-4">
          <FormError message={rec.error ?? "Não foi possível concluir."} />
          {tentarDeNovo}
        </div>
      )}

      {rec.status === "concluido" && rec.result && <Recomendacao data={rec.result} />}
    </>
  );
}

export default function PecaDetalhePage({ params }: PageProps<"/painel/pecas/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Detalhe params={params} />
    </Suspense>
  );
}
