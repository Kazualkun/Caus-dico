import { Suspense } from "react";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, pool } from "@/db";
import { auditLog } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-parts";
import { ColunasDiarias } from "@/components/admin/colunas-diarias";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela, type Estado } from "@/components/admin/visual";
import { requirePapel, temPapel } from "@/lib/auth";
import { indicadoresGerais, medirLatencia, tempoDiarioIa } from "@/lib/admin/consultas";
import { iaDisponivel, MODEL } from "@/lib/ai/ollama";
import { formatBRL, formatDateTime } from "@/lib/format";

const numero = new Intl.NumberFormat("pt-BR");

async function Indicadores() {
  const viewer = await requirePapel("suporte");
  const i = await indicadoresGerais();
  const veCusto = temPapel(viewer, "administrador");
  return (
    <LinhaDeIndicadores>
      <Indicador rotulo="Usuários" valor={numero.format(i.usuarios)} detalhe={`${numero.format(i.novos7d)} novos nos últimos 7 dias`} />
      <Indicador
        rotulo="Assinantes ativos"
        valor={numero.format(i.ativas)}
        detalhe={`${i.pendentes} aguardando pagamento, ${i.inadimplentes} em atraso`}
      />
      <Indicador rotulo="Receita recorrente mensal" valor={veCusto ? formatBRL(i.mrrCentavos, { semCentavos: true }) : "—"} detalhe="Anuais divididos por 12" />
      <Indicador
        rotulo="Tarefas de IA em 24 h"
        valor={numero.format(i.tarefasOk24h)}
        detalhe={`${i.tarefasErro24h} com erro, ${i.tarefasAndamento} em andamento`}
      />
      <Indicador
        rotulo="Processamento de IA em 30 dias"
        valor={`${numero.format(Math.round(i.minutosIa30d))} min`}
        detalhe="Tempo de uso do modelo local"
      />
    </LinhaDeIndicadores>
  );
}

async function Saude() {
  await requirePapel("suporte");
  const [[{ rows: banco }, { rows: sync }, { rows: travadas }, i], latencia] = await medirLatencia(() => Promise.all([
    pool.query<{ tamanho: string }>("select pg_size_pretty(pg_database_size(current_database())) as tamanho"),
    pool.query<{ status: string; concluida_em: Date | null; iniciada_em: Date; processadas: number; dias_sem_sync: number | null }>(
      `select status, concluida_em, iniciada_em, processadas,
              extract(epoch from now() - concluida_em)::float8 / 86400 as dias_sem_sync
         from acervo_sincronizacoes where tipo in ('completa','incremental') order by id desc limit 1`,
    ),
    pool.query<{ n: number }>(
      `select count(*)::int as n from (select status, updated_at from contracts union all select status, updated_at from search_history) t
        where status = 'processando' and updated_at < now() - interval '30 minutes'`,
    ),
    indicadoresGerais(),
  ]));
  const iaOk = await iaDisponivel();
  const s = sync[0];
  const diasSemSync = s?.dias_sem_sync ?? Infinity;

  const linhas: { item: string; estado: Estado; detalhe: string; href?: string }[] = [
    { item: "Banco de dados", estado: "ok", detalhe: `Respondendo em ${latencia} ms, ${banco[0].tamanho}` },
    {
      item: "Acervo de legislação",
      estado: !s ? "atencao" : s.status === "executando" ? "andamento" : s.status === "erro" ? "erro" : diasSemSync > 3 ? "atencao" : "ok",
      detalhe: !s
        ? "Nenhuma sincronização ainda"
        : s.status === "executando"
          ? `Sincronizando desde ${formatDateTime(s.iniciada_em)} (${numero.format(s.processadas)} normas gravadas)`
          : `Última sincronização ${s.status === "erro" ? "com erro" : "concluída"} em ${formatDateTime(s.concluida_em ?? s.iniciada_em)}`,
      href: "/admin/acervo",
    },
    {
      item: "Webhook do Asaas",
      estado: i.webhooksErro24h > 0 ? "erro" : "ok",
      detalhe: i.webhooksErro24h > 0 ? `${i.webhooksErro24h} eventos com erro nas últimas 24 h` : "Sem erros nas últimas 24 h",
      href: "/admin/assinaturas",
    },
    {
      item: "Tarefas de IA",
      estado: travadas[0].n > 0 ? "atencao" : "ok",
      detalhe: travadas[0].n > 0 ? `${travadas[0].n} tarefas paradas há mais de 10 minutos` : "Nenhuma tarefa parada",
      href: "/admin/ia",
    },
    {
      item: "Solicitações LGPD",
      estado: i.lgpdVencendo > 0 ? "erro" : i.lgpdAbertas > 0 ? "atencao" : "ok",
      detalhe: i.lgpdAbertas ? `${i.lgpdAbertas} abertas, ${i.lgpdVencendo} vencendo em até 3 dias` : "Nenhuma pendente",
      href: "/admin/lgpd",
    },
    {
      item: "Integrações",
      estado: iaOk && process.env.ASAAS_API_KEY && process.env.RESEND_API_KEY ? "ok" : "atencao",
      detalhe: [
        iaOk ? null : `IA local fora do ar ou sem o modelo ${MODEL}`,
        process.env.ASAAS_API_KEY ? null : "pagamentos sem chave",
        process.env.RESEND_API_KEY ? null : "e-mails só na caixa de saída local",
      ]
        .filter(Boolean)
        .join(", ") || "IA, pagamentos e e-mail configurados",
    },
  ];

  return (
    <Tabela cabecalho={["Componente", "Situação", "Detalhe"]}>
      {linhas.map((l) => (
        <tr key={l.item}>
          <Celula className="font-medium">{l.href ? <Link href={l.href} className="hover:text-tinta hover:underline">{l.item}</Link> : l.item}</Celula>
          <Celula>
            <SeloEstado estado={l.estado} />
          </Celula>
          <Celula className="text-muted-foreground">{l.detalhe}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function TempoDiarioIa() {
  await requirePapel("suporte");
  const dados = await tempoDiarioIa(30);
  return (
    <div className="rounded-lg border border-border bg-folha p-5">
      <ColunasDiarias dados={dados} formato="minutos" rotulo="Processamento da IA por dia (minutos), últimos 30 dias" />
    </div>
  );
}

async function AuditoriaRecente() {
  const viewer = await requirePapel("suporte");
  if (!temPapel(viewer, "administrador")) return null;
  const eventos = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(8);
  return (
    <Section title="Ações recentes">
      <Tabela cabecalho={["Quando", "Quem", "Ação", "Alvo"]} vazio={eventos.length === 0}>
        {eventos.map((e) => (
          <tr key={e.id}>
            <Celula className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</Celula>
            <Celula>{e.atorEmail ?? "sistema"}</Celula>
            <Celula>{e.acao}</Celula>
            <Celula className="text-muted-foreground">{e.alvoTipo ? `${e.alvoTipo} ${e.alvoId ?? ""}` : "—"}</Celula>
          </tr>
        ))}
      </Tabela>
      <Link href="/admin/auditoria" className="text-sm text-tinta underline underline-offset-2">
        Ver a trilha completa
      </Link>
    </Section>
  );
}

export default async function AdminPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("suporte");
  return (
    <div className="space-y-10">
      <PageHeader title="Visão geral" description="Como o Causídico está funcionando agora." />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Indicadores />
      </Suspense>
      <Section title="Saúde do sistema">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Saude />
        </Suspense>
      </Section>
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <TempoDiarioIa />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <AuditoriaRecente />
      </Suspense>
    </div>
  );
}
