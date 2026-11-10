import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, AutoRefresh, ConfirmActionButton, FormError } from "@/components/form-bits";
import { JobProgress, Section } from "@/components/app/page-parts";
import { AlertasCitacao, AvisoRevisao, FontesDeIds, ListaDeFontes } from "@/components/legal-bits";
import { requireSubscriber } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { searchHistory } from "@/db/schema";
import { situacaoNaFila } from "@/lib/ai/fila";
import { ETAPAS_PESQUISA } from "@/lib/ai/etapas";
import { formatDateTime } from "@/lib/format";
import type { ParecerPesquisa, ResearchData } from "@/lib/ai/schemas";
import { excluirPesquisa, reprocessarPesquisa } from "../actions";

export const metadata: Metadata = { title: "Pesquisa" };
export const maxDuration = 300;

const CONSENSO: Record<ParecerPesquisa["grau_de_consenso"], { nome: string; classe: string }> = {
  pacifico: { nome: "Entendimento pacífico", classe: "text-deferido" },
  majoritario: { nome: "Entendimento majoritário", classe: "text-deferido" },
  controvertido: { nome: "Tema controvertido", classe: "text-atencao" },
  minoritario: { nome: "Tese minoritária", classe: "text-carimbo" },
  incerto: { nome: "Cenário incerto", classe: "text-atencao" },
};

/**
 * A IA só recomenda a peça; a redação é do advogado. Pesquisas antigas traziam
 * um roteiro com texto da peça: dele só o nome da peça é exibido.
 */
