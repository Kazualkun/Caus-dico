/**
 * Simulação da fila de IA para cada perfil de servidor (scripts/carga/perfis.mts),
 * com as mesmas regras do Causídico: IA_PARALELO vagas (1/8 reservado para a análise
 * do caso a partir de 8 vagas), tarefas em segundo plano
 * uma chamada por vez, análise do caso com prioridade e desistência depois de
 * IA_ESPERA_MAXIMA_S (180 s), e a geração dividida entre as tarefas na placa.
 *
 *   npx tsx scripts/carga/simular-fila.mts                 todos os perfis, 100 advogados
 *   npx tsx scripts/carga/simular-fila.mts --usuarios 300 --saida simulacao.json
 */
import { writeFileSync } from "node:fs";
import { CHAMADAS, PERFIS, TAREFAS, velocidadePorTarefa, type PerfilGpu, type TipoChamada, type TipoTarefaCarga } from "./perfis.mjs";

const arg = (nome: string, padrao: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const USUARIOS = Number(arg("usuarios", "100"));
const RAMPA_S = Number(arg("rampa", "60"));
const ESPERA_MAXIMA_S = 180;
const MISTURA: [TipoTarefaCarga, number][] = [
  ["analise_caso", 0.35],
  ["pesquisa", 0.25],
  ["peca", 0.2],
  ["auditoria", 0.2],
];

/** Gerador pseudoaleatório fixo: a mesma semente dá o mesmo resultado em todos os perfis. */
function aleatorio(semente: number) {
  return () => {
    semente = (semente * 1664525 + 1013904223) % 4294967296;
    return semente / 4294967296;
  };
}

type Chamada = { tipo: TipoChamada; ler: number; gerar: number; interativa: boolean; pedidaEm: number; tarefa: TarefaSim };
type TarefaSim = { tipo: TipoTarefaCarga; chegada: number; fila: TipoChamada[]; fim?: number; desistiu?: boolean; inicio?: number };

function sortearTarefas(n: number, rnd: () => number): TarefaSim[] {
  return Array.from({ length: n }, (_, i) => {
    let x = rnd();
    let tipo: TipoTarefaCarga = "pesquisa";
    for (const [t, p] of MISTURA) if ((x -= p) <= 0) {
      tipo = t;
      break;
    }
    // Cada advogado navega de 10 a 25 s antes de pedir.
    return { tipo, chegada: (RAMPA_S * i) / n + 10 + rnd() * 15, fila: [...TAREFAS[tipo]] };
  });
}

function simular(p: PerfilGpu, tarefas: TarefaSim[], rnd: () => number, desistencia = true) {
  const dt = 0.1;
  let t = 0;
  const ativas: Chamada[] = [];
  const esperando: Chamada[] = [];
  const fundoNaFila: TarefaSim[] = [];
  let fundoEmAndamento = 0;
  const pendentes = [...tarefas].sort((a, b) => a.chegada - b.chegada);
  let ocupadoGpu = 0;
  const sortear = (media: number) => Math.round(media * (0.75 + rnd() * 0.5));
  const novaChamada = (tarefa: TarefaSim): Chamada => {
    const tipo = tarefa.fila.shift()!;
    return { tipo, ler: sortear(CHAMADAS[tipo].entrada), gerar: sortear(CHAMADAS[tipo].saida), interativa: tarefa.tipo === "analise_caso", pedidaEm: t, tarefa };
  };
  const pedirVaga = (c: Chamada) => (ativas.length < p.vagas ? ativas.push(c) : esperando.push(c));

  while (t < 6 * 3600 && (pendentes.length || ativas.length || esperando.length || fundoNaFila.length || fundoEmAndamento)) {
    while (pendentes.length && pendentes[0].chegada <= t) {
      const tarefa = pendentes.shift()!;
      if (tarefa.tipo === "analise_caso") pedirVaga(novaChamada(tarefa));
      else fundoNaFila.push(tarefa);
    }
    // A fila do banco entrega tarefas enquanto houver vaga (IA_PARALELO menos a reserva).
    while (fundoEmAndamento < p.vagas - Math.floor(p.vagas / 8) && fundoNaFila.length) {
      const tarefa = fundoNaFila.shift()!;
      tarefa.inicio = t;
      fundoEmAndamento++;
      pedirVaga(novaChamada(tarefa));
    }
    // Análise do caso desiste depois da espera máxima.
    for (let i = esperando.length - 1; i >= 0; i--) {
      const c = esperando[i];
      if (desistencia && c.interativa && t - c.pedidaEm > ESPERA_MAXIMA_S) {
        esperando.splice(i, 1);
        c.tarefa.desistiu = true;
        c.tarefa.fim = t;
      }
    }
    const lendo = ativas.filter((c) => c.ler > 0);
    const gerando = ativas.filter((c) => c.ler <= 0);
    if (ativas.length) ocupadoGpu += dt;
    for (const c of lendo) c.ler -= (p.leitura / lendo.length) * dt;
    const v = velocidadePorTarefa(p, gerando.length);
    for (const c of gerando) c.gerar -= v * dt;
    for (let i = ativas.length - 1; i >= 0; i--) {
      const c = ativas[i];
      if (c.ler > 0 || c.gerar > 0) continue;
      ativas.splice(i, 1);
      const tarefa = c.tarefa;
      if (tarefa.fila.length) esperando.push(novaChamada(tarefa));
      else {
        tarefa.fim = t;
        if (tarefa.tipo !== "analise_caso") fundoEmAndamento--;
      }
    }
    // Vagas livres: interativas primeiro, depois por ordem de chegada.
    while (ativas.length < p.vagas && esperando.length) {
      const i = esperando.findIndex((c) => c.interativa);
      ativas.push(esperando.splice(i >= 0 ? i : 0, 1)[0]);
    }
    t += dt;
  }
  return { tarefas, duracaoS: t, ocupadoGpu };
}

const pct = (v: number[], q: number) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return Math.round(o[Math.min(o.length - 1, Math.floor(q * o.length))]);
};

