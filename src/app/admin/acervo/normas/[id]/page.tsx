import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, PencilIcon } from "lucide-react";
import { pool } from "@/db";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, SeloEstado, Tabela } from "@/components/admin/visual";
import { ResultadoConferencia } from "@/components/acervo/conferencia";
import { requirePapel } from "@/lib/auth";
import { obterNorma } from "@/lib/acervo/busca";
import { origemDaNorma } from "@/lib/acervo/catalogo";
import { STATUS_REVISAO, TIPO_REVISAO } from "@/lib/acervo/tipos-curadoria";
import { formatDateTime } from "@/lib/format";
import { conferirNormaAction } from "../../curadoria/actions";
import { ConferirForm } from "./conferir-form";

export const metadata: Metadata = { title: "Norma" };
export const maxDuration = 60;

async function Norma({ params }: { params: PageProps<"/admin/acervo/normas/[id]">["params"] }) {
  await requirePapel("administrador");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const norma = await obterNorma(id);
  if (!norma) notFound();
  const { rows: revisoes } = await pool.query<{
    id: string; tipo: keyof typeof TIPO_REVISAO; status: keyof typeof STATUS_REVISAO; autor_email: string;
    revisor_email: string | null; created_at: Date; revisada_em: Date | null; hash_texto: string | null;
  }>(
    `select id, tipo, status, autor_email, revisor_email, created_at, revisada_em, hash_texto
       from normas_revisoes where norma_id = $1 order by created_at desc limit 50`,
    [id],
  );
  const pendente = revisoes.find((r) => r.status === "pendente");

  return (
    <div className="space-y-10">
      <PageHeader
        title={norma.apelido ?? norma.titulo}
        description={`${origemDaNorma(norma)} · ${norma.tipo}${norma.apelido ? ` · ${norma.titulo}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/painel/acervo/${id}`}>
                <ExternalLinkIcon aria-hidden />
                Ver como o assinante vê
              </Link>
            </Button>
            {!pendente && !norma.removidaEm && (
              <Button asChild>
                <Link href={`/admin/acervo/normas/${id}/editar`}>
                  <PencilIcon aria-hidden />
                  Corrigir texto ou dados
                </Link>
              </Button>
            )}
          </>
        }
      />

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Origem do texto</dt>
        <dd>
          {norma.fonte === "curadoria" ? "Incluída pela curadoria" : "Acervo ctresb/leis"}
          {norma.curada && norma.fonte !== "curadoria" ? ", corrigida pela curadoria (a sincronização não sobrescreve)" : ""}
        </dd>
        <dt className="text-muted-foreground">Fonte oficial</dt>
        <dd className="break-all">
          {norma.fonteUrl ? (
            <a href={norma.fonteUrl} target="_blank" rel="noreferrer" className="text-tinta underline underline-offset-2">
              {norma.fonteUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-muted-foreground">Atualizada no acervo</dt>
        <dd>{formatDateTime(norma.atualizadaEm)}</dd>
        <dt className="text-muted-foreground">Conferência</dt>
        <dd>
          <SeloEstado estado={norma.conferidaEm ? "ok" : "atencao"}>
            {norma.conferidaEm
              ? `Conferida em ${formatDateTime(norma.conferidaEm)} (${norma.conferencia?.metodo === "revisao" ? "dupla revisão" : "automática"})`
              : "Ainda não conferida"}
          </SeloEstado>
        </dd>
        {norma.hashTexto && (
          <>
            <dt className="text-muted-foreground">Impressão digital</dt>
            <dd className="font-mono text-xs break-all">{norma.hashTexto}</dd>
          </>
        )}
        {norma.origemMudouEm && (
          <>
            <dt className="text-muted-foreground">Alerta</dt>
            <dd className="text-atencao">O repositório de origem mudou esta norma em {formatDateTime(norma.origemMudouEm)}. Compare e corrija, se for o caso.</dd>
          </>
        )}
      </dl>

      {norma.conferencia && (
        <Section title="Última conferência">
          <ResultadoConferencia c={norma.conferencia} />
        </Section>
      )}

      <Section title="Conferir com a fonte oficial">
        {pendente ? (
          <p className="text-sm text-muted-foreground">
            Há uma revisão pendente para esta norma.{" "}
            <Link href={`/admin/acervo/revisoes/${pendente.id}`} className="text-tinta underline underline-offset-2">
              Abrir a revisão
            </Link>
          </p>
        ) : (
          <div className="max-w-xl">
            <ConferirForm acao={conferirNormaAction.bind(null, id)} fonte={norma.fonteUrl} />
          </div>
        )}
      </Section>

      <Section title="Histórico de revisões">
        <Tabela cabecalho={["Pedida em", "Tipo", "Situação", "Autor", "Revisor", "Impressão digital"]} vazio={revisoes.length === 0}>
          {revisoes.map((r) => (
            <tr key={r.id}>
              <Celula className="whitespace-nowrap">
                <Link href={`/admin/acervo/revisoes/${r.id}`} className="hover:text-tinta hover:underline">
                  {formatDateTime(r.created_at)}
                </Link>
              </Celula>
              <Celula>{TIPO_REVISAO[r.tipo]}</Celula>
              <Celula>{STATUS_REVISAO[r.status]}</Celula>
              <Celula className="text-muted-foreground">{r.autor_email}</Celula>
              <Celula className="text-muted-foreground">{r.revisor_email ?? (r.status === "aprovada" ? "automática" : "—")}</Celula>
              <Celula className="font-mono text-xs">{r.hash_texto?.slice(0, 12) ?? "—"}</Celula>
            </tr>
          ))}
        </Tabela>
      </Section>
    </div>
  );
}

export default async function NormaAdminPage({ params }: PageProps<"/admin/acervo/normas/[id]">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Norma params={params} />
    </Suspense>
  );
}
