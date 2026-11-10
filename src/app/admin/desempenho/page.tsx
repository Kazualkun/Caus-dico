import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-parts";
import { BarrasHorizontais } from "@/components/admin/barras-horizontais";
import { ColunasDiarias } from "@/components/admin/colunas-diarias";
import { Celula, Indicador, LinhaDeIndicadores, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import {
  ativosPorPeriodo,
  assinaturasPorPlano,
  cadastrosPorPeriodo,
  clientesMaisAtivos,
  funil,
  indicadoresDesempenho,
  PERIODOS,
  periodoValido,
  receitaPorMes,
  usoPorModulo,
  type Periodo,
} from "@/lib/admin/desempenho";
import { formatBRL, formatDateTime, formatPercent } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Desempenho" };

type Busca = PageProps<"/admin/desempenho">["searchParams"];
const numero = new Intl.NumberFormat("pt-BR");
const NOME_PERIODO: Record<Periodo, string> = { 7: "7 dias", 30: "30 dias", 90: "90 dias", 365: "12 meses" };
const periodoDe = async (searchParams: Busca) => periodoValido((await searchParams).dias);

/** "+12% em relação aos 30 dias anteriores" (ou nada, sem base de comparação). */
function variacao(atual: number, anterior: number, dias: Periodo) {
  if (anterior === 0) return atual > 0 ? `sem base nos ${NOME_PERIODO[dias]} anteriores` : undefined;
  const pct = ((atual - anterior) / anterior) * 100;
  return `${pct >= 0 ? "+" : ""}${formatPercent(pct)} sobre os ${NOME_PERIODO[dias]} anteriores`;
}

async function SeletorPeriodo({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const dias = await periodoDe(searchParams);
  return (
    <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-lg border border-border bg-folha p-1 text-sm">
      {PERIODOS.map((p) => (
        <Link
          key={p}
          href={`/admin/desempenho?dias=${p}`}
          aria-current={p === dias ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 text-muted-foreground hover:text-grafite", p === dias && "bg-accent font-medium text-tinta")}
        >
          {NOME_PERIODO[p]}
        </Link>
      ))}
    </nav>
  );
}

async function Indicadores({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const dias = await periodoDe(searchParams);
  const i = await indicadoresDesempenho(dias);
  const conversao = i.clientes ? (i.assinantes / i.clientes) * 100 : 0;
  const churnBase = i.assinantes + i.cancelamentos;
  return (
    <div className="space-y-4">
      <LinhaDeIndicadores>
        <Indicador rotulo="Clientes cadastrados" valor={numero.format(i.clientes)} detalhe={`${formatPercent(conversao)} assinam hoje`} />
        <Indicador rotulo={`Novos em ${NOME_PERIODO[dias]}`} valor={numero.format(i.novos)} detalhe={variacao(i.novos, i.novosAnterior, dias)} />
        <Indicador
          rotulo={`Ativos em ${NOME_PERIODO[dias]}`}
          valor={numero.format(i.ativos)}
          detalhe={variacao(i.ativos, i.ativosAnterior, dias) ?? "Entraram ou usaram algum módulo"}
        />
        <Indicador
          rotulo="Assinantes ativos"
          valor={numero.format(i.assinantes)}
          detalhe={`${i.pendentes} aguardando pagamento, ${i.inadimplentes} em atraso`}
        />
        <Indicador
          rotulo={`Cancelamentos em ${NOME_PERIODO[dias]}`}
          valor={numero.format(i.cancelamentos)}
          detalhe={churnBase ? `${formatPercent((i.cancelamentos / churnBase) * 100)} da base (churn)` : undefined}
        />
      </LinhaDeIndicadores>
      <LinhaDeIndicadores>
        <Indicador rotulo="Receita recorrente mensal" valor={formatBRL(i.mrrCentavos, { semCentavos: true })} detalhe={`${formatBRL(i.mrrCentavos * 12, { semCentavos: true })} por ano`} />
        <Indicador
          rotulo={`Recebido em ${NOME_PERIODO[dias]}`}
          valor={formatBRL(i.receita, { semCentavos: true })}
          detalhe={variacao(i.receita, i.receitaAnterior, dias)}
        />
        <Indicador rotulo="Líquido (após taxas)" valor={formatBRL(i.receitaLiquida, { semCentavos: true })} detalhe="Valor que cai na conta" />
        <Indicador
          rotulo="Ticket médio"
          valor={i.pagamentos ? formatBRL(i.receita / i.pagamentos, { semCentavos: true }) : "—"}
          detalhe={`${numero.format(i.pagamentos)} ${i.pagamentos === 1 ? "pagamento" : "pagamentos"} no período`}
        />
        <Indicador rotulo="Estornado no período" valor={formatBRL(i.estornos, { semCentavos: true })} detalhe="Arrependimento e reembolsos" />
      </LinhaDeIndicadores>
    </div>
  );
}

async function Graficos({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const dias = await periodoDe(searchParams);
  const [cadastros, ativos, receita] = await Promise.all([cadastrosPorPeriodo(dias), ativosPorPeriodo(dias), receitaPorMes()]);
  const unidade = cadastros.mensal ? "por mês" : "por dia";
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-folha p-5">
          <ColunasDiarias dados={cadastros.dados} formato="inteiro" mensal={cadastros.mensal} rotulo={`Novos clientes ${unidade}`} />
        </div>
        <div className="rounded-lg border border-border bg-folha p-5">
          <ColunasDiarias dados={ativos.dados} formato="inteiro" mensal={ativos.mensal} rotulo={`Clientes ativos ${unidade}`} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-folha p-5">
        <ColunasDiarias dados={receita} formato="brl" mensal rotulo="Receita recebida por mês (R$), últimos 12 meses" />
      </div>
    </div>
  );
}

async function Composicao({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const dias = await periodoDe(searchParams);
  const [planos, uso, f] = await Promise.all([assinaturasPorPlano(), usoPorModulo(dias), funil(dias)]);
  const pct = (n: number) => (f.cadastros ? ` (${formatPercent((n / f.cadastros) * 100)})` : "");
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-folha p-5">
        <BarrasHorizontais
          rotulo="Receita recorrente por plano (R$/mês)"
          formato="brl"
          dados={planos.map((p) => ({
            nome: `${PLANS[p.plano].nome}, ${p.ciclo}`,
            valor: p.mrrCentavos / 100,
            detalhe: `${numero.format(p.ativas)} assinante${p.ativas === 1 ? "" : "s"}`,
          }))}
        />
      </div>
      <div className="rounded-lg border border-border bg-folha p-5">
        <BarrasHorizontais rotulo={`Uso dos módulos em ${NOME_PERIODO[dias]}`} formato="inteiro" dados={uso.map((u) => ({ nome: u.modulo, valor: u.total }))} />
      </div>
      <div className="rounded-lg border border-border bg-folha p-5">
        <p className="mb-3 text-sm font-medium">Funil de quem se cadastrou em {NOME_PERIODO[dias]}</p>
        <ol className="space-y-2 text-sm">
          <li className="flex justify-between gap-4">
            <span className="text-muted-foreground">Criaram conta</span>
            <span>{numero.format(f.cadastros)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted-foreground">Iniciaram uma assinatura</span>
            <span>
              {numero.format(f.iniciaram)}
              {pct(f.iniciaram)}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted-foreground">Pagaram</span>
            <span>
              {numero.format(f.pagaram)}
              {pct(f.pagaram)}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted-foreground">Seguem assinantes</span>
            <span>
              {numero.format(f.ativos)}
              {pct(f.ativos)}
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

async function MaisAtivos({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const dias = await periodoDe(searchParams);
  const lista = await clientesMaisAtivos(dias);
  return (
    <Tabela cabecalho={["Cliente", "Plano", "Propostas", "Auditorias", "Pesquisas", "Último acesso"]} vazio={lista.length === 0}>
      {lista.map((c) => (
        <tr key={c.id}>
          <Celula>
            <Link href={`/admin/usuarios/${c.id}`} className="hover:text-tinta hover:underline">
              {c.nome || c.email}
            </Link>
            <span className="block text-xs text-muted-foreground">{c.email}</span>
          </Celula>
          <Celula>{c.plano ? `${PLANS[c.plano].nome}${c.situacao && c.situacao !== "ativa" ? ` (${c.situacao})` : ""}` : "—"}</Celula>
          <Celula>{c.propostas}</Celula>
          <Celula>{c.auditorias}</Celula>
          <Celula>{c.pesquisas}</Celula>
          <Celula className="whitespace-nowrap text-muted-foreground">{c.ultimoAcesso ? formatDateTime(c.ultimoAcesso) : "—"}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

export default async function DesempenhoPage({ searchParams }: PageProps<"/admin/desempenho">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-8">
      <PageHeader
        title="Desempenho"
        description="Clientes, uso e receita. Clientes são as contas de usuário: a equipe fica de fora. A receita vem das cobranças confirmadas pelo Asaas."
        actions={
          <Suspense fallback={<Skeleton className="h-10 w-72" />}>
            <SeletorPeriodo searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <Indicadores searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Graficos searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Composicao searchParams={searchParams} />
      </Suspense>
      <Section title="Clientes mais ativos no período">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <MaisAtivos searchParams={searchParams} />
        </Suspense>
      </Section>
    </div>
  );
}
