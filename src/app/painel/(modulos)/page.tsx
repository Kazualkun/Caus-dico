import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { BookOpenTextIcon, CalculatorIcon, FileTextIcon, LibraryIcon } from "lucide-react";
import { db } from "@/db";
import { contracts, prazos, pricingProposals, processos, recomendacoesPeca, searchHistory } from "@/db/schema";
import { pool } from "@/db";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "@/components/form-bits";
import { EmptyState, Section, tempoAproximado } from "@/components/app/page-parts";
import { SituacaoTarefa } from "@/components/app/situacao";
import { situacaoNaFila, type TipoTarefa } from "@/lib/ai/fila";
import { requireSubscriber } from "@/lib/auth";
import { getMonthlyUsage } from "@/lib/usage";
import { PLANS, RECURSO_LABEL, type Recurso } from "@/lib/plans";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FORMATOS } from "@/lib/pricing/engine";
import { diasAte, formatarData, hojeEmBrasilia, somarDias } from "@/lib/prazos/calculo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel" };

const ATALHOS = [
  {
    href: "/painel/honorarios",
    icone: CalculatorIcon,
    titulo: "Precificar um caso",
    texto: "Descreva o caso, veja o mínimo já com impostos e gere a proposta em PDF.",
  },
  {
    href: "/painel/contratos",
    icone: FileTextIcon,
    titulo: "Auditar um contrato",
    texto: "Envie o PDF ou o Word e receba o parecer com o que corrigir em cada cláusula.",
  },
  {
    href: "/painel/pesquisa",
    icone: BookOpenTextIcon,
    titulo: "Pesquisar uma tese",
    texto: "Lei, doutrina, tendência dos tribunais e a peça recomendada.",
  },
  {
    href: "/painel/acervo",
    icone: LibraryIcon,
    titulo: "Consultar a legislação",
    texto: "Encontre a norma e veja para que ela serve, artigo por artigo.",
  },
];

async function Saudacao() {
  const viewer = await requireSubscriber();
  const primeiroNome = viewer.fullName?.split(" ")[0];
  return (
    <h1 className="font-serif text-3xl font-semibold tracking-tight">
      {primeiroNome ? `Bom trabalho, ${primeiroNome}` : "Painel"}
    </h1>
  );
}

