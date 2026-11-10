import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FonteCitada, Severidade } from "@/lib/ai/schemas";

const SEVERIDADES: Record<Severidade, { nome: string; classe: string }> = {
  baixa: { nome: "Baixa", classe: "border-border text-muted-foreground" },
  media: { nome: "Média", classe: "border-atencao/40 bg-atencao/8 text-atencao" },
  alta: { nome: "Alta", classe: "border-carimbo/40 bg-carimbo/8 text-carimbo" },
  critica: { nome: "Crítica", classe: "border-carimbo bg-carimbo text-white" },
};

/** Citações da IA conferidas no acervo e não encontradas: provável erro de número de artigo. */
export function AlertasCitacao({ alertas }: { alertas?: string[] }) {
  if (!alertas?.length) return null;
  return (
    <ul className="space-y-1 rounded-md border border-carimbo/30 bg-carimbo/5 px-3 py-2 text-xs text-carimbo" role="note">
      {alertas.map((a) => (
        <li key={a} className="flex gap-1.5">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          {a}
        </li>
      ))}
    </ul>
  );
}

export function SeveridadeTag({ severidade }: { severidade: Severidade }) {
  const s = SEVERIDADES[severidade];
  return (
    <span className={cn("inline-flex h-5 items-center rounded-[3px] border px-1.5 text-xs font-medium", s.classe)}>
      Severidade {s.nome.toLowerCase()}
    </span>
  );
}

const rotulo = (f: FonteCitada) =>
  f.esfera === "jurisprudencia" ? f.titulo : `${f.apelido ?? f.titulo}, ${f.referencia.replace(/^Art\./, "art.")}`;

/** Referência a uma fonte do acervo: abre a norma no artigo citado. */
export function FonteChip({ fonte }: { fonte: FonteCitada }) {
  return (
    <Link
      href={`/painel/acervo/${fonte.normaId}#${fonte.ancora}`}
      title={fonte.texto.slice(0, 400)}
      className="inline-flex max-w-full items-center rounded-[3px] border border-tinta/25 bg-accent px-1.5 py-0.5 text-xs text-tinta hover:border-tinta/60"
    >
      <span className="truncate">{rotulo(fonte)}</span>
    </Link>
  );
}

export function FontesDeIds({ ids, fontes }: { ids: string[]; fontes: FonteCitada[] }) {
  const lista = ids.map((id) => fontes.find((f) => f.id === id)).filter((f): f is FonteCitada => Boolean(f));
  if (lista.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((f) => (
        <FonteChip key={f.id} fonte={f} />
      ))}
    </div>
  );
}

/** Lista completa das fontes do acervo usadas num resultado. */
export function ListaDeFontes({ fontes }: { fontes: FonteCitada[] }) {
  if (fontes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dispositivo do acervo foi citado. Os fundamentos acima devem ser conferidos na fonte oficial.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border rounded-md border border-border bg-folha">
      {fontes.map((f) => (
        <li key={f.id} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <div className="text-sm">
            <p className="font-medium">{f.esfera === "jurisprudencia" ? f.titulo : (f.apelido ?? f.titulo)}</p>
            <p className="text-muted-foreground">{f.esfera === "jurisprudencia" ? "Jurisprudência" : f.referencia}</p>
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="texto-juridico line-clamp-4 text-sm">{f.texto.replace(/\*+/g, "")}</p>
            <p className="flex flex-wrap gap-3 text-xs">
              <Link href={`/painel/acervo/${f.normaId}#${f.ancora}`} className="text-tinta underline underline-offset-2">
                Abrir no acervo
              </Link>
              {f.fonteUrl && (
                <a href={f.fonteUrl} target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-2">
                  Fonte oficial
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AvisoRevisao({ modelo, geradoEm }: { modelo: string; geradoEm: string }) {
  return (
    <p className="border-t border-border pt-4 text-xs text-muted-foreground">
      Conteúdo gerado por inteligência artificial ({modelo}) em{" "}
      {new Date(geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Serve de apoio à análise e não
      substitui a revisão do advogado responsável. Fundamentos sem fonte do acervo devem ser conferidos na legislação e na
      jurisprudência oficiais.
    </p>
  );
}
