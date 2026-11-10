import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela, type Estado } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import {
  divergencias,
  evolucaoMensal,
  FORMAS,
  hojeEmBrasilia,
  mesValido,
  pagamentosDoMes,
  porFormaDePagamento,
  resumoDoMes,
} from "@/lib/admin/faturamento";
import { formatBRL, formatDateTime } from "@/lib/format";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Faturamento" };

type Busca = PageProps<"/admin/faturamento">["searchParams"];
const numero = new Intl.NumberFormat("pt-BR");
const SITUACAO: Record<string, { nome: string; estado: Estado }> = {
  pendente: { nome: "A receber", estado: "andamento" },
  vencido: { nome: "Vencida", estado: "erro" },
  confirmado: { nome: "Confirmada", estado: "ok" },
  recebido: { nome: "Recebida", estado: "ok" },
  cancelado: { nome: "Cancelada", estado: "atencao" },
  estornado: { nome: "Estornada", estado: "atencao" },
  contestado: { nome: "Contestada", estado: "erro" },
};
const nomeDoMes = (mes: string) => {
  const nome = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};
const plural = (n: number, um: string, varios: string) => `${numero.format(n)} ${n === 1 ? um : varios}`;

async function mesDe(searchParams: Busca) {
  return mesValido((await searchParams).mes, await hojeEmBrasilia());
}

async function Cabecalho({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const mes = await mesDe(searchParams);
  const [ano, m] = mes.split("-").map(Number);
  const anterior = m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;
  const proximo = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  const ehAtual = mes === (await hojeEmBrasilia()).slice(0, 7);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Mês" className="flex items-center gap-1 rounded-lg border border-border bg-folha p-1 text-sm">
        <Link href={`/admin/faturamento?mes=${anterior}`} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-grafite">
          ← Anterior
        </Link>
        <span className="px-2 font-medium">{nomeDoMes(mes)}</span>
        {!ehAtual && (
          <Link href={`/admin/faturamento?mes=${proximo}`} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-grafite">
            Próximo →
          </Link>
        )}
      </nav>
      <Button asChild variant="outline">
        <a href={`/admin/faturamento/csv?mes=${mes}`} download>
          <DownloadIcon aria-hidden />
          Baixar CSV do mês
        </a>
      </Button>
    </div>
  );
}

