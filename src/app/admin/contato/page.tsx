import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { contatos } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { ASSUNTOS_CONTATO, PRAZO_CONTATO_DIAS } from "@/lib/contato";
import { formatDateTime } from "@/lib/format";
import { arquivarContato } from "./actions";
import { ResponderContato } from "./responder";

export const metadata: Metadata = { title: "Contato" };

const numero = new Intl.NumberFormat("pt-BR");

async function Indicadores() {
  await requirePapel("suporte");
  const { rows } = await pool.query<{ abertas: number; vencidas: number; respondidas30d: number; horasMedias: number | null }>(`
    select count(*) filter (where status = 'aberta')::int as abertas,
           count(*) filter (where status = 'aberta' and created_at < now() - interval '${PRAZO_CONTATO_DIAS} days')::int as vencidas,
           count(*) filter (where status = 'respondida' and respondida_em > now() - interval '30 days')::int as "respondidas30d",
           (avg(extract(epoch from respondida_em - created_at)) filter (where status = 'respondida' and respondida_em > now() - interval '30 days') / 3600)::float8 as "horasMedias"
      from contatos`);
  const r = rows[0];
  return (
    <LinhaDeIndicadores>
      <Indicador rotulo="Aguardando resposta" valor={numero.format(r.abertas)} detalhe={`Prazo de ${PRAZO_CONTATO_DIAS} dias (Decreto 7.962/2013)`} />
      <Indicador rotulo="Fora do prazo" valor={numero.format(r.vencidas)} />
      <Indicador rotulo="Respondidas em 30 dias" valor={numero.format(r.respondidas30d)} />
      <Indicador
        rotulo="Tempo médio de resposta"
        valor={r.horasMedias === null ? "—" : r.horasMedias < 48 ? `${Math.round(r.horasMedias)} h` : `${Math.round(r.horasMedias / 24)} dias`}
        detalhe="Últimos 30 dias"
      />
    </LinhaDeIndicadores>
  );
}

async function Abertas() {
  await requirePapel("suporte");
  const lista = await db
    .select({ ...getTableColumns(contatos), dias: sql<number>`floor(extract(epoch from now() - ${contatos.createdAt}) / 86400)::int` })
    .from(contatos)
    .where(eq(contatos.status, "aberta"))
    .orderBy(asc(contatos.createdAt));
  return (
    <Tabela cabecalho={["Recebida", "De", "Assunto", "Mensagem", "Responder", ""]} vazio={lista.length === 0}>
      {lista.map((c) => (
        <tr key={c.id}>
          <Celula className="whitespace-nowrap">
            <SeloEstado estado={c.dias >= PRAZO_CONTATO_DIAS ? "erro" : c.dias >= PRAZO_CONTATO_DIAS - 2 ? "atencao" : "ok"}>
              {c.dias === 0 ? "Hoje" : `Há ${c.dias} dia(s)`}
            </SeloEstado>
            <span className="block text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
          </Celula>
          <Celula>
            {c.userId ? (
              <Link href={`/admin/usuarios/${c.userId}`} className="hover:text-tinta hover:underline">
                {c.nome}
              </Link>
            ) : (
              c.nome
            )}
            <span className="block text-xs text-muted-foreground">
              {c.email}
              {c.userId ? ", tem conta" : ""}
            </span>
          </Celula>
          <Celula>{ASSUNTOS_CONTATO[c.assunto]}</Celula>
          <Celula className="max-w-sm whitespace-pre-wrap text-muted-foreground">{c.mensagem}</Celula>
          <Celula className="min-w-72">
            <ResponderContato id={c.id} />
          </Celula>
          <Celula>
            <ConfirmActionButton size="sm" variant="ghost" action={arquivarContato.bind(null, c.id)} confirmText="Arquivar sem responder?">
              Arquivar
            </ConfirmActionButton>
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Historico() {
  await requirePapel("suporte");
  const lista = await db.select().from(contatos).where(ne(contatos.status, "aberta")).orderBy(desc(contatos.respondidaEm)).limit(50);
  return (
    <Tabela cabecalho={["Recebida", "De", "Assunto", "Situação", "Resposta"]} vazio={lista.length === 0}>
      {lista.map((c) => (
        <tr key={c.id}>
          <Celula className="whitespace-nowrap">{formatDateTime(c.createdAt)}</Celula>
          <Celula>{c.email}</Celula>
          <Celula>{ASSUNTOS_CONTATO[c.assunto]}</Celula>
          <Celula>{c.status === "respondida" ? `Respondida em ${c.respondidaEm ? formatDateTime(c.respondidaEm) : "—"}` : "Arquivada"}</Celula>
          <Celula className="max-w-sm text-muted-foreground">
            <span className="line-clamp-3">{c.resposta ?? "—"}</span>
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

export default async function ContatoAdminPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("suporte");
  return (
    <div className="space-y-10">
      <PageHeader title="Contato" description="Mensagens do formulário de contato. A resposta vai por e-mail e fica registrada." />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Indicadores />
      </Suspense>
      <Section title="Aguardando resposta (mais antigas primeiro)">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <Abertas />
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
