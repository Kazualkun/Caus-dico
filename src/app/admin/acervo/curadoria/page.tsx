import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
import { pool } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { buscarNormas } from "@/lib/acervo/busca";
import { origemDaNorma } from "@/lib/acervo/catalogo";
import { STATUS_REVISAO, TIPO_REVISAO } from "@/lib/acervo/tipos-curadoria";
import { formatDateTime } from "@/lib/format";
import { dispensarAlertaAction, verificarIntegridadeAction } from "./actions";

export const metadata: Metadata = { title: "Curadoria do acervo" };

const numero = new Intl.NumberFormat("pt-BR");

async function Indicadores() {
  await requirePapel("administrador");
  const { rows } = await pool.query<{ pendentes: number; curadas: number; conferidas: number; alertas: number; aprovadas30d: number }>(`
    select (select count(*)::int from normas_revisoes where status = 'pendente') as pendentes,
           (select count(*)::int from normas where curada) as curadas,
           (select count(*)::int from normas where conferida_em is not null) as conferidas,
           (select count(*)::int from normas where curada and origem_mudou_em is not null) as alertas,
           (select count(*)::int from normas_revisoes where status = 'aprovada' and revisada_em > now() - interval '30 days') as "aprovadas30d"`);
  const r = rows[0];
  return (
    <LinhaDeIndicadores>
      <Indicador rotulo="Aguardando revisão" valor={numero.format(r.pendentes)} detalhe="Precisam de um segundo revisor" />
      <Indicador rotulo="Normas conferidas" valor={numero.format(r.conferidas)} detalhe="Texto batido com a fonte oficial" />
      <Indicador rotulo="Incluídas ou corrigidas" valor={numero.format(r.curadas)} detalhe="Protegidas da sincronização" />
      <Indicador rotulo="Aprovadas em 30 dias" valor={numero.format(r.aprovadas30d)} />
      <Indicador rotulo="Origem mudou" valor={numero.format(r.alertas)} detalhe="Curadas alteradas no repositório" />
    </LinhaDeIndicadores>
  );
}

