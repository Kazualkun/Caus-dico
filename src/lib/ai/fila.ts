import "server-only";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db, pool, type Db } from "@/db";
import { contracts, recomendacoesPeca, searchHistory, tarefasIa, triagens } from "@/db/schema";
import { processarContrato, processarPeca, processarPesquisa, processarTriagem } from "@/lib/jobs";
import { contarUso, mensagemDeLimite, RECURSO_DA_TAREFA } from "@/lib/usage";
import { PLANS, type PlanId } from "@/lib/plans";

/*
 * Fila das tarefas de IA em segundo plano (auditoria, pesquisa, peça, triagem),
 * guardada no banco (tabela tarefas_ia):
 *
 * - Vagas: IA_PARALELO chamadas ao mesmo tempo neste processo (padrão 1), igual
 *   ao paralelismo do servidor de IA. Com 8 vagas ou mais, 1/8 fica reservado para
 *   quem espera na tela (análise do caso), e a fila usa o resto.
 * - Justiça: entre as tarefas na fila, passa primeiro a de quem tem menos tarefas
 *   rodando; quem pede muitas de uma vez não segura a fila dos outros. A triagem
 *   pública (ninguém esperando na tela) vai depois das demais.
 * - Limite por pessoa: até IA_MAX_POR_USUARIO tarefas na fila ou em andamento.
 * - Cota do plano: conferida na mesma transação que cria a tarefa, sob uma trava
 *   por usuário, então pedidos simultâneos não passam do limite.
 * - Reinício: a tarefa que estava em andamento num processo que parou volta para
 *   a fila quando o sinal de vida (batimento) para de chegar.
 *
 * IA_FILA=false desliga a execução neste processo (por exemplo, quando um
 * processo separado cuida da fila); os pedidos continuam sendo aceitos.
 */

export type TipoTarefa = (typeof tarefasIa.$inferSelect)["tipo"];
export type Transacao = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const VAGAS_IA = Math.max(1, Number(process.env.IA_PARALELO ?? 1) || 1);
/** Tarefas da fila ao mesmo tempo: as vagas menos a reserva das chamadas interativas. */
export const VAGAS_FILA = VAGAS_IA - Math.floor(VAGAS_IA / 8);
export const MAX_TAREFAS_POR_USUARIO = Math.max(1, Number(process.env.IA_MAX_POR_USUARIO ?? 3) || 3);
const BATIMENTO_MS = 20_000;
/** Sem batimento por este tempo, a tarefa é considerada abandonada. */
const ABANDONO_SEGUNDOS = 120;
const MAX_TENTATIVAS = 3;
const VARREDURA_MS = 5_000;

/** Duração típica de cada tarefa (segundos), usada na previsão enquanto não há histórico. */
const DURACAO_PADRAO: Record<TipoTarefa, number> = { auditoria: 420, pesquisa: 150, peca: 150, triagem: 30 };

const PROCESSADORES: Record<TipoTarefa, (id: string) => Promise<"concluido" | "erro" | "ausente">> = {
  auditoria: processarContrato,
  pesquisa: processarPesquisa,
  peca: processarPeca,
  triagem: processarTriagem,
};

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/**
 * Cria o item (callback `criar`, que devolve o id) e a tarefa na mesma transação.
 * Com `plano`, aplica o limite de tarefas simultâneas e a cota mensal do plano.
 */
export async function enfileirar(pedido: {
  userId: string;
  tipo: TipoTarefa;
  plano?: PlanId;
  criar: (tx: Transacao) => Promise<string>;
}): Promise<{ referenciaId: string } | { error: string }> {
  const resultado = await db.transaction(async (tx) => {
    if (pedido.plano) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ia:${pedido.userId}`}))`);

      const [{ ativas }] = await tx
        .select({ ativas: count() })
        .from(tarefasIa)
        .where(and(eq(tarefasIa.userId, pedido.userId), inArray(tarefasIa.status, ["na_fila", "processando"]), ne(tarefasIa.tipo, "triagem")));
      if (ativas >= MAX_TAREFAS_POR_USUARIO) {
        return {
          error: `Você já tem ${ativas} análises de IA na fila ou em andamento. Aguarde uma terminar para pedir outra: assim a fila anda para todos.`,
        };
      }

      const recurso = RECURSO_DA_TAREFA[pedido.tipo];
      if (recurso) {
        const usado = (await contarUso(tx, pedido.userId))[recurso];
        if (usado >= PLANS[pedido.plano].limites[recurso]) return { error: mensagemDeLimite(pedido.plano, recurso, usado) };
      }
    }

    const referenciaId = await pedido.criar(tx);
    await tx.insert(tarefasIa).values({
      userId: pedido.userId,
      tipo: pedido.tipo,
      referenciaId,
      prioridade: pedido.tipo === "triagem" ? 1 : 0,
    });
    return { referenciaId };
  });

  if ("referenciaId" in resultado) acordarFila();
  return resultado;
}