/** Tarefas por hora com a placa sempre cheia (muitas tarefas esperando), na mesma mistura. */
function capacidadePorHora(p: PerfilGpu) {
  const rnd = aleatorio(7);
  const lote = sortearTarefas(Math.max(80, p.vagas * 10), rnd).map((x) => ({ ...x, chegada: 0 }));
  // Sem desistência: mede só a vazão da placa.
  const r = simular(p, lote, rnd, false);
  return Math.round((lote.length / r.duracaoS) * 3600);
}

const resultados = PERFIS.map((p) => {
  const rnd = aleatorio(42);
  const tarefas = sortearTarefas(USUARIOS, rnd);
  const r = simular(p, tarefas, rnd);
  const porTipo = Object.fromEntries(
    (["analise_caso", "pesquisa", "peca", "auditoria"] as const).map((tipo) => {
      const ts = r.tarefas.filter((x) => x.tipo === tipo);
      const feitas = ts.filter((x) => !x.desistiu && x.fim !== undefined);
      const tempos = feitas.map((x) => x.fim! - x.chegada);
      return [tipo, { pedidos: ts.length, concluidas: feitas.length, desistencias: ts.filter((x) => x.desistiu).length, p50s: pct(tempos, 0.5), p95s: pct(tempos, 0.95), maxs: pct(tempos, 1) }];
    }),
  );
  const fimTudo = Math.max(...r.tarefas.map((x) => x.fim ?? 0));
  // A simulação para em 6 horas: o que não terminou até lá fica contado à parte.
  const semTerminar = r.tarefas.filter((x) => x.fim === undefined).length;
  const capacidade = capacidadePorHora(p);
  return {
    perfil: p.id,
    nome: p.nome,
    placa: p.placa,
    motor: p.motor,
    origem: p.origem,
    preco: p.preco,
    vagas: p.vagas,
    porTipo,
    tudoProntoEmS: semTerminar ? null : Math.round(fimTudo),
    semTerminarEm6h: semTerminar,
    capacidadeTarefasHora: capacidade,
  };
});

for (const r of resultados) {
  console.log(`\n${r.nome} — ${r.placa} (${r.motor}, ${r.origem}), ${r.vagas} vagas, ${r.preco}`);
  console.table(r.porTipo);
  const pronto = r.tudoProntoEmS === null ? `mais de 6 h (${r.semTerminarEm6h} tarefas sem terminar)` : `${Math.round(r.tudoProntoEmS / 60)} min`;
  console.log(`Tudo pronto em ${pronto}. Capacidade com a placa cheia: ~${r.capacidadeTarefasHora} tarefas/hora.`);
}
const saida = arg("saida", "");
if (saida) writeFileSync(saida, JSON.stringify({ usuarios: USUARIOS, rampaS: RAMPA_S, mistura: MISTURA, resultados }, null, 1));
