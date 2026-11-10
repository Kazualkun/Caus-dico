import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { CompromissoAcervo } from "@/components/acervo/compromisso";
import { CoberturaAcervo } from "@/components/acervo/cobertura";
import { requireSubscriber } from "@/lib/auth";
import { BuscaAmplaDemaisError, buscarNormas, type FiltrosAcervo, type ResultadoNorma } from "@/lib/acervo/busca";
import { panoramaDoAcervo } from "@/lib/acervo/panorama";
import { AREAS_DIREITO, nomeDaArea } from "@/lib/acervo/areas";
import { ESFERA_NOME, TIPOS_FILTRO, origemDaNorma } from "@/lib/acervo/catalogo";
import { ESFERAS, type Esfera } from "@/lib/acervo/parser";
import { UFS, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Acervo de legislação" };

type Busca = Awaited<PageProps<"/painel/acervo">["searchParams"]>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const numero = new Intl.NumberFormat("pt-BR");
const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

function filtrosDe(p: Busca): FiltrosAcervo {
  const esfera = um(p.esfera);
  return {
    q: um(p.q) || undefined,
    modo: um(p.modo) === "texto" ? "texto" : "normas",
    esfera: (ESFERAS as readonly string[]).includes(esfera) ? (esfera as Esfera) : undefined,
    uf: um(p.uf) || undefined,
    tipo: um(p.tipo) || undefined,
    area: um(p.area) || undefined,
    anoDe: Number(um(p.anoDe)) || undefined,
    anoAte: Number(um(p.anoAte)) || undefined,
    incluirRevogadas: um(p.revogadas) === "1",
    pagina: Number(um(p.pagina)) || 1,
  };
}

function urlCom(p: Busca, mudancas: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (typeof v === "string" && v) u.set(k, v);
  for (const [k, v] of Object.entries(mudancas)) {
    if (v) u.set(k, v);
    else u.delete(k);
  }
  return `/painel/acervo?${u.toString()}`;
}

function FormularioBusca({ p }: { p: Busca }) {
  const f = filtrosDe(p);
  return (
    <form method="get" action="/painel/acervo" role="search" className="space-y-4 rounded-lg border border-border bg-folha p-5">
      <div className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar no acervo
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={f.q}
          placeholder='Ex.: "lei 8.078/90", "LC 123", "súmula 369", "CDC", "multa por rescisão de locação"'
          className="h-10 text-base"
        />
        <Button type="submit" size="lg" className="h-10 px-4">
          <SearchIcon aria-hidden />
          Buscar
        </Button>
      </div>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <legend className="sr-only">Onde procurar</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="normas" defaultChecked={f.modo !== "texto"} className="accent-tinta" />
          Nome, número e ementa
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="texto" defaultChecked={f.modo === "texto"} className="accent-tinta" />
          Dentro dos artigos
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="revogadas" value="1" defaultChecked={f.incluirRevogadas} className="accent-tinta" />
          Incluir revogadas
        </label>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <label htmlFor="esfera" className="text-xs text-muted-foreground">Esfera</label>
          <select id="esfera" name="esfera" defaultValue={f.esfera ?? ""} className={selectClasse}>
            <option value="">Todas</option>
            {ESFERAS.map((e) => (
              <option key={e} value={e}>
                {ESFERA_NOME[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="uf" className="text-xs text-muted-foreground">UF</label>
          <select id="uf" name="uf" defaultValue={f.uf ?? ""} className={selectClasse}>
            <option value="">Todas</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="tipo" className="text-xs text-muted-foreground">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={f.tipo ?? ""} className={selectClasse}>
            <option value="">Todos</option>
            {TIPOS_FILTRO.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="area" className="text-xs text-muted-foreground">Área</label>
          <select id="area" name="area" defaultValue={f.area ?? ""} className={selectClasse}>
            <option value="">Todas</option>
            {AREAS_DIREITO.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="anoDe" className="text-xs text-muted-foreground">De (ano)</label>
          <Input id="anoDe" name="anoDe" inputMode="numeric" defaultValue={f.anoDe ?? ""} />
        </div>
        <div className="space-y-1">
          <label htmlFor="anoAte" className="text-xs text-muted-foreground">Até (ano)</label>
          <Input id="anoAte" name="anoAte" inputMode="numeric" defaultValue={f.anoAte ?? ""} />
        </div>
      </div>
    </form>
  );
}

function ItemResultado({ n }: { n: ResultadoNorma }) {
  return (
    <li className="space-y-1.5 px-4 py-4">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-[3px] bg-muted px-1.5 py-0.5 text-grafite">{origemDaNorma(n)}</span>
        <span>{n.tipo}</span>
        {n.data && <span>{new Date(`${n.data}T12:00:00`).toLocaleDateString("pt-BR")}</span>}
        {n.revogada && <span className="rounded-[3px] border border-carimbo/40 px-1.5 text-carimbo">Revogada</span>}
      </p>
      <Link href={`/painel/acervo/${n.id}${n.ancora ? `#${n.ancora}` : ""}`} className="group block">
        <span className="font-serif text-lg font-semibold group-hover:text-tinta group-hover:underline">{n.apelido ?? n.titulo}</span>
        {n.apelido && <span className="ml-2 text-sm text-muted-foreground">{n.titulo}</span>}
      </Link>
      {n.ementa && <p className="texto-juridico line-clamp-3 text-sm text-grafite/90">{n.ementa}</p>}
      {n.trecho && (
        <p className="border-l-2 border-marca pl-3 text-sm text-muted-foreground">…{n.trecho.replace(/\*+/g, "").trim()}…</p>
      )}
      {n.areas.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {n.areas.map((a) => (
            <span key={a} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {nomeDaArea(a)}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

async function Resultados({ p }: { p: Busca }) {
  const f = filtrosDe(p);
  let r: Awaited<ReturnType<typeof buscarNormas>>;
  try {
    r = await buscarNormas(f);
  } catch (e) {
    if (e instanceof BuscaAmplaDemaisError) return <EmptyState title="Busca ampla demais">{e.message}</EmptyState>;
    throw e;
  }
  const paginas = Math.ceil(r.total / r.porPagina);

  if (r.itens.length === 0) {
    return (
      <EmptyState title="Nenhuma norma encontrada">
        Tente outras palavras, troque para “Dentro dos artigos” ou inclua as revogadas.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {f.esfera === "municipal" && (
        <p className="rounded-md bg-atencao/10 px-3 py-2 text-sm text-atencao" role="note">
          A legislação municipal do acervo é parcial: muitos municípios e normas ainda não estão aqui. Se não encontrar a norma,
          ela pode existir; confira no diário oficial ou no portal do município.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {r.maisQueLimite ? `Mais de ${numero.format(r.total)}` : numero.format(r.total)} resultado{r.total === 1 ? "" : "s"}
        {r.referencia ? " para o número informado" : ""}.
        {f.modo === "texto" && r.maisQueLimite && " Busca ampla: a ordem considera os primeiros 20 mil artigos encontrados. Acrescente termos para refinar."}
      </p>
      <ol className="divide-y divide-border rounded-lg border border-border bg-folha">
        {r.itens.map((n) => (
          <ItemResultado key={n.id} n={n} />
        ))}
      </ol>
      {paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {r.pagina > 1 ? (
            <Link href={urlCom(p, { pagina: String(r.pagina - 1) })} className="text-tinta underline underline-offset-2">
              Página anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {r.pagina} de {numero.format(paginas)}
          </span>
          {r.pagina < paginas ? (
            <Link href={urlCom(p, { pagina: String(r.pagina + 1) })} className="text-tinta underline underline-offset-2">
              Próxima página
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

async function Panorama() {
  const pano = await panoramaDoAcervo();
  return (
    <div className="space-y-12">
      <p className="text-sm text-muted-foreground">
        {numero.format(pano.total)} normas no acervo.
        {pano.sincronizacao?.concluidaEm && ` Última atualização em ${formatDateTime(pano.sincronizacao.concluidaEm)}.`}
      </p>

      <CompromissoAcervo conferidas={pano.conferidas} total={pano.total} />

      <CoberturaAcervo />

      <Section title="Por esfera">
        <ul className="grid overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3" style={{ gap: 1 }}>
          {pano.esferas.map((e) => (
            <li key={e.esfera} className="bg-folha">
              <Link href={`/painel/acervo?esfera=${e.esfera}`} className="block p-4 hover:bg-accent/50">
                <span className="block font-medium">{ESFERA_NOME[e.esfera as Esfera] ?? e.esfera}</span>
                <span className="text-sm text-muted-foreground">
                  {numero.format(e.total)} normas, {numero.format(e.vigentes)} sem revogação indicada
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Códigos e leis mais usados">
        <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {pano.principais.map((n) => (
            <li key={n.id}>
              <Link href={`/painel/acervo/${n.id}`} className="group block">
                <span className="font-medium group-hover:text-tinta group-hover:underline">{n.apelido}</span>
                <span className="block text-sm text-muted-foreground">{n.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Por área do direito (federal e jurisprudência)">
        <ul className="flex flex-wrap gap-2">
          {pano.areas.map((a) => (
            <li key={a.area}>
              <Link
                href={`/painel/acervo?area=${a.area}&esfera=federal`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-folha px-3 py-1.5 text-sm hover:border-tinta"
              >
                {nomeDaArea(a.area)}
                <span className="text-xs text-muted-foreground">{numero.format(a.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Classificação automática a partir da ementa e da indexação oficial; uma norma pode estar em mais de uma área.
        </p>
      </Section>

      {pano.publicacoes.length > 0 && (
        <Section title="Publicado recentemente no Diário Oficial da União">
          <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
            {pano.publicacoes.map((pub) => (
              <li key={pub.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{pub.titulo}</p>
                  {pub.ementa && <p className="line-clamp-2 text-sm text-muted-foreground">{pub.ementa}</p>}
                </div>
                <div className="text-sm sm:text-right">
                  {pub.normaId ? (
                    <Link href={`/painel/acervo/${pub.normaId}`} className="text-tinta underline underline-offset-2">
                      Ver no acervo
                    </Link>
                  ) : (
                    <a href={pub.link ?? "#"} target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-2">
                      Texto ainda no DOU
                    </a>
                  )}
                  <span className="block text-xs text-muted-foreground">{new Date(`${pub.data}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/painel/acervo">["searchParams"] }) {
  await requireSubscriber();
  const p = await searchParams;
  const temBusca = ["q", "esfera", "uf", "tipo", "area", "anoDe", "anoAte"].some((k) => um(p[k]));
  return (
    <div className="space-y-8">
      <FormularioBusca p={p} />
      {temBusca ? <Resultados p={p} /> : <Panorama />}
    </div>
  );
}

export default function AcervoPage({ searchParams }: PageProps<"/painel/acervo">) {
  return (
    <>
      <PageHeader
        title="Acervo de legislação"
        description="Constituição, leis federais e estaduais, decretos, súmulas e temas dos tribunais e parte da legislação municipal, atualizados a partir das fontes oficiais. Encontre a norma e veja para que ela serve."
      />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