/** O usuário apagou o item: a tarefa que ainda não começou sai da fila e não conta na cota. */
export async function cancelarTarefa(tipo: TipoTarefa, referenciaId: string) {
  await db
    .update(tarefasIa)
    .set({ status: "cancelada", concluidaEm: new Date() })
    .where(and(eq(tarefasIa.tipo, tipo), eq(tarefasIa.referenciaId, referenciaId), eq(tarefasIa.status, "na_fila")));
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

type Tarefa = { id: number; tipo: TipoTarefa; referenciaId: string };
type EstadoFila = { ativas: number; buscando: boolean; deNovo: boolean };

// Em globalThis: sobrevive ao recarregamento de módulos no desenvolvimento.
const global = globalThis as unknown as { filaIa?: EstadoFila };

/** Liga a execução da fila neste processo (src/instrumentation.ts). */
export function iniciarFila() {
  if (global.filaIa || process.env.IA_FILA === "false") return;
  global.filaIa = { ativas: 0, buscando: false, deNovo: false };
  const varrer = () => void recuperarAbandonadas().finally(acordarFila);
  varrer();
  setInterval(varrer, VARREDURA_MS).unref();
}

/** Ocupa as vagas livres com as próximas tarefas da fila. */
export function acordarFila() {
  const f = global.filaIa;
  if (!f) return;
  if (f.buscando) {
    f.deNovo = true;
    return;
  }
  f.buscando = true;
  void (async () => {
    try {
      while (f.ativas < VAGAS_FILA) {
        const tarefa = await reivindicar();
        if (!tarefa) break;
        f.ativas++;
        void executar(tarefa).finally(() => {
          f.ativas--;
          acordarFila();
        });
      }
    } catch (e) {
      console.error("[fila] falha ao buscar tarefas", e);
    } finally {
      f.buscando = false;
      if (f.deNovo) {
        f.deNovo = false;
        acordarFila();
      }
    }
  })();
}

async function reivindicar(): Promise<Tarefa | null> {
  const { rows } = await pool.query<Tarefa>(
    `update tarefas_ia set status = 'processando', iniciada_em = now(), batimento_em = now(), tentativas = tentativas + 1
      where id = (
        select t.id from tarefas_ia t
         where t.status = 'na_fila'
         order by t.prioridade,
                  (select count(*) from tarefas_ia r where r.user_id = t.user_id and r.status = 'processando'),
                  t.criada_em
         limit 1
         for update skip locked)
      returning id, tipo, referencia_id as "referenciaId"`,
  );
  return rows[0] ?? null;
}

async function executar(t: Tarefa) {
  const batimento = setInterval(() => {
    void db
      .update(tarefasIa)
      .set({ batimentoEm: new Date() })
      .where(eq(tarefasIa.id, t.id))
      .catch((e) => console.error("[fila] falha no batimento", t.id, e));
  }, BATIMENTO_MS);
  let fim: "concluida" | "erro" | "cancelada" = "erro";
  let erro: string | null = null;
  try {
    const r = await PROCESSADORES[t.tipo](t.referenciaId);
    fim = r === "concluido" ? "concluida" : r === "ausente" ? "cancelada" : "erro";
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
    console.error("[fila] falha na tarefa", t.id, t.tipo, e);
  } finally {
    clearInterval(batimento);
  }
  await db
    .update(tarefasIa)
    .set({ status: fim, erro, concluidaEm: new Date() })
    .where(eq(tarefasIa.id, t.id))
    .catch((e) => console.error("[fila] falha ao encerrar a tarefa", t.id, e));
}

const TABELA_DO_TIPO = { auditoria: contracts, pesquisa: searchHistory, peca: recomendacoesPeca, triagem: triagens } as const;

/** Tarefas de um processo que parou (reinício, queda) voltam para a fila; depois de 3 tentativas, viram erro. */
async function recuperarAbandonadas() {
  try {
    const { rows } = await pool.query<{ tipo: TipoTarefa; referenciaId: string; status: string }>(
      `update tarefas_ia
          set status = case when tentativas >= $1 then 'erro' else 'na_fila' end,
              erro = case when tentativas >= $1 then 'interrompida repetidas vezes' else erro end,
              concluida_em = case when tentativas >= $1 then now() else null end
        where status = 'processando' and batimento_em < now() - make_interval(secs => $2)
        returning tipo, referencia_id as "referenciaId", status`,
      [MAX_TENTATIVAS, ABANDONO_SEGUNDOS],
    );
    for (const r of rows) {
      if (r.status !== "erro") continue;
      const tabela = TABELA_DO_TIPO[r.tipo];
      await db
        .update(tabela)
        .set({ status: "erro", error: "A análise foi interrompida. Tente novamente; ela não conta no seu limite." })
        .where(eq(tabela.id, r.referenciaId));
    }
    if (rows.length) console.warn(`[fila] ${rows.length} tarefa(s) abandonada(s) recuperada(s)`);
  } catch (e) {
    console.error("[fila] falha ao recuperar tarefas", e);
  }
}

// ---------------------------------------------------------------------------
// Situação para a tela
// ---------------------------------------------------------------------------

export type SituacaoFila =
  | { estado: "na_fila"; aFrente: number; inicioEmSeg: number; fimEmSeg: number }
  /** `atrasada`: já passou da duração média desse tipo de tarefa. */
  | { estado: "processando"; fimEmSeg: number; atrasada: boolean }
  /** Não há tarefa ativa para o item: terminou, falhou ou se perdeu. */
  | { estado: "inativa" };

/**
 * Posição na fila e previsão. A posição conta as tarefas que entraram antes com a
 * mesma prioridade ou maior; a ordem por usuário pode adiantar a vez de alguém.
 */
export async function situacaoNaFila(tipo: TipoTarefa, referenciaId: string): Promise<SituacaoFila> {
  const { rows } = await pool.query<{
    status: string;
    decorridoSeg: number;
    aFrente: number;
    processando: number;
    mediaTipo: number | null;
    mediaGeral: number | null;
  }>(
    `with alvo as (
       select status, prioridade, criada_em, iniciada_em from tarefas_ia
        where tipo = $1 and referencia_id = $2 and status in ('na_fila', 'processando')
        order by id desc limit 1
     ), recentes as (
       select tipo, extract(epoch from concluida_em - iniciada_em) as seg from tarefas_ia
        where status = 'concluida' and iniciada_em is not null and concluida_em > now() - interval '7 days'
        order by concluida_em desc limit 200
     )
     select a.status,
            coalesce(extract(epoch from now() - a.iniciada_em), 0)::float as "decorridoSeg",
            (select count(*)::int from tarefas_ia t
              where t.status = 'na_fila' and (t.prioridade < a.prioridade or (t.prioridade = a.prioridade and t.criada_em < a.criada_em))) as "aFrente",
            (select count(*)::int from tarefas_ia t where t.status = 'processando') as processando,
            (select avg(seg)::float from recentes where tipo = $1) as "mediaTipo",
            (select avg(seg)::float from recentes) as "mediaGeral"
       from alvo a`,
    [tipo, referenciaId],
  );
  const r = rows[0];
  if (!r) return { estado: "inativa" };
  const mediaTipo = r.mediaTipo ?? DURACAO_PADRAO[tipo];
  if (r.status === "processando") {
    return { estado: "processando", fimEmSeg: Math.max(15, mediaTipo - r.decorridoSeg), atrasada: r.decorridoSeg > mediaTipo * 1.15 };
  }
  const media = r.mediaGeral ?? mediaTipo;
  // As tarefas em andamento estão, em média, na metade; as da frente ocupam as vagas em rodízio.
  const inicioEmSeg = (r.processando * (media / 2) + r.aFrente * media) / VAGAS_FILA;
  return { estado: "na_fila", aFrente: r.aFrente, inicioEmSeg, fimEmSeg: inicioEmSeg + mediaTipo };
}

/** Painel da administração: fila agora e vazão recente. */
export async function panoramaDaFila() {
  const { rows } = await pool.query<{
    naFila: number;
    processando: number;
    concluidasHora: number;
    errosHora: number;
    esperaMediaSeg: number | null;
    esperaMaximaSeg: number | null;
    usuariosNaFila: number;
  }>(
    `select count(*) filter (where status = 'na_fila')::int as "naFila",
            count(*) filter (where status = 'processando')::int as processando,
            count(*) filter (where status = 'concluida' and concluida_em > now() - interval '1 hour')::int as "concluidasHora",
            count(*) filter (where status = 'erro' and concluida_em > now() - interval '1 hour')::int as "errosHora",
            avg(extract(epoch from iniciada_em - criada_em)) filter (where iniciada_em > now() - interval '1 hour')::float as "esperaMediaSeg",
            max(extract(epoch from now() - criada_em)) filter (where status = 'na_fila')::float as "esperaMaximaSeg",
            count(distinct user_id) filter (where status = 'na_fila')::int as "usuariosNaFila"
       from tarefas_ia
      where status in ('na_fila', 'processando') or concluida_em > now() - interval '1 hour' or iniciada_em > now() - interval '1 hour'`,
  );
  return { ...rows[0], vagas: VAGAS_FILA };
}