async function Pendentes() {
  const viewer = await requirePapel("administrador");
  const { rows } = await pool.query<{
    id: string; tipo: keyof typeof TIPO_REVISAO; titulo: string | null; autor_email: string; autor_id: string | null;
    created_at: Date; status_conf: string | null; norma_id: number | null;
  }>(
    `select r.id, r.tipo, coalesce(r.dados->>'titulo', n.titulo) as titulo, r.autor_email, r.autor_id, r.created_at,
            r.conferencia->>'status' as status_conf, r.norma_id
       from normas_revisoes r left join normas n on n.id = r.norma_id
      where r.status = 'pendente' order by r.created_at`,
  );
  return (
    <Tabela cabecalho={["Desde", "Tipo", "Norma", "Conferência automática", "Autor", ""]} vazio={rows.length === 0}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Celula className="whitespace-nowrap">{formatDateTime(r.created_at)}</Celula>
          <Celula>{TIPO_REVISAO[r.tipo]}</Celula>
          <Celula>{r.titulo ?? "—"}</Celula>
          <Celula>
            <SeloEstado estado={r.status_conf === "confere" ? "ok" : r.status_conf === "divergente" ? "erro" : "atencao"}>
              {r.status_conf === "confere" ? "Confere" : r.status_conf === "divergente" ? "Diverge" : "Não lida"}
            </SeloEstado>
          </Celula>
          <Celula className="text-muted-foreground">{r.autor_id === viewer.id ? "você" : r.autor_email}</Celula>
          <Celula>
            <Link href={`/admin/acervo/revisoes/${r.id}`} className="text-tinta underline underline-offset-2">
              {r.autor_id === viewer.id ? "Abrir" : "Revisar"}
            </Link>
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Alertas() {
  await requirePapel("administrador");
  const [{ rows: origem }, { rows: estado }] = await Promise.all([
    pool.query<{ id: number; titulo: string; origem_mudou_em: Date }>(
      "select id, titulo, origem_mudou_em from normas where curada and origem_mudou_em is not null order by origem_mudou_em desc limit 50",
    ),
    pool.query<{ valor: { verificadaEm: string; violadas: { id: number; titulo: string }[] } }>(
      "select valor from acervo_estado where chave = 'integridade'",
    ),
  ]);
  const integridade = estado[0]?.valor;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-folha p-4 text-sm">
        <div>
          <p className="font-medium">Integridade dos textos conferidos</p>
          <p className="text-muted-foreground">
            {integridade
              ? integridade.violadas.length
                ? `${integridade.violadas.length} texto(s) mudaram fora da curadoria (verificado em ${formatDateTime(integridade.verificadaEm)}).`
                : `Todos íntegros na última verificação, em ${formatDateTime(integridade.verificadaEm)}.`
              : "Compara a impressão digital (SHA-256) de cada texto conferido com o texto publicado. Também roda na rotina diária."}
          </p>
        </div>
        <ActionButton variant="outline" action={verificarIntegridadeAction} pendingText="Verificando…" successText="Todos os textos conferidos estão íntegros.">
          Verificar agora
        </ActionButton>
      </div>
      {integridade && integridade.violadas.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-carimbo">
          {integridade.violadas.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/acervo/normas/${v.id}`} className="underline underline-offset-2">
                {v.titulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {origem.length > 0 && (
        <Tabela cabecalho={["Norma curada", "Mudou no repositório em", ""]}>
          {origem.map((n) => (
            <tr key={n.id}>
              <Celula>
                <Link href={`/admin/acervo/normas/${n.id}`} className="hover:text-tinta hover:underline">
                  {n.titulo}
                </Link>
              </Celula>
              <Celula className="whitespace-nowrap">{formatDateTime(n.origem_mudou_em)}</Celula>
              <Celula>
                <ActionButton size="sm" variant="outline" action={dispensarAlertaAction.bind(null, Number(n.id))} successText="Alerta dispensado.">
                  Manter a versão curada
                </ActionButton>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}

async function Historico() {
  await requirePapel("administrador");
  const { rows } = await pool.query<{
    id: string; tipo: keyof typeof TIPO_REVISAO; status: keyof typeof STATUS_REVISAO; titulo: string | null;
    autor_email: string; revisor_email: string | null; revisada_em: Date | null;
  }>(
    `select r.id, r.tipo, r.status, coalesce(r.dados->>'titulo', n.titulo) as titulo, r.autor_email, r.revisor_email, r.revisada_em
       from normas_revisoes r left join normas n on n.id = r.norma_id
      where r.status <> 'pendente' order by r.revisada_em desc nulls last limit 50`,
  );
  return (
    <Tabela cabecalho={["Concluída", "Tipo", "Norma", "Situação", "Autor", "Revisor"]} vazio={rows.length === 0}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Celula className="whitespace-nowrap">{r.revisada_em ? formatDateTime(r.revisada_em) : "—"}</Celula>
          <Celula>{TIPO_REVISAO[r.tipo]}</Celula>
          <Celula>
            <Link href={`/admin/acervo/revisoes/${r.id}`} className="hover:text-tinta hover:underline">
              {r.titulo ?? "—"}
            </Link>
          </Celula>
          <Celula>{STATUS_REVISAO[r.status]}</Celula>
          <Celula className="text-muted-foreground">{r.autor_email}</Celula>
          <Celula className="text-muted-foreground">{r.revisor_email ?? (r.status === "aprovada" ? "conferência automática" : "—")}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Localizar({ searchParams }: { searchParams: PageProps<"/admin/acervo/curadoria">["searchParams"] }) {
  await requirePapel("administrador");
  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim().slice(0, 200) : "";
  const resultado = termo ? await buscarNormas({ q: termo, modo: "normas", incluirRevogadas: true, pagina: 1 }) : null;
  return (
    <div className="space-y-3">
      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Localizar norma
        </label>
        <Input id="q" name="q" defaultValue={termo} placeholder='Ex.: "lei 8.078/90", "CDC", "decreto 7.962"' className="max-w-xl" />
        <Button type="submit" variant="outline">
          <SearchIcon aria-hidden />
          Localizar
        </Button>
      </form>
      {resultado && (
        <Tabela cabecalho={["Norma", "Origem", ""]} vazio={resultado.itens.length === 0}>
          {resultado.itens.slice(0, 10).map((n) => (
            <tr key={n.id}>
              <Celula>
                {n.apelido ?? n.titulo}
                {n.apelido && <span className="block text-xs text-muted-foreground">{n.titulo}</span>}
              </Celula>
              <Celula className="text-muted-foreground">{origemDaNorma(n)}</Celula>
              <Celula className="whitespace-nowrap">
                <Link href={`/admin/acervo/normas/${n.id}`} className="text-tinta underline underline-offset-2">
                  Conferir ou corrigir
                </Link>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}

export default async function CuradoriaPage({ searchParams }: PageProps<"/admin/acervo/curadoria">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-10">
      <PageHeader
        title="Curadoria do acervo"
        description="Inclusões, correções e conferências com a fonte oficial. Tudo passa por conferência automática e pela aprovação de um segundo revisor."
        actions={
          <Button asChild>
            <Link href="/admin/acervo/normas/nova">
              <PlusIcon aria-hidden />
              Incluir norma
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Indicadores />
      </Suspense>
      <Section title="Aguardando revisão">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <Pendentes />
        </Suspense>
      </Section>
      <Section title="Conferir ou corrigir uma norma">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Localizar searchParams={searchParams} />
        </Suspense>
      </Section>
      <Section title="Alertas">
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <Alertas />
        </Suspense>
      </Section>
      <Section title="Histórico">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <Historico />
        </Suspense>
      </Section>
    </div>
  );
}
