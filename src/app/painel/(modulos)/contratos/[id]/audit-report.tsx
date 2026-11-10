import type { ReactNode } from "react";
import { AlertasCitacao, AvisoRevisao, FontesDeIds, ListaDeFontes, SeveridadeTag } from "@/components/legal-bits";
import { Section } from "@/components/app/page-parts";
import { cn } from "@/lib/utils";
import type { CategoriaAchado, ContractAnalysisData, Severidade } from "@/lib/ai/schemas";

const CATEGORIAS: Record<CategoriaAchado, string> = {
  brecha: "Brecha",
  ambiguidade: "Ambiguidade",
  omissao: "Omissão",
  abusividade: "Abusividade",
  erro_formal: "Erro formal",
  inconformidade_legal: "Inconformidade legal",
};

const PERSPECTIVAS: Record<string, string> = {
  contratante: "Representando a parte contratante",
  contratado: "Representando a parte contratada",
  neutra: "Revisão neutra",
};

/** Veredito em forma de carimbo, a partir da nota de risco. */
function Carimbo({ nota }: { nota: number }) {
  const v =
    nota < 30
      ? { texto: "Pode assinar", classe: "border-deferido text-deferido" }
      : nota < 60
        ? { texto: "Negociar ajustes", classe: "border-atencao text-atencao" }
        : nota < 80
          ? { texto: "Negociar antes de assinar", classe: "border-carimbo text-carimbo" }
          : { texto: "Não assinar como está", classe: "border-carimbo text-carimbo" };
  return (
    <div className={cn("inline-flex -rotate-2 flex-col items-center rounded-md border-2 px-4 py-2", v.classe)}>
      <span className="font-serif text-lg leading-tight font-semibold">{v.texto}</span>
      <span className="text-xs">Risco {nota} de 100</span>
    </div>
  );
}

const grifoPorSeveridade = (s: Severidade) => (s === "alta" || s === "critica" ? "grifo" : "grifo grifo-suave");

/** Texto do contrato com os trechos dos achados grifados e numerados. */
function ContratoGrifado({ texto, analise }: { texto: string; analise: ContractAnalysisData }) {
  const marcas = analise.localizacao
    .map((loc, i) => (loc ? { ...loc, indice: i, severidade: analise.parecer.achados[i].severidade } : null))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => a.inicio - b.inicio);

  const partes: ReactNode[] = [];
  let cursor = 0;
  for (const m of marcas) {
    if (m.inicio < cursor) continue; // trechos sobrepostos: mantém o primeiro
    partes.push(texto.slice(cursor, m.inicio));
    partes.push(
      <mark key={m.indice} id={`trecho-${m.indice + 1}`} className={cn(grifoPorSeveridade(m.severidade), "scroll-mt-6")}>
        {texto.slice(m.inicio, m.fim)}
        <a
          href={`#achado-${m.indice + 1}`}
          className="ml-0.5 align-super font-sans text-[0.65rem] font-semibold text-tinta no-underline"
          aria-label={`Ver achado ${m.indice + 1}`}
        >
          {m.indice + 1}
        </a>
      </mark>,
    );
    cursor = m.fim;
  }
  partes.push(texto.slice(cursor));

  return <div className="texto-juridico text-[0.9rem] whitespace-pre-wrap">{partes}</div>;
}