async function UsoDoMes() {
  const viewer = await requireSubscriber();
  const uso = await getMonthlyUsage(viewer.id);
  const limites = PLANS[viewer.plano].limites;

  return (
    <dl className="grid gap-6 sm:grid-cols-3">
      {(Object.keys(limites) as Recurso[]).map((recurso) => {
        const pct = Math.min(100, Math.round((uso[recurso] / limites[recurso]) * 100));
        return (
          <div key={recurso} className="space-y-2">
            <dt className="text-sm text-muted-foreground">{RECURSO_LABEL[recurso]}</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-semibold">{uso[recurso]}</span>
              <span className="text-sm text-muted-foreground">de {limites[recurso]}</span>
            </dd>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={cn("h-full rounded-full", pct >= 90 ? "bg-carimbo" : "bg-tinta")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

/** Prazos em aberto que vencem nos próximos 7 dias (e os já vencidos). */
async function ProximosPrazos() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select({ id: prazos.id, descricao: prazos.descricao, vencimento: prazos.vencimento, processoId: prazos.processoId, processo: processos.titulo })
    .from(prazos)
    .leftJoin(processos, eq(processos.id, prazos.processoId))
    .where(and(eq(prazos.userId, viewer.id), isNull(prazos.cumpridoEm), lte(prazos.vencimento, somarDias(hojeEmBrasilia(), 7))))
    .orderBy(asc(prazos.vencimento))
    .limit(10);
  if (!lista.length) return null;
  return (
    <Section title="Prazos desta semana">
      <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
        {lista.map((p) => {
          const n = diasAte(p.vencimento);
          return (
            <li key={p.id}>
              <Link href={p.processoId ? `/painel/prazos/processos/${p.processoId}` : "/painel/prazos"} className="flex justify-between gap-4 px-4 py-3 hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.descricao}</span>
                  {p.processo && <span className="block truncate text-sm text-muted-foreground">{p.processo}</span>}
                </span>
                <span className={cn("text-right text-sm whitespace-nowrap", n <= 1 ? "font-medium text-carimbo" : "text-atencao")}>
                  {n < 0 ? "Vencido" : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : `Em ${n} dias`}
                  <span className="block text-muted-foreground">{formatarData(p.vencimento)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const ROTA_E_ROTULO: Record<Exclude<TipoTarefa, "triagem">, [string, string]> = {
  auditoria: ["/painel/contratos", "Auditoria"],
  pesquisa: ["/painel/pesquisa", "Pesquisa"],
  peca: ["/painel/pecas", "Recomendação de peça"],
};

/** Tarefas de IA do usuário na fila ou em andamento, com a previsão de cada uma. */
async function AnalisesEmAndamento() {
  const viewer = await requireSubscriber();
  const { rows } = await pool.query<{ tipo: Exclude<TipoTarefa, "triagem">; referenciaId: string; titulo: string | null }>(
    `select t.tipo, t.referencia_id as "referenciaId", coalesce(c.title, s.query, p.titulo) as titulo
       from tarefas_ia t
       left join contracts c on t.tipo = 'auditoria' and c.id = t.referencia_id
       left join search_history s on t.tipo = 'pesquisa' and s.id = t.referencia_id
       left join recomendacoes_peca p on t.tipo = 'peca' and p.id = t.referencia_id
      where t.user_id = $1 and t.status in ('na_fila', 'processando') and t.tipo <> 'triagem'
      order by t.criada_em`,
    [viewer.id],
  );
  if (!rows.length) return null;
  const situacoes = await Promise.all(rows.map((r) => situacaoNaFila(r.tipo, r.referenciaId)));

  return (
    <Section title="Suas análises de IA">
      <AutoRefresh intervalMs={15_000} />
      <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
        {rows.map((r, i) => {
          const [rota, rotulo] = ROTA_E_ROTULO[r.tipo];
          const f = situacoes[i];
          return (
            <li key={r.referenciaId}>
              <Link href={`${rota}/${r.referenciaId}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.titulo ?? rotulo}</span>
                  <span className="block text-sm text-muted-foreground">{rotulo}</span>
                </span>
                <span className="text-sm sm:self-center sm:text-right">
                  {f.estado === "na_fila" ? (
                    <>
                      <span className="block font-medium text-tinta">
                        {f.aFrente === 0 ? "Próxima da fila" : `Na fila, ${f.aFrente} ${f.aFrente === 1 ? "pedido" : "pedidos"} na frente`}
                      </span>
                      <span className="block text-muted-foreground">termina em {tempoAproximado(f.fimEmSeg)}</span>
                    </>
                  ) : f.estado === "processando" ? (
                    <>
                      <span className="block font-medium text-tinta">Em andamento</span>
                      <span className="block text-muted-foreground">
                        {f.atrasada ? "levando mais que o normal" : `termina em ${tempoAproximado(f.fimEmSeg)}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Atualizando…</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

type Registro = { href: string; data: Date; tipo: string; titulo: string; situacao: React.ReactNode };

async function AtividadeRecente() {
  const viewer = await requireSubscriber();
  const [contratos, propostas, pesquisas, pecas] = await Promise.all([
    db
      .select()
      .from(contracts)
      .where(and(eq(contracts.userId, viewer.id), eq(contracts.kind, "analise")))
      .orderBy(desc(contracts.createdAt))
      .limit(6),
    db.select().from(pricingProposals).where(eq(pricingProposals.userId, viewer.id)).orderBy(desc(pricingProposals.createdAt)).limit(6),
    db.select().from(searchHistory).where(eq(searchHistory.userId, viewer.id)).orderBy(desc(searchHistory.createdAt)).limit(6),
    db
      .select({ id: recomendacoesPeca.id, titulo: recomendacoesPeca.titulo, status: recomendacoesPeca.status, createdAt: recomendacoesPeca.createdAt })
      .from(recomendacoesPeca)
      .where(eq(recomendacoesPeca.userId, viewer.id))
      .orderBy(desc(recomendacoesPeca.createdAt))
      .limit(6),
  ]);

  const registros: Registro[] = [
    ...contratos.map((c) => ({
      href: `/painel/contratos/${c.id}`,
      data: c.createdAt,
      tipo: "Auditoria",
      titulo: c.title,
      situacao: <SituacaoTarefa status={c.status} risco={c.riskScore} />,
    })),
    ...propostas.map((p) => ({
      href: `/painel/honorarios/${p.id}`,
      data: p.createdAt,
      tipo: "Proposta",
      titulo: p.clientName,
      situacao: p.proposedValueCents != null ? formatBRL(p.proposedValueCents, { semCentavos: true }) : FORMATOS[p.billingFormat],
    })),
    ...pesquisas.map((s) => ({
      href: `/painel/pesquisa/${s.id}`,
      data: s.createdAt,
      tipo: "Pesquisa",
      titulo: s.query,
      situacao: <SituacaoTarefa status={s.status} />,
    })),
    ...pecas.map((p) => ({
      href: `/painel/pecas/${p.id}`,
      data: p.createdAt,
      tipo: "Peça",
      titulo: p.titulo,
      situacao: <SituacaoTarefa status={p.status} />,
    })),
  ]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .slice(0, 10);

  if (registros.length === 0) {
    return <EmptyState title="Nada por aqui ainda">Comece por um dos atalhos acima.</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-folha">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="w-px px-4 py-2.5 font-medium whitespace-nowrap">Data</th>
            <th className="w-px px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Assunto</th>
            <th className="hidden w-px px-4 py-2.5 text-right font-medium sm:table-cell">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {registros.map((r) => (
            <tr key={r.href} className="hover:bg-muted/40">
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.data)}</td>
              <td className="px-4 py-3">{r.tipo}</td>
              <td className="max-w-0 px-4 py-3">
                <Link href={r.href} className="block truncate text-grafite hover:text-tinta hover:underline">
                  {r.titulo}
                </Link>
              </td>
              <td className="hidden px-4 py-3 text-right whitespace-nowrap sm:table-cell">{r.situacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PainelPage() {
  return (
    <div className="space-y-10">
      <Suspense fallback={<Skeleton className="h-9 w-72" />}>
        <Saudacao />
      </Suspense>

      <nav aria-label="Atalhos" className="grid overflow-hidden rounded-lg border border-border bg-folha sm:grid-cols-2 xl:grid-cols-4">
        {ATALHOS.map(({ href, icone: Icone, titulo, texto }, i) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex gap-4 p-5 transition-colors hover:bg-accent/60",
              i > 0 && "border-t border-border",
              "sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l xl:border-t-0 xl:[&:not(:first-child)]:border-l",
            )}
          >
            <Icone className="mt-0.5 size-5 shrink-0 text-tinta" aria-hidden />
            <span>
              <span className="block font-medium group-hover:text-tinta">{titulo}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{texto}</span>
            </span>
          </Link>
        ))}
      </nav>

      <Suspense fallback={null}>
        <AnalisesEmAndamento />
      </Suspense>

      <Suspense fallback={null}>
        <ProximosPrazos />
      </Suspense>

      <Section title="Uso neste mês">
        <Suspense fallback={<Skeleton className="h-20 w-full" />}>
          <UsoDoMes />
        </Suspense>
      </Section>

      <Section title="Atividade recente">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <AtividadeRecente />
        </Suspense>
      </Section>
    </div>
  );
}
