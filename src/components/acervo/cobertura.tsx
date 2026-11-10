import { Fragment } from "react";
import { CircleCheckIcon, CircleDashedIcon, CircleIcon } from "lucide-react";
import { Section } from "@/components/app/page-parts";
import { cn } from "@/lib/utils";
import { coberturaPorUf, FASES_COBERTURA, FONTE_PROGRESSO, MINIMO_LEIS_ESTADUAIS } from "@/lib/acervo/cobertura";

const numero = new Intl.NumberFormat("pt-BR");
const percentual = (tem: number, meta: number) => Math.min(100, (tem / meta) * 100);
// Uma casa decimal: 99,7% não pode aparecer como 100%.
const formatarPct = (v: number) => `${(Math.floor(v * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Situacao({ pct }: { pct: number }) {
  if (pct >= 98) {
    return (
      <span className="inline-flex items-center gap-1.5 text-deferido">
        <CircleCheckIcon className="size-4" aria-hidden />
        Praticamente completa
      </span>
    );
  }
  if (pct >= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 text-tinta">
        <CircleDashedIcon className="size-4" aria-hidden />
        Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-atencao">
      <CircleIcon className="size-4" aria-hidden />
      Inicial
    </span>
  );
}

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";

/** O que existe e o que falta no acervo: resumo, tabela do projeto de origem e contagem por estado. */
export async function CoberturaAcervo() {
  const ufs = await coberturaPorUf();
  const incompletas = ufs.filter((u) => u.leis < MINIMO_LEIS_ESTADUAIS);
  const municipios = ufs.reduce((s, u) => s + u.municipios, 0);
  const serie = (nome: string) => FASES_COBERTURA.flatMap((f) => f.series).find((s) => s.serie === nome)!;
  const decretosFederais = serie("Decretos do Executivo federal");
  const leisEstaduais = serie("Leis estaduais e distritais");

  return (
    <Section title="O que o acervo cobre">
      <ul className="max-w-3xl space-y-2 text-sm">
        <li>
          <span className="font-medium">Federal: praticamente completa.</span> Constituição, leis federais, medidas
          provisórias e atos do Congresso estão quase integralmente no acervo; os decretos federais, em cerca de{" "}
          {formatarPct(percentual(decretosFederais.tem, decretosFederais.meta))}.
        </li>
        <li>
          <span className="font-medium">Estadual: leis com boa cobertura.</span> Cerca de{" "}
          {formatarPct(percentual(leisEstaduais.tem, leisEstaduais.meta))} do universo estimado, quase completas na maioria
          dos estados
          {incompletas.length > 0 ? (
            <>
              ; em {incompletas.map((u) => u.uf).join(" e ")}, a coleta das leis estaduais está ausente ou incompleta na
              fonte
            </>
          ) : null}
          . Decretos e demais atos estaduais estão só em parte dos estados.
        </li>
        <li>
          <span className="font-medium">Municipal: parcial.</span> {numero.format(municipios)} municípios têm alguma norma no
          acervo, com prioridade para as capitais, mas a maior parte da legislação municipal do país ainda não está aqui.
          Para norma municipal, confira sempre o diário oficial ou o portal do município.
        </li>
      </ul>

      <div className="overflow-x-auto rounded-lg border border-border bg-folha">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Cobertura do acervo por série de normas</caption>
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className={th}>Situação</th>
              <th className={th}>Série</th>
              <th className={cn(th, "text-right")}>No acervo</th>
              <th className={cn(th, "text-right")}>Universo estimado</th>
              <th className={cn(th, "text-right")}>Cobertura</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {FASES_COBERTURA.map((f) => (
              <Fragment key={f.fase}>
                <tr className="border-t border-border bg-muted/30">
                  <th scope="rowgroup" colSpan={5} className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {f.fase}
                  </th>
                </tr>
                {f.series.map((s) => {
                  const pct = percentual(s.tem, s.meta);
                  return (
                    <tr key={s.serie} className="border-t border-border">
                      <td className={cn(td, "whitespace-nowrap")}>
                        <Situacao pct={pct} />
                      </td>
                      <td className={td}>
                        <span className="block font-medium">{s.serie}</span>
                        <span className="block text-xs text-muted-foreground">{s.detalhe}</span>
                      </td>
                      <td className={cn(td, "text-right")}>{numero.format(s.tem)}</td>
                      <td className={cn(td, "text-right")}>~{numero.format(s.meta)}</td>
                      <td className={cn(td, "text-right font-medium")}>{formatarPct(pct)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Fonte:{" "}
        <a href={FONTE_PROGRESSO.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-grafite">
          PROGRESSO.md do projeto ctresb/leis
        </a>
        , gerado em {FONTE_PROGRESSO.geradoEm}, de onde o acervo é sincronizado. O universo estimado é a meta de cada série
        no projeto; volume não comprova a integralidade de cada norma.
      </p>

      <details className="rounded-lg border border-border bg-folha p-4 text-sm">
        <summary className="cursor-pointer font-medium">Cobertura por estado</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem]">
            <caption className="sr-only">Normas estaduais e municipais por estado</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className={th}>UF</th>
                <th className={cn(th, "text-right")}>Leis estaduais</th>
                <th className={cn(th, "text-right")}>Decretos estaduais</th>
                <th className={cn(th, "text-right")}>Municípios com normas</th>
                <th className={cn(th, "text-right")}>Normas municipais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ufs.map((u) => (
                <tr key={u.uf}>
                  <th scope="row" className={cn(td, "text-left font-medium")}>
                    {u.uf}
                  </th>
                  <td className={cn(td, "text-right", u.leis < MINIMO_LEIS_ESTADUAIS && "font-medium text-atencao")}>
                    {numero.format(u.leis)}
                    {u.leis < MINIMO_LEIS_ESTADUAIS && <span className="block text-xs font-normal">coleta incompleta</span>}
                  </td>
                  <td className={cn(td, "text-right", u.decretos === 0 && "text-muted-foreground")}>
                    {u.decretos ? numero.format(u.decretos) : "ainda não"}
                  </td>
                  <td className={cn(td, "text-right")}>{numero.format(u.municipios)}</td>
                  <td className={cn(td, "text-right")}>{numero.format(u.municipais)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Contagem atual do acervo do Causídico, atualizada a cada hora.</p>
      </details>
    </Section>
  );
}