export function AuditReport({
  analise,
  texto,
  perspectiva,
}: {
  analise: ContractAnalysisData;
  texto: string;
  perspectiva: string;
}) {
  const { parecer, fontes } = analise;

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm text-muted-foreground">
            {parecer.tipo_contrato}. {PERSPECTIVAS[perspectiva] ?? ""}.
          </p>
          <p className="texto-juridico text-[1.05rem]">{parecer.resumo_executivo}</p>
          <p className="text-sm text-muted-foreground">
            O Analista apontou {analise.equipe.analista} e o Pesquisador {analise.equipe.pesquisador} pontos; o Estrategista
            consolidou {parecer.achados.length} achados.
          </p>
          {(analise.alertasCitacao?.flat().length ?? 0) > 0 && (
            <p className="text-sm font-medium text-carimbo">
              {analise.alertasCitacao!.flat().length} citação(ões) não foram encontradas no acervo e podem estar erradas. Veja
              os alertas em vermelho nos achados.
            </p>
          )}
        </div>
        <Carimbo nota={parecer.nota_risco} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-achados" className="space-y-4">
          <h2 id="titulo-achados" className="text-base font-semibold">
            Achados
          </h2>
          {parecer.achados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum problema relevante foi encontrado nas cláusulas existentes.</p>
          )}
          {parecer.achados.map((a, i) => (
            <article key={i} id={`achado-${i + 1}`} className="scroll-mt-6 space-y-3 rounded-lg border border-border bg-folha p-5">
              <header className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-tinta text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-medium">{a.titulo}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-9 text-xs">
                  <SeveridadeTag severidade={a.severidade} />
                  <span className="text-muted-foreground">{CATEGORIAS[a.categoria]}</span>
                  <span className="text-muted-foreground">{a.clausula}</span>
                  {analise.localizacao[i] && (
                    <a href={`#trecho-${i + 1}`} className="text-tinta underline underline-offset-2">
                      Ver no contrato
                    </a>
                  )}
                </div>
              </header>
              <div className="space-y-3 pl-9 text-sm">
                {a.trecho && (
                  <blockquote className="texto-juridico border-l-2 border-marca pl-3 text-[0.9rem] text-muted-foreground">
                    {a.trecho}
                  </blockquote>
                )}
                <p>{a.analise}</p>
                {a.fundamento && (
                  <div className="space-y-1.5">
                    <p>
                      <span className="font-medium">Fundamento: </span>
                      {a.fundamento}
                    </p>
                    {a.fonte_ids.length > 0 ? (
                      <FontesDeIds ids={a.fonte_ids} fontes={fontes} />
                    ) : (
                      <p className="text-xs text-atencao">Fundamento fora do acervo: confira na fonte oficial.</p>
                    )}
                    <AlertasCitacao alertas={analise.alertasCitacao?.[i]} />
                  </div>
                )}
                <p className="rounded-md bg-accent/50 p-3">
                  <span className="font-medium">O que corrigir: </span>
                  {a.medida_corretiva}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section aria-labelledby="titulo-texto" className="lg:sticky lg:top-6 lg:h-fit">
          <h2 id="titulo-texto" className="mb-4 text-base font-semibold">
            Contrato analisado
          </h2>
          <div className="folha max-h-[75vh] overflow-y-auto px-6 py-6 sm:px-8">
            <ContratoGrifado texto={texto} analise={analise} />
          </div>
        </section>
      </div>

      {parecer.clausulas_ausentes.length > 0 && (
        <Section title="Cláusulas que faltam">
          <div className="grid gap-4 md:grid-cols-2">
            {parecer.clausulas_ausentes.map((c) => (
              <article key={c.titulo} className="space-y-2 rounded-lg border border-border bg-folha p-5 text-sm">
                <h3 className="font-medium">{c.titulo}</h3>
                <p className="text-muted-foreground">{c.justificativa}</p>
                {/* Pareceres antigos tinham redação pronta; ela não é mais exibida (a IA não redige). */}
                {c.o_que_deve_prever && (
                  <p className="rounded-md bg-accent/50 p-3">
                    <span className="font-medium">O que deve prever: </span>
                    {c.o_que_deve_prever}
                  </p>
                )}
              </article>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {parecer.pontos_fortes.length > 0 && (
          <Section title="Pontos fortes">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {parecer.pontos_fortes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>
        )}
        {parecer.proximos_passos.length > 0 && (
          <Section title="Próximos passos">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {parecer.proximos_passos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      {analise.equipe.observacoes.length > 0 && (
        <Section title="Observações da equipe">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {analise.equipe.observacoes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Fontes do acervo citadas">
        <ListaDeFontes fontes={fontes} />
      </Section>

      <AvisoRevisao modelo={analise.modelo} geradoEm={analise.geradoEm} />
    </div>
  );
}