function PecaRecomendada({ parecer }: { parecer: ParecerPesquisa & { roteiro_peca?: { peca_sugerida: string } } }) {
  const r = parecer.peca_recomendada;
  if (!r) {
    if (!parecer.roteiro_peca) return null;
    return (
      <Section title="Peça recomendada">
        <p className="text-sm font-medium">{parecer.roteiro_peca.peca_sugerida}</p>
      </Section>
    );
  }
  return (
    <Section title="Peça recomendada">
      <div className="max-w-3xl space-y-4 text-sm">
        <div className="space-y-1">
          <p className="font-serif text-lg font-semibold">{r.peca}</p>
          <p>{r.por_que_cabe}</p>
        </div>
        {r.requisitos.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-medium">Requisitos e documentos</p>
            <ul className="list-disc space-y-1 pl-5">
              {r.requisitos.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {r.prazo && (
          <p>
            <span className="font-medium">Prazo: </span>
            {r.prazo}
          </p>
        )}
        {r.alternativas.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-medium">Alternativas</p>
            <ul className="space-y-1.5">
              {r.alternativas.map((a) => (
                <li key={a.peca}>
                  <span className="font-medium">{a.peca}:</span> <span className="text-muted-foreground">{a.quando_preferir}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          O Causídico recomenda a via processual, mas não redige peças: a redação e a estratégia final são do advogado.
        </p>
      </div>
    </Section>
  );
}

function Relatorio({ data }: { data: ResearchData }) {
  const p = data.parecer;
  const consenso = CONSENSO[p.grau_de_consenso];

  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-3 border-l-[3px] border-tinta pl-5">
        <p className={`text-sm font-medium ${consenso.classe}`}>{consenso.nome}</p>
        <p className="texto-juridico text-lg">{p.resposta_direta}</p>
      </section>

      <Section title="Tese central" className="max-w-3xl">
        <p className="texto-juridico">{p.resumo_tese}</p>
      </Section>

      <Section title="Fundamentação legal">
        <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
          {p.fundamentacao_legal.map((f, i) => (
            <li key={f.dispositivo} className="grid gap-2 p-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <p className="font-medium">{f.dispositivo}</p>
              <div className="space-y-2 text-sm">
                <p>{f.sintese}</p>
                {f.fonte_ids.length > 0 ? (
                  <FontesDeIds ids={f.fonte_ids} fontes={data.fontes} />
                ) : (
                  <p className="text-xs text-atencao">Fora do acervo: confira o texto na fonte oficial.</p>
                )}
                <AlertasCitacao alertas={data.alertasCitacao?.[i]} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Posição doutrinária">
          <ul className="space-y-3 text-sm">
            {p.posicao_doutrinaria.map((d) => (
              <li key={d.corrente}>
                <p className="font-medium">{d.corrente}</p>
                <p className="text-muted-foreground">{d.sintese}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tendência jurisprudencial">
          <p className="text-sm">{p.tendencia_jurisprudencial.panorama}</p>
          {p.tendencia_jurisprudencial.precedentes.length > 0 && (
            <ul className="space-y-3 text-sm">
              {p.tendencia_jurisprudencial.precedentes.map((j) => (
                <li key={j.referencia} className="space-y-1.5">
                  <p className="font-medium">{j.referencia}</p>
                  <p className="text-muted-foreground">{j.sintese}</p>
                  <FontesDeIds ids={j.fonte_ids} fontes={data.fontes} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <PecaRecomendada parecer={p} />

      {p.argumentos_contrarios.length > 0 && (
        <Section title="Argumentos contrários">
          <div className="overflow-hidden rounded-lg border border-border bg-folha">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="w-1/2 px-4 py-2.5 font-medium">A parte contrária pode alegar</th>
                  <th className="px-4 py-2.5 font-medium">Como responder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {p.argumentos_contrarios.map((a) => (
                  <tr key={a.argumento}>
                    <td className="px-4 py-3">{a.argumento}</td>
                    <td className="px-4 py-3">{a.como_responder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {p.pontos_de_atencao.length > 0 && (
        <Section title="Pontos de atenção">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {p.pontos_de_atencao.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Fontes do acervo citadas">
        <ListaDeFontes fontes={data.fontes} />
      </Section>

      <AvisoRevisao modelo={data.modelo} geradoEm={data.geradoEm} />
    </div>
  );
}

async function Pesquisa({ params }: { params: PageProps<"/painel/pesquisa/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireSubscriber();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select()
    .from(searchHistory)
    .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, viewer.id)))
    .limit(1);
  if (!row) notFound();

  const fila = row.status === "processando" ? await situacaoNaFila("pesquisa", row.id) : null;
  const travada = fila?.estado === "inativa";
  const tentarDeNovo = (
    <ActionButton variant="outline" action={reprocessarPesquisa.bind(null, row.id)} pendingText="Reiniciando…">
      Tentar novamente
    </ActionButton>
  );

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm text-muted-foreground">
            {[row.area, row.params.uf ? `inclui legislação de ${row.params.uf}` : null, formatDateTime(row.createdAt)].filter(Boolean).join(", ")}
          </p>
          <h1 className="font-serif text-2xl leading-snug font-semibold">{row.query}</h1>
          {row.params.fatos && <p className="text-sm text-muted-foreground">Fatos: {row.params.fatos}</p>}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/painel/pesquisa">Nova pesquisa</Link>
          </Button>
          <ConfirmActionButton
            variant="destructive"
            size="lg"
            action={excluirPesquisa.bind(null, row.id)}
            confirmText="Excluir esta pesquisa? Essa ação não pode ser desfeita."
          >
            Excluir
          </ConfirmActionButton>
        </div>
      </header>

      {row.status === "processando" && (
        <>
          {!travada && <AutoRefresh />}
          <JobProgress
            etapas={ETAPAS_PESQUISA}
            atual={row.progress}
            estimativa="A pesquisa costuma levar de 3 a 6 minutos, e mais se houver outras tarefas na fila."
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

      {row.status === "concluido" && row.result && <Relatorio data={row.result} />}
    </>
  );
}

export default function PesquisaDetalhePage({ params }: PageProps<"/painel/pesquisa/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Pesquisa params={params} />
    </Suspense>
  );
}
