import { Suspense } from "react";
import type { Metadata } from "next";
import { asc, desc, getTableColumns, inArray, notInArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { lgpdSolicitacoes } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ResponderSolicitacao } from "./responder";

export const metadata: Metadata = { title: "LGPD" };

const numero = new Intl.NumberFormat("pt-BR");

async function Abertas() {
  await requirePapel("administrador");
  const lista = await db
    .select({
      ...getTableColumns(lgpdSolicitacoes),
      dias: sql<number>`ceil(extract(epoch from ${lgpdSolicitacoes.prazoEm} - now()) / 86400)::int`,
    })
    .from(lgpdSolicitacoes)
    .where(inArray(lgpdSolicitacoes.status, ["aberta", "em_andamento"]))
    .orderBy(asc(lgpdSolicitacoes.prazoEm));
  return (
    <Tabela cabecalho={["Prazo", "Titular", "Pedido", "Detalhes", "Responder"]} vazio={lista.length === 0}>
      {lista.map((s) => {
        const dias = s.dias;
        return (
          <tr key={s.id}>
            <Celula className="whitespace-nowrap">
              <SeloEstado estado={dias < 0 ? "erro" : dias <= 3 ? "atencao" : "ok"}>
                {dias < 0 ? `Vencida há ${-dias} dia(s)` : `${dias} dia(s)`}
              </SeloEstado>
              <span className="block text-xs text-muted-foreground">{formatDateTime(s.prazoEm)}</span>
            </Celula>
            <Celula>
              {s.nome}
              <span className="block text-xs text-muted-foreground">{s.email}{s.userId ? ", tem conta" : ", sem conta"}</span>
            </Celula>
            <Celula>{s.tipo}</Celula>
            <Celula className="max-w-xs text-muted-foreground">{s.descricao ?? "—"}</Celula>
            <Celula className="min-w-72">
              <ResponderSolicitacao id={s.id} />
            </Celula>
          </tr>
        );
      })}
    </Tabela>
  );
}

async function Historico() {
  await requirePapel("administrador");
  const lista = await db
    .select()
    .from(lgpdSolicitacoes)
    .where(notInArray(lgpdSolicitacoes.status, ["aberta", "em_andamento"]))
    .orderBy(desc(lgpdSolicitacoes.createdAt))
    .limit(50);
  return (
    <Tabela cabecalho={["Recebida", "Titular", "Pedido", "Situação", "Respondida"]} vazio={lista.length === 0}>
      {lista.map((s) => (
        <tr key={s.id}>
          <Celula className="whitespace-nowrap">{formatDateTime(s.createdAt)}</Celula>
          <Celula>{s.email}</Celula>
          <Celula>{s.tipo}</Celula>
          <Celula>{s.status}</Celula>
          <Celula className="whitespace-nowrap">{s.respondidaEm ? formatDateTime(s.respondidaEm) : "—"}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Indicadores() {
  await requirePapel("administrador");
  const { rows } = await pool.query<{ aceites: number; acessos: number; maisAntigo: Date | null; abertas: number }>(`
    select (select count(*)::int from aceites_termos) as aceites,
           (select count(*)::int from registros_acesso) as acessos,
           (select min(created_at) from registros_acesso) as "maisAntigo",
           (select count(*)::int from lgpd_solicitacoes where status in ('aberta','em_andamento')) as abertas`);
  const r = rows[0];
  return (
    <LinhaDeIndicadores>
      <Indicador rotulo="Solicitações em aberto" valor={numero.format(r.abertas)} detalhe="Prazo de 15 dias (art. 19)" />
      <Indicador rotulo="Aceites de termos registrados" valor={numero.format(r.aceites)} detalhe="Versão, data e IP" />
      <Indicador
        rotulo="Registros de acesso"
        valor={numero.format(r.acessos)}
        detalhe={r.maisAntigo ? `Mais antigo: ${formatDateTime(r.maisAntigo)} (guarda de 6 meses)` : "Guarda de 6 meses"}
      />
    </LinhaDeIndicadores>
  );
}

export default async function LgpdPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-10">
      <PageHeader
        title="LGPD"
        description="Solicitações de titulares, aceites e guarda de registros. A resposta é enviada por e-mail e fica registrada."
      />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Indicadores />
      </Suspense>
      <Section title="Solicitações em aberto (mais urgentes primeiro)">
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