async function Resumo({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const mes = await mesDe(searchParams);
  const [r, formas] = await Promise.all([resumoDoMes(mes), porFormaDePagamento(mes)]);
  return (
    <div className="space-y-4">
      <LinhaDeIndicadores>
        <Indicador rotulo="Recebido (bruto)" valor={formatBRL(r.bruto)} detalhe={plural(r.qtd, "pagamento", "pagamentos")} />
        <Indicador rotulo="Líquido" valor={formatBRL(r.liquido)} detalhe={`Taxas do gateway: ${formatBRL(r.bruto - r.liquido)}`} />
        <Indicador rotulo="Estornado" valor={formatBRL(r.estornado)} detalhe={plural(r.qtdEstornos, "estorno", "estornos")} />
        <Indicador rotulo="A receber" valor={formatBRL(r.aReceber)} detalhe={`${plural(r.qtdAReceber, "cobrança", "cobranças")} com vencimento no mês`} />
        <Indicador rotulo="Vencido" valor={formatBRL(r.vencido)} detalhe={`${plural(r.qtdVencidas, "cobrança", "cobranças")} em atraso`} />
      </LinhaDeIndicadores>
      {formas.length > 0 && (
        <Tabela cabecalho={["Forma de pagamento", "Pagamentos", "Bruto", "Líquido"]}>
          {formas.map((f) => (
            <tr key={f.forma}>
              <Celula>{FORMAS[f.forma] ?? f.forma}</Celula>
              <Celula>{numero.format(f.qtd)}</Celula>
              <Celula>{formatBRL(f.bruto)}</Celula>
              <Celula>{formatBRL(f.liquido)}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}

async function Pagamentos({ searchParams }: { searchParams: Busca }) {
  await requirePapel("administrador");
  const lista = await pagamentosDoMes(await mesDe(searchParams));
  return (
    <Tabela cabecalho={["Data", "Assinante", "Plano", "Forma", "Valor", "Líquido", "Situação", "Fatura"]} vazio={lista.length === 0}>
      {lista.map((p) => {
        const s = SITUACAO[p.status] ?? { nome: p.status, estado: "atencao" as const };
        const data = p.estornadoEm ?? p.pagoEm;
        return (
          <tr key={p.id}>
            <Celula className="whitespace-nowrap">
              {data ? formatDateTime(data) : p.vencimento ? `vence ${new Date(`${p.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}` : "—"}
            </Celula>
            <Celula>
              {p.userId ? (
                <Link href={`/admin/usuarios/${p.userId}`} className="hover:text-tinta hover:underline">
                  {p.email}
                </Link>
              ) : (
                <span className="text-muted-foreground">conta excluída</span>
              )}
            </Celula>
            <Celula>{p.plano ? `${PLANS[p.plano].nome}, ${p.ciclo}` : "—"}</Celula>
            <Celula>{FORMAS[p.forma ?? "UNDEFINED"] ?? p.forma}</Celula>
            <Celula>{formatBRL(p.valorCents)}</Celula>
            <Celula>{p.valorLiquidoCents !== null ? formatBRL(p.valorLiquidoCents) : "—"}</Celula>
            <Celula>
              <SeloEstado estado={s.estado}>{s.nome}</SeloEstado>
            </Celula>
            <Celula>
              {p.faturaUrl ? (
                <a href={p.faturaUrl} target="_blank" rel="noreferrer" className="text-tinta underline underline-offset-2">
                  Abrir
                </a>
              ) : (
                "—"
              )}
            </Celula>
          </tr>
        );
      })}
    </Tabela>
  );
}

async function Evolucao() {
  await requirePapel("administrador");
  const meses = await evolucaoMensal();
  return (
    <Tabela cabecalho={["Mês", "Pagamentos", "Bruto", "Líquido", "Estornado"]}>
      {meses.map((m) => (
        <tr key={m.mes}>
          <Celula>
            <Link href={`/admin/faturamento?mes=${m.mes}`} className="hover:text-tinta hover:underline">
              {nomeDoMes(m.mes)}
            </Link>
          </Celula>
          <Celula>{numero.format(m.qtd)}</Celula>
          <Celula>{formatBRL(m.bruto)}</Celula>
          <Celula>{formatBRL(m.liquido)}</Celula>
          <Celula>{formatBRL(m.estornado)}</Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Conferencia() {
  await requirePapel("administrador");
  const d = await divergencias();
  if (d.semPagamento.length === 0 && d.reembolsoPendente.length === 0) {
    return <SeloEstado estado="ok">Assinaturas e cobranças batem: nenhuma divergência encontrada.</SeloEstado>;
  }
  return (
    <div className="space-y-4">
      {d.semPagamento.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Assinaturas ativas sem pagamento registrado no ciclo atual. Confira no Asaas se o webhook chegou ou se o acesso foi liberado
            manualmente.
          </p>
          <Tabela cabecalho={["Assinante", "Plano", "Origem", "Desde"]}>
            {d.semPagamento.map((s) => (
              <tr key={s.id}>
                <Celula>
                  {s.userId ? (
                    <Link href={`/admin/usuarios/${s.userId}`} className="hover:text-tinta hover:underline">
                      {s.email}
                    </Link>
                  ) : (
                    "conta excluída"
                  )}
                </Celula>
                <Celula>
                  {PLANS[s.plano].nome}, {s.ciclo}
                </Celula>
                <Celula>{s.provider === "asaas" ? "Asaas" : `${s.provider} (sem gateway)`}</Celula>
                <Celula className="whitespace-nowrap">{formatDateTime(s.desde)}</Celula>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
      {d.reembolsoPendente.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Reembolsos pedidos ao Asaas cujo estorno ainda não foi confirmado.</p>
          <Tabela cabecalho={["Assinante", "Valor", "Pago em", "Cancelada em"]}>
            {d.reembolsoPendente.map((p) => (
              <tr key={p.id}>
                <Celula>{p.email ?? "conta excluída"}</Celula>
                <Celula>{formatBRL(p.valorCents)}</Celula>
                <Celula className="whitespace-nowrap">{formatDateTime(p.pagoEm)}</Celula>
                <Celula className="whitespace-nowrap">{formatDateTime(p.canceladaEm)}</Celula>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
    </div>
  );
}

export default async function FaturamentoPage({ searchParams }: PageProps<"/admin/faturamento">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-10">
      <PageHeader
        title="Faturamento"
        description="Cobranças do Asaas registradas pelo webhook: recebido, líquido, estornos e o que falta receber."
        actions={
          <Suspense fallback={<Skeleton className="h-10 w-80" />}>
            <Cabecalho searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Resumo searchParams={searchParams} />
      </Suspense>
      <Section title="Conferência entre assinaturas e cobranças">
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <Conferencia />
        </Suspense>
      </Section>
      <Section title="Cobranças do mês">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Pagamentos searchParams={searchParams} />
        </Suspense>
      </Section>
      <Section title="Últimos 12 meses">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Evolucao />
        </Suspense>
      </Section>
    </div>
  );
}
