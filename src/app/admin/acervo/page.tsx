import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, pool } from "@/db";
import { acervoSincronizacoes } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, AutoRefresh } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { espelhoExiste, pastaDoEspelho } from "@/lib/acervo/espelho";
import { ESFERA_NOME } from "@/lib/acervo/catalogo";
import type { Esfera } from "@/lib/acervo/parser";
import { formatDateTime } from "@/lib/format";
import { dispararEnriquecimento, dispararSincronizacao, dispararVerificacaoDou } from "./actions";

export const metadata: Metadata = { title: "Acervo" };
export const maxDuration = 300;

const numero = new Intl.NumberFormat("pt-BR");

async function Resumo() {
  await requirePapel("administrador");
  const [{ rows: esferas }, { rows: extra }] = await Promise.all([
    pool.query<{ esfera: Esfera; total: number }>(
      "select esfera, count(*)::int as total from normas where removida_em is null group by esfera order by total desc",
    ),
    pool.query<{ enriquecidas: number; federaisComUrn: number; pendentesDou: number; explicadas: number }>(`
      select (select count(*)::int from normas where enriquecida_em is not null) as enriquecidas,
             (select count(*)::int from normas where esfera = 'federal' and urn is not null and removida_em is null) as "federaisComUrn",
             (select count(*)::int from acervo_publicacoes where norma_id is null) as "pendentesDou",
             (select count(*)::int from normas where explicacao is not null) as explicadas`),
  ]);
  const e = extra[0];
  return (
    <LinhaDeIndicadores>
      {esferas.slice(0, 3).map((x) => (
        <Indicador key={x.esfera} rotulo={ESFERA_NOME[x.esfera]} valor={numero.format(x.total)} />
      ))}
      <Indicador rotulo="Enriquecidas (normas.leg.br)" valor={numero.format(e.enriquecidas)} detalhe={`de ${numero.format(e.federaisComUrn)} federais com URN`} />
      <Indicador rotulo="Publicações do DOU sem texto" valor={numero.format(e.pendentesDou)} detalhe={`${numero.format(e.explicadas)} normas já explicadas por IA`} />
    </LinhaDeIndicadores>
  );
}

async function Execucoes() {
  await requirePapel("administrador");
  const lista = await db.select().from(acervoSincronizacoes).orderBy(desc(acervoSincronizacoes.id)).limit(20);
  const emAndamento = lista.some((l) => l.status === "executando");
  const comErros = lista.find((l) => l.amostraErros.length > 0);
  return (
    <div className="space-y-4">
      {emAndamento && <AutoRefresh intervalMs={8000} />}
      <Tabela cabecalho={["Início", "Tipo", "Situação", "Processadas", "Novas", "Atualizadas", "Removidas", "Erros", "Observação"]} vazio={lista.length === 0}>
        {lista.map((l) => (
          <tr key={l.id}>
            <Celula className="whitespace-nowrap">{formatDateTime(l.iniciadaEm)}</Celula>
            <Celula>
              {l.tipo}
              <span className="block text-xs text-muted-foreground">{l.estrategia}, por {l.disparadaPor ?? "sistema"}</span>
            </Celula>
            <Celula>
              <SeloEstado estado={l.status === "executando" ? "andamento" : l.status === "erro" ? "erro" : l.mensagem ? "atencao" : "ok"}>
                {l.status === "executando" ? "Executando" : l.status === "erro" ? "Erro" : "Concluída"}
              </SeloEstado>
            </Celula>
            <Celula>{numero.format(l.processadas)}</Celula>
            <Celula>{numero.format(l.inseridas)}</Celula>
            <Celula>{numero.format(l.atualizadas)}</Celula>
            <Celula>{numero.format(l.removidas)}</Celula>
            <Celula className={l.erros ? "text-carimbo" : ""}>{numero.format(l.erros)}</Celula>
            <Celula className="max-w-xs text-muted-foreground">{l.mensagem ?? (l.commitAte ? `commit ${l.commitAte.slice(0, 10)}` : "—")}</Celula>
          </tr>
        ))}
      </Tabela>
      {comErros && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Arquivos com erro na execução de {formatDateTime(comErros.iniciadaEm)}</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {comErros.amostraErros.map((e) => (
              <li key={e.caminho}>
                {e.caminho}: {e.erro}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

async function Acoes() {
  await requirePapel("administrador");
  const local = espelhoExiste();
  return (
    <div className="space-y-3 rounded-lg border border-border bg-folha p-5 text-sm">
      <div className="flex flex-wrap gap-2">
        <ActionButton action={dispararSincronizacao} disabled={!local}>
          Sincronizar com o repositório
        </ActionButton>
        <ActionButton variant="outline" action={dispararVerificacaoDou}>
          Verificar o Diário Oficial (7 dias)
        </ActionButton>
        <ActionButton variant="outline" action={dispararEnriquecimento}>
          Enriquecer 200 normas federais
        </ActionButton>
        <Button asChild variant="outline">
          <Link href="/admin/acervo/curadoria">Incluir, corrigir ou conferir normas</Link>
        </Button>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Sincronizar: baixa do{" "}
          <a href="https://github.com/ctresb/leis" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            ctresb/leis
          </a>{" "}
          só o que mudou desde a última vez e marca o que saiu.{" "}
          {local ? `Espelho local em ${pastaDoEspelho()}.` : "Este servidor não tem o espelho: rode no worker agendado (ver README)."}
        </li>
        <li>Diário Oficial: registra leis, MPs, emendas e decretos federais publicados que ainda não chegaram ao acervo.</li>
        <li>Enriquecer: busca no normas.leg.br o nome popular e a indexação oficial de cada norma federal (2 por segundo).</li>
        <li>Curadoria: inclusão de normas que ainda não chegaram ao repositório, correções e conferência com a fonte oficial, sempre com aprovação de um segundo revisor.</li>
      </ul>
    </div>
  );
}

export default async function AcervoAdminPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-10">
      <PageHeader title="Acervo" description="Carga e atualização da legislação a partir das fontes oficiais." />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Resumo />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <Acoes />
      </Suspense>
      <Section title="Execuções">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Execucoes />
        </Suspense>
      </Section>
    </div>
  );
}
