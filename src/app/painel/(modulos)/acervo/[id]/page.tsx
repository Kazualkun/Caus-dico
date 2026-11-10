import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, MessageSquareTextIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, CopyButton } from "@/components/form-bits";
import { SeloProcedencia } from "@/components/acervo/conferencia";
import { requireSubscriber, temPapel } from "@/lib/auth";
import { dispositivosDaNorma, obterNorma } from "@/lib/acervo/busca";
import { nomeDaArea } from "@/lib/acervo/areas";
import { origemDaNorma } from "@/lib/acervo/catalogo";
import type { ExplicacaoNorma } from "@/lib/ai/explicacao";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { gerarExplicacao } from "../actions";
import { IrParaArtigo } from "./ir-para-artigo";
import { TextoNorma } from "./texto-norma";

export const metadata: Metadata = { title: "Norma" };

function Explicacao({ normaId, explicacao }: { normaId: number; explicacao: string | null }) {
  if (!explicacao) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">Precisa explicar esta norma a um cliente? Gere um resumo em linguagem simples.</span>
        <ActionButton variant="outline" action={gerarExplicacao.bind(null, normaId)} pendingText="Lendo a norma…">
          <SparklesIcon aria-hidden />
          Explicar em linguagem simples
        </ActionButton>
      </div>
    );
  }
  const e = JSON.parse(explicacao) as ExplicacaoNorma;
  return (
    <section aria-labelledby="titulo-explicacao" className="space-y-3 rounded-lg border border-border bg-folha p-5">
      <h2 id="titulo-explicacao" className="text-sm font-semibold">
        Em linguagem simples
      </h2>
      <div className="space-y-2 text-sm">
        <p>{e.o_que_e}</p>
        <p>
          <span className="font-medium">Para que serve: </span>
          {e.para_que_serve}
        </p>
        <p>
          <span className="font-medium">A quem se aplica: </span>
          {e.a_quem_se_aplica}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {e.pontos_principais.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        {e.atencao.length > 0 && (
          <ul className="space-y-1 text-atencao">
            {e.atencao.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Gerado por IA a partir do texto da norma. Confira no texto integral antes de citar.</p>
    </section>
  );
}

async function Norma({ params }: { params: PageProps<"/painel/acervo/[id]">["params"] }) {
  const viewer = await requireSubscriber();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const norma = await obterNorma(id);
  if (!norma) notFound();
  const dispositivos = await dispositivosDaNorma(id);
  const artigos = dispositivos.filter((d) => /^(ADCT, )?Art/.test(d.referencia));
  const citacao = norma.apelido ? `${norma.titulo} (${norma.apelido})` : norma.titulo;
  const assunto = norma.apelido ?? norma.titulo;

  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="order-2 space-y-5 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
        {artigos.length > 3 && <IrParaArtigo artigos={artigos.map(({ referencia, ancora }) => ({ referencia, ancora }))} />}
        {norma.sumario.length > 0 && (
          <nav aria-label="Sumário da norma" className="text-sm">
            <p className="mb-2 text-xs text-muted-foreground">Sumário</p>
            <ol className="space-y-1">
              {norma.sumario.map((s) => (
                <li key={s.ancora} style={{ paddingLeft: `${(s.nivel - 1) * 0.6}rem` }}>
                  <a href={`#${s.ancora}`} className="line-clamp-2 text-muted-foreground hover:text-tinta">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </aside>

      <article className="order-1 min-w-0 space-y-8 lg:order-2">
        <header className="space-y-4">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href={`/painel/acervo?esfera=${norma.esfera}`} className="rounded-[3px] bg-muted px-1.5 py-0.5 text-grafite hover:underline">
              {origemDaNorma(norma)}
            </Link>
            <span>{norma.tipo}</span>
            {norma.data && <span>{new Date(`${norma.data}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" })}</span>}
            <span
              className={cn(
                "rounded-[3px] border px-1.5",
                norma.revogada ? "border-carimbo/50 text-carimbo" : "border-deferido/40 text-deferido",
              )}
            >
              {norma.revogada ? "Revogada" : "Sem revogação indicada"}
            </span>
          </p>
          <div>
            <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{norma.apelido ?? norma.titulo}</h1>
            {norma.apelido && <p className="mt-1 text-muted-foreground">{norma.titulo}</p>}
          </div>

          {norma.ementa && (
            <section aria-labelledby="titulo-serve" className="border-l-[3px] border-tinta pl-4">
              <h2 id="titulo-serve" className="text-xs text-muted-foreground">
                Para que serve (ementa oficial)
              </h2>
              <p className="texto-juridico text-lg">{norma.ementa}</p>
            </section>
          )}

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {norma.areas.length > 0 && (
              <>
                <dt className="text-muted-foreground">Áreas</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {norma.areas.map((a) => (
                    <Link key={a} href={`/painel/acervo?area=${a}`} className="rounded-full border border-border px-2 py-0.5 text-xs hover:border-tinta">
                      {nomeDaArea(a)}
                    </Link>
                  ))}
                </dd>
              </>
            )}
            {norma.nomesPopulares.length > 0 && (
              <>
                <dt className="text-muted-foreground">Também conhecida como</dt>
                <dd>{norma.nomesPopulares.join("; ")}</dd>
              </>
            )}
            {norma.indexacao && (
              <>
                <dt className="text-muted-foreground">Indexação oficial</dt>
                <dd className="text-muted-foreground">{norma.indexacao}</dd>
              </>
            )}
            {norma.situacao && (
              <>
                <dt className="text-muted-foreground">Situação na fonte</dt>
                <dd>{norma.situacao}</dd>
              </>
            )}
            {norma.versaoTexto && (
              <>
                <dt className="text-muted-foreground">Versão do texto</dt>
                <dd>{norma.versaoTexto}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Atualizada no acervo em</dt>
            <dd>{formatDateTime(norma.atualizadaEm)}</dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/painel/pesquisa?norma=${norma.id}&sobre=${encodeURIComponent(`Sobre a norma "${assunto}": `)}`}>
                <MessageSquareTextIcon aria-hidden />
                Perguntar à IA sobre esta norma
              </Link>
            </Button>
            {norma.fonteUrl && (
              <Button asChild variant="outline">
                <a href={norma.fonteUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon aria-hidden />
                  Fonte oficial
                </a>
              </Button>
            )}
            <CopyButton text={citacao} label="Copiar citação" />
            {temPapel(viewer, "administrador") && (
              <Button asChild variant="outline">
                <Link href={`/admin/acervo/normas/${norma.id}`}>
                  <ShieldCheckIcon aria-hidden />
                  Curadoria
                </Link>
              </Button>
            )}
          </div>
        </header>

        <SeloProcedencia
          fonte={norma.fonte}
          curada={norma.curada}
          conferidaEm={norma.conferidaEm}
          conferencia={norma.conferencia}
          hashTexto={norma.hashTexto}
        />

        {norma.removidaEm && (
          <p className="rounded-md bg-atencao/10 px-3 py-2 text-sm text-atencao">
            Esta norma saiu do acervo de origem em {formatDateTime(norma.removidaEm)}. O texto abaixo é a última versão recebida.
          </p>
        )}

        <Explicacao normaId={norma.id} explicacao={norma.explicacao} />

        <div className="folha px-6 py-8 sm:px-10">
          <TextoNorma texto={norma.texto} sumario={norma.sumario} dispositivos={dispositivos} />
        </div>

        <p className="text-xs text-muted-foreground">
          {norma.fonte === "curadoria" ? (
            <>Texto incluído pela curadoria do Causídico a partir da fonte oficial indicada.</>
          ) : (
            <>
              Texto obtido do acervo aberto{" "}
              <a href={norma.repoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                ctresb/leis
              </a>
              , convertido das fontes oficiais{norma.curada ? " e corrigido pela curadoria do Causídico" : ""}.
            </>
          )}{" "}
          Tem caráter informativo: em caso de divergência, vale o texto publicado no Diário Oficial.
        </p>
      </article>
    </div>
  );
}

export default function NormaPage({ params }: PageProps<"/painel/acervo/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
      <Norma params={params} />
    </Suspense>
  );
}
