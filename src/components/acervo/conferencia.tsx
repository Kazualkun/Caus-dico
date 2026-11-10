import { CircleAlertIcon, CircleCheckIcon, ShieldCheckIcon } from "lucide-react";
import { SeloEstado } from "@/components/admin/visual";
import type { Conferencia } from "@/lib/acervo/tipos-curadoria";
import { formatDateTime } from "@/lib/format";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Resultado completo da conferência automática (administração). */
export function ResultadoConferencia({ c }: { c: Conferencia }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-folha p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <SeloEstado estado={c.status === "confere" ? "ok" : c.status === "divergente" ? "erro" : "atencao"}>
          {c.status === "confere"
            ? "Confere com a fonte oficial"
            : c.status === "divergente"
              ? "Diverge da fonte oficial"
              : "Fonte não pôde ser lida automaticamente"}
        </SeloEstado>
        {c.artigos > 0 && (
          <span className="text-muted-foreground">
            {c.conferidos} de {c.artigos} trechos idênticos à fonte
          </span>
        )}
        <span className="text-muted-foreground">em {formatDateTime(c.verificadaEm)}</span>
      </div>
      <p className="text-muted-foreground">
        Fonte:{" "}
        <a href={c.fonte} target="_blank" rel="noreferrer" className="break-all text-tinta underline underline-offset-2">
          {c.fonte}
        </a>
      </p>
      {c.detalhe && <p className="text-atencao">{c.detalhe}</p>}
      {c.divergentes.length > 0 && (
        <div>
          <p className="font-medium">No texto, mas diferentes na fonte (ou ausentes dela):</p>
          <p className="mt-1 text-muted-foreground">{c.divergentes.join("; ")}</p>
        </div>
      )}
      {c.faltando.length > 0 && (
        <div>
          <p className="font-medium">Vigentes na fonte, mas ausentes do texto:</p>
          <p className="mt-1 text-muted-foreground">{c.faltando.join("; ")}</p>
        </div>
      )}
    </div>
  );
}

/** Selo de procedência para o assinante: de onde veio o texto e se foi conferido. */
export function SeloProcedencia({
  fonte,
  curada,
  conferidaEm,
  conferencia,
  hashTexto,
}: {
  fonte: string;
  curada: boolean;
  conferidaEm: Date | null;
  conferencia: Conferencia | null;
  hashTexto: string | null;
}) {
  const conferida = conferidaEm && conferencia;
  return (
    <section
      aria-labelledby="titulo-procedencia"
      className={
        conferida
          ? "space-y-1.5 rounded-lg border border-deferido/30 bg-deferido/5 p-4 text-sm"
          : "space-y-1.5 rounded-lg border border-border bg-folha p-4 text-sm"
      }
    >
      <h2 id="titulo-procedencia" className="flex items-center gap-2 font-medium">
        {conferida ? (
          <ShieldCheckIcon className="size-4 text-deferido" aria-hidden />
        ) : (
          <CircleAlertIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
        {conferida ? "Texto conferido com a fonte oficial" : "Texto ainda não conferido individualmente"}
      </h2>
      {conferida ? (
        <p className="text-muted-foreground">
          {conferencia.metodo === "revisao" ? "Conferido por dois revisores da equipe" : "Conferido automaticamente"} em{" "}
          {formatDateTime(conferidaEm)} com{" "}
          <a href={conferencia.fonte} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {host(conferencia.fonte)}
          </a>
          {conferencia.status === "confere" && conferencia.artigos > 0 && (
            <>
              {": "}
              <CircleCheckIcon className="inline size-3.5 text-deferido" aria-hidden /> {conferencia.conferidos} de {conferencia.artigos}{" "}
              trechos idênticos
            </>
          )}
          .{hashTexto && <span className="block font-mono text-xs">Impressão digital do texto conferido (SHA-256): {hashTexto.slice(0, 16)}…</span>}
        </p>
      ) : (
        <p className="text-muted-foreground">
          {fonte === "curadoria" || curada
            ? "Incluído pela curadoria a partir da fonte oficial indicada."
            : "Texto compilado pelo acervo aberto ctresb/leis a partir da fonte oficial indicada abaixo, atualizado sempre que a fonte muda."}{" "}
          Confira o texto no link da fonte oficial antes de citar.
        </p>
      )}
    </section>
  );
}
