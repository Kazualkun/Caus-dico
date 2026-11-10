import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, SeloEstado, Tabela } from "@/components/admin/visual";
import { ResultadoConferencia } from "@/components/acervo/conferencia";
import { requirePapel } from "@/lib/auth";
import { normaParaCuradoria, obterRevisao } from "@/lib/acervo/curadoria";
import { compararVersoes } from "@/lib/acervo/conferencia";
import { ESFERA_NOME } from "@/lib/acervo/catalogo";
import { STATUS_REVISAO, TIPO_REVISAO, type DadosNorma } from "@/lib/acervo/tipos-curadoria";
import { formatDateTime } from "@/lib/format";
import { aprovarRevisaoAction, cancelarRevisaoAction, rejeitarRevisaoAction } from "../../curadoria/actions";
import { AprovarForm, RejeitarForm } from "./decisao";

export const metadata: Metadata = { title: "Revisão do acervo" };
export const maxDuration = 60;

const ROTULOS: Record<keyof DadosNorma, string> = {
  esfera: "Esfera", uf: "UF", municipio: "Município", orgao: "Tribunal ou órgão", tipo: "Tipo", tipoSlug: "Categoria",
  numero: "Número", ano: "Ano", data: "Data", titulo: "Título", apelido: "Nome popular", ementa: "Ementa",
  situacao: "Situação", revogada: "Revogada",
};
const valor = (k: keyof DadosNorma, v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : k === "esfera" ? ESFERA_NOME[v as DadosNorma["esfera"]] : k === "revogada" ? (v ? "Sim" : "Não") : String(v);
const MAX_ARTIGOS = 80;
const MAX_TRECHO = 3000;
const corte = (t: string) => (t.length > MAX_TRECHO ? `${t.slice(0, MAX_TRECHO)}…` : t);

async function Revisao({ params }: { params: PageProps<"/admin/acervo/revisoes/[id]">["params"] }) {
  const viewer = await requirePapel("administrador");
  const r = await obterRevisao((await params).id);
  if (!r) notFound();
  const norma = r.normaId ? await normaParaCuradoria(r.normaId) : null;
  const autor = r.autorId === viewer.id;

  const camposAlterados =
    r.tipo === "edicao" && r.dados && r.anterior
      ? (Object.keys(ROTULOS) as (keyof DadosNorma)[]).filter((k) => JSON.stringify(r.anterior!.dados[k] ?? null) !== JSON.stringify(r.dados![k] ?? null))
      : [];
  const artigos = r.tipo === "edicao" && r.texto && r.anterior ? compararVersoes(r.anterior.texto, r.texto) : [];
  const divergente = r.conferencia?.status !== "confere";
  const titulo = r.dados?.titulo ?? norma?.titulo ?? "Norma";

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${TIPO_REVISAO[r.tipo]}: ${titulo}`}
        description={
          <>
            Proposta por {autor ? "você" : r.autorEmail} em {formatDateTime(r.createdAt)}.{" "}
            {r.normaId && (
              <Link href={`/admin/acervo/normas/${r.normaId}`} className="text-tinta underline underline-offset-2">
                Ver a norma
              </Link>
            )}
          </>
        }
      />

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Situação</dt>
        <dd>
          <SeloEstado estado={r.status === "aprovada" ? "ok" : r.status === "pendente" ? "andamento" : "atencao"}>{STATUS_REVISAO[r.status]}</SeloEstado>
        </dd>
        <dt className="text-muted-foreground">{r.tipo === "edicao" ? "O que mudou e por quê" : "Motivo"}</dt>
        <dd className="whitespace-pre-wrap">{r.justificativa}</dd>
        {r.revisadaEm && (
          <>
            <dt className="text-muted-foreground">{r.status === "cancelada" ? "Cancelada em" : "Revisada em"}</dt>
            <dd>
              {formatDateTime(r.revisadaEm)}
              {r.revisorEmail ? ` por ${r.revisorEmail}` : r.status === "aprovada" ? " (conferência automática)" : ""}
            </dd>
          </>
        )}
        {r.parecer && (
          <>
            <dt className="text-muted-foreground">Parecer do revisor</dt>
            <dd className="whitespace-pre-wrap">{r.parecer}</dd>
          </>
        )}
        {r.hashTexto && (
          <>
            <dt className="text-muted-foreground">Impressão digital do texto</dt>
            <dd className="font-mono text-xs break-all">{r.hashTexto}</dd>
          </>
        )}
      </dl>

      {r.conferencia && (
        <Section title="Conferência automática com a fonte oficial">
          <ResultadoConferencia c={r.conferencia} />
        </Section>
      )}

      {camposAlterados.length > 0 && (
        <Section title="Dados alterados">
          <Tabela cabecalho={["Campo", "Publicado", "Proposto"]}>
            {camposAlterados.map((k) => (
              <tr key={k}>
                <Celula className="font-medium">{ROTULOS[k]}</Celula>
                <Celula className="text-muted-foreground">{valor(k, r.anterior!.dados[k])}</Celula>
                <Celula>{valor(k, r.dados![k])}</Celula>
              </tr>
            ))}
          </Tabela>
        </Section>
      )}

      {artigos.length > 0 && (
        <Section title={`Texto alterado (${artigos.length} ${artigos.length === 1 ? "trecho" : "trechos"})`}>
          <ol className="space-y-4">
            {artigos.slice(0, MAX_ARTIGOS).map((a) => (
              <li key={a.referencia} className="space-y-2 rounded-lg border border-border bg-folha p-4">
                <p className="text-sm font-medium">
                  {a.referencia}{" "}
                  <span className="font-normal text-muted-foreground">
                    {a.antes === null && a.depois !== null ? "(incluído)" : a.depois === null && a.antes !== null ? "(removido)" : ""}
                  </span>
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {a.antes !== null && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Publicado</p>
                      <p className="texto-juridico rounded-md bg-carimbo/5 p-3 text-sm whitespace-pre-wrap">{corte(a.antes)}</p>
                    </div>
                  )}
                  {a.depois !== null && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Proposto</p>
                      <p className="texto-juridico rounded-md bg-deferido/5 p-3 text-sm whitespace-pre-wrap">{corte(a.depois)}</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {artigos.length > MAX_ARTIGOS && <p className="text-sm text-muted-foreground">E mais {artigos.length - MAX_ARTIGOS} trechos.</p>}
        </Section>
      )}

      {r.tipo === "inclusao" && r.texto && (
        <Section title="Texto proposto">
          <details className="rounded-lg border border-border bg-folha p-4">
            <summary className="cursor-pointer text-sm">Ver o texto ({r.texto.length.toLocaleString("pt-BR")} caracteres)</summary>
            <pre className="texto-juridico mt-3 max-h-[32rem] overflow-auto text-sm whitespace-pre-wrap">{r.texto}</pre>
          </details>
        </Section>
      )}

      {r.status === "pendente" &&
        (autor ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
            <p className="text-muted-foreground">Aguardando outro administrador ou desenvolvedor revisar. Quem propõe não aprova a própria alteração.</p>
            <ConfirmActionButton variant="outline" size="sm" action={cancelarRevisaoAction.bind(null, r.id)} confirmText="Cancelar esta revisão?">
              Cancelar revisão
            </ConfirmActionButton>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <AprovarForm acao={aprovarRevisaoAction.bind(null, r.id)} divergente={divergente} />
            <RejeitarForm acao={rejeitarRevisaoAction.bind(null, r.id)} />
          </div>
        ))}
    </div>
  );
}

export default async function RevisaoPage({ params }: PageProps<"/admin/acervo/revisoes/[id]">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Revisao params={params} />
    </Suspense>
  );
}
