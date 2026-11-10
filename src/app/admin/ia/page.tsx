import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { pool } from "@/db";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Indicador, LinhaDeIndicadores, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { usoIaPorRecurso } from "@/lib/admin/consultas";
import { MODEL } from "@/lib/ai/ollama";
import { MAX_TAREFAS_POR_USUARIO, panoramaDaFila, type TipoTarefa } from "@/lib/ai/fila";
import { formatDateTime } from "@/lib/format";
import { reprocessarTarefa } from "./actions";

export const metadata: Metadata = { title: "Tarefas e uso de IA" };
export const maxDuration = 300;

const numero = new Intl.NumberFormat("pt-BR");

const ROTULO_TIPO = { auditoria: "Auditoria", pesquisa: "Pesquisa", peca: "Peça", triagem: "Triagem" } as const;

/** "3 min", "1 h 20 min": tempo de espera ou de processamento. */
function duracao(seg: number | null) {
  if (seg === null) return "—";
  if (seg < 60) return `${Math.round(seg)} s`;
  const min = Math.round(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

async function FilaAgora() {
  await requirePapel("suporte");
  const f = await panoramaDaFila();
  return (
    <div className="space-y-2">
      <LinhaDeIndicadores>
        <Indicador rotulo="Na fila" valor={numero.format(f.naFila)} detalhe={`de ${numero.format(f.usuariosNaFila)} usuário(s)`} />
        <Indicador rotulo="Em andamento" valor={`${f.processando} de ${f.vagas}`} detalhe="vagas da fila (IA_PARALELO menos a reserva da análise do caso)" />
        <Indicador rotulo="Concluídas na última hora" valor={numero.format(f.concluidasHora)} detalhe={`${numero.format(f.errosHora)} com erro`} />
        <Indicador rotulo="Espera média (1 h)" valor={duracao(f.esperaMediaSeg)} detalhe="do pedido ao início" />
        <Indicador rotulo="Mais antiga na fila" valor={duracao(f.esperaMaximaSeg)} />
      </LinhaDeIndicadores>
      <p className="text-xs text-muted-foreground">
        Quem tem menos tarefas rodando passa na frente, e cada pessoa tem no máximo {MAX_TAREFAS_POR_USUARIO} tarefas ao mesmo tempo. A triagem
        pública vai depois das demais. Fila longa com espera alta é sinal de que falta GPU.
      </p>
    </div>
  );
}

async function Tarefas() {
  await requirePapel("suporte");
  const { rows } = await pool.query<{
    tipo: TipoTarefa; referenciaId: string; status: string; erro: string | null; email: string | null; userId: string | null;
    criadaEm: Date; esperaSeg: number | null; duracaoSeg: number | null; itemErro: boolean;
  }>(`
    select t.tipo, t.referencia_id as "referenciaId", t.status, t.erro, u.email, t.user_id as "userId", t.criada_em as "criadaEm",
           extract(epoch from coalesce(t.iniciada_em, now()) - t.criada_em)::float as "esperaSeg",
           extract(epoch from coalesce(t.concluida_em, now()) - t.iniciada_em)::float as "duracaoSeg",
           coalesce(c.status, s.status, p.status, g.status)::text = 'erro' as "itemErro"
      from tarefas_ia t
      left join users u on u.id = t.user_id
      left join contracts c on t.tipo = 'auditoria' and c.id = t.referencia_id
      left join search_history s on t.tipo = 'pesquisa' and s.id = t.referencia_id
      left join recomendacoes_peca p on t.tipo = 'peca' and p.id = t.referencia_id
      left join triagens g on t.tipo = 'triagem' and g.id = t.referencia_id
     where t.status in ('na_fila', 'processando')
        or (t.status = 'erro' and t.concluida_em > now() - interval '7 days')
     order by (t.status = 'processando') desc, (t.status = 'na_fila') desc, t.criada_em
     limit 100
  `);

  return (
    <Tabela cabecalho={["Pedida em", "Tipo", "Usuário", "Situação", "Espera", "Duração", "Detalhe", ""]} vazio={rows.length === 0}>
      {rows.map((t) => (
        <tr key={`${t.tipo}-${t.referenciaId}-${t.criadaEm.getTime()}`}>
          <Celula className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.criadaEm)}</Celula>
          <Celula>{ROTULO_TIPO[t.tipo]}</Celula>
          <Celula>
            {t.userId ? (
              <Link href={`/admin/usuarios/${t.userId}`} className="hover:text-tinta hover:underline">
                {t.email}
              </Link>
            ) : (
              "conta excluída"
            )}
          </Celula>
          <Celula>
            <SeloEstado estado={t.status === "erro" ? "erro" : t.status === "processando" ? "andamento" : "atencao"}>
              {t.status === "erro" ? "Erro" : t.status === "processando" ? "Em andamento" : "Na fila"}
            </SeloEstado>
          </Celula>
          <Celula className="whitespace-nowrap">{duracao(t.esperaSeg)}</Celula>
          <Celula className="whitespace-nowrap">{t.status === "na_fila" ? "—" : duracao(t.duracaoSeg)}</Celula>
          <Celula className="max-w-sm text-muted-foreground">{t.erro ?? "—"}</Celula>
          <Celula>
            {t.status === "erro" && t.itemErro && (
              <ActionButton size="sm" variant="outline" action={reprocessarTarefa.bind(null, t.tipo, t.referenciaId)} pendingText="…">
                Reprocessar
              </ActionButton>
            )}
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

async function Uso() {
  await requirePapel("suporte");
  const linhas = await usoIaPorRecurso();
  const total = linhas.reduce((s, l) => s + l.minutos, 0);
  return (
    <div className="space-y-2">
      <Tabela
        cabecalho={["Recurso", "Modelo", "Chamadas", "Erros", "Tokens de entrada", "Tokens de saída", "Duração média", "Tempo total"]}
        vazio={linhas.length === 0}
      >
        {linhas.map((l) => (
          <tr key={`${l.recurso}-${l.modelo}`}>
            <Celula className="font-medium">{l.recurso}</Celula>
            <Celula className="font-mono text-xs">{l.modelo}</Celula>
            <Celula>{numero.format(l.chamadas)}</Celula>
            <Celula className={l.erros ? "text-carimbo" : ""}>{numero.format(l.erros)}</Celula>
            <Celula>{numero.format(l.entrada)}</Celula>
            <Celula>{numero.format(l.saida)}</Celula>
            <Celula>{(l.duracaoMedia / 1000).toFixed(1)} s</Celula>
            <Celula>{l.minutos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min</Celula>
          </tr>
        ))}
      </Tabela>
      <p className="text-xs text-muted-foreground">
        Últimos 30 dias. Modelo configurado: {MODEL}, rodando localmente (sem custo por token). Tempo total de processamento:{" "}
        {total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min.
      </p>
    </div>
  );
}

export default async function IaPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("suporte");
  return (
    <div className="space-y-10">
      <PageHeader title="Tarefas e uso de IA" description="A fila de IA agora, as tarefas em andamento ou com erro e o uso do modelo local." />
      <Section title="Fila agora">
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <FilaAgora />
        </Suspense>
      </Section>
      <Section title="Tarefas na fila, em andamento ou com erro (7 dias)">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <Tarefas />
        </Suspense>
      </Section>
      <Section title="Uso por recurso">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <Uso />
        </Suspense>
      </Section>
    </div>
  );
}
