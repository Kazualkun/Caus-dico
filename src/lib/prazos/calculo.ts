/**
 * Cálculo de prazos processuais. Funções puras: rodam no navegador (calculadora
 * ao vivo) e no servidor (ao salvar). Datas sempre como "AAAA-MM-DD", em UTC,
 * para não depender do fuso de quem usa.
 *
 * Regras aplicadas:
 * - Cível (CPC): dias úteis (art. 219); exclui o dia do começo e inclui o do
 *   vencimento (art. 224); suspensão de 20/12 a 20/01 (art. 220).
 * - Trabalhista (CLT): dias úteis, mesma forma de contagem (art. 775);
 *   suspensão de 20/12 a 20/01 (art. 775-A).
 * - Penal (CPP): dias corridos, contínuos (art. 798); exclui o dia do começo
 *   (§ 1º); a contagem só começa em dia útil (Súmula 310 do STF); vencimento em
 *   dia sem expediente é prorrogado para o dia útil seguinte (§ 3º); suspensão
 *   de 20/12 a 20/01, salvo réu preso, Lei Maria da Penha e medidas urgentes
 *   (art. 798-A).
 * - Diário de Justiça Eletrônico: publicação no primeiro dia útil seguinte ao
 *   da disponibilização, e a contagem começa no primeiro dia útil seguinte ao da
 *   publicação (Lei 11.419/2006, art. 4º, §§ 3º e 4º; CPC, art. 224, §§ 2º e 3º).
 * - Dia com expediente reduzido (ex.: Quarta-feira de Cinzas) conta no meio do
 *   prazo, mas não pode ser o primeiro nem o último dia (CPC, art. 224, § 1º).
 *
 * Feriados locais e suspensões do tribunal variam: o advogado informa os dele,
 * e a tela sempre pede para conferir no calendário oficial do tribunal.
 */

export type Ramo = "civel" | "trabalhista" | "penal";
export type FormaIntimacao = "dje" | "intimacao";
export type Justica = "estadual" | "federal" | "trabalho";

export const RAMOS: Record<Ramo, { nome: string; diasUteis: boolean; fundamento: string }> = {
  civel: { nome: "Cível (CPC)", diasUteis: true, fundamento: "CPC, arts. 219, 220 e 224" },
  trabalhista: { nome: "Trabalhista (CLT)", diasUteis: true, fundamento: "CLT, arts. 775 e 775-A" },
  penal: { nome: "Penal (CPP)", diasUteis: false, fundamento: "CPP, arts. 798 e 798-A; Súmula 310 do STF" },
};

/** Dias usuais sem expediente forense (ou com expediente reduzido), além dos feriados nacionais. */
export const DIAS_USUAIS = {
  carnaval: { nome: "Carnaval (segunda e terça)", tipo: "sem_expediente" },
  cinzas: { nome: "Quarta-feira de Cinzas (expediente reduzido)", tipo: "reduzido" },
  quartaSanta: { nome: "Quarta-feira Santa", tipo: "sem_expediente" },
  quintaSanta: { nome: "Quinta-feira Santa", tipo: "sem_expediente" },
  sextaSanta: { nome: "Sexta-feira da Paixão", tipo: "sem_expediente" },
  corpusChristi: { nome: "Corpus Christi", tipo: "sem_expediente" },
  onzeAgosto: { nome: "11 de agosto (cursos jurídicos)", tipo: "sem_expediente" },
  todosSantos: { nome: "1º de novembro", tipo: "sem_expediente" },
  oitoDezembro: { nome: "8 de dezembro (Dia da Justiça)", tipo: "sem_expediente" },
  recesso: { nome: "Recesso forense, de 20/12 a 06/01", tipo: "sem_expediente" },
} as const;
export type DiaUsual = keyof typeof DIAS_USUAIS;

/**
 * Sugestão inicial por justiça. Só entram dias com respaldo seguro: marcar um dia
 * que o tribunal trabalha alongaria o prazo e faria o advogado perdê-lo. Na
 * dúvida, o prazo calculado fica mais curto; o advogado acrescenta os demais
 * dias conferindo o calendário do tribunal.
 */
export const DIAS_USUAIS_POR_JUSTICA: Record<Justica, DiaUsual[]> = {
  // Lei 5.010/1966, art. 62 (Semana Santa de quarta a domingo, Carnaval, 11/08, 1º/11, 8/12 e recesso).
  federal: ["carnaval", "quartaSanta", "quintaSanta", "sextaSanta", "onzeAgosto", "todosSantos", "oitoDezembro", "recesso"],
  trabalho: ["carnaval", "sextaSanta"],
  estadual: ["carnaval", "sextaSanta"],
};

export const JUSTICAS: Record<Justica, string> = {
  estadual: "Justiça Estadual",
  federal: "Justiça Federal",
  trabalho: "Justiça do Trabalho",
};

export type DiaInformado = { data: string; descricao: string; tipo?: "sem_expediente" | "reduzido" };

export type ParametrosPrazo = {
  ramo: Ramo;
  forma: FormaIntimacao;
  /** Data da disponibilização no DJe ou da intimação (o marco que a lei manda considerar). */
  data: string;
  dias: number;
  emDobro: boolean;
  /** Penal: réu preso, Lei Maria da Penha ou medida urgente afastam a suspensão de fim de ano. */
  semSuspensaoFimDeAno: boolean;
  diasUsuais: DiaUsual[];
  /** Feriados locais e suspensões informados pelo advogado. */
  diasInformados: DiaInformado[];
};

export type TipoDia = "marco" | "publicacao" | "contado" | "fim_de_semana" | "feriado" | "suspenso" | "reduzido";
export type DiaDaLinha = { data: string; tipo: TipoDia; numero?: number; motivo?: string };

export type ResultadoPrazo = {
  vencimento: string;
  publicacao: string | null;
  inicioContagem: string;
  diasContados: number;
  linha: DiaDaLinha[];
  avisos: string[];
  fundamentos: string[];
};

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const DIA_MS = 86_400_000;
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d: Date) => d.toISOString().slice(0, 10);
export const somarDias = (iso: string, n: number) => paraIso(new Date(paraData(iso).getTime() + n * DIA_MS));
const diaDaSemana = (iso: string) => paraData(iso).getUTCDay();
const mmdd = (iso: string) => iso.slice(5);

export function dataValida(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(paraData(iso).getTime()) && paraIso(paraData(iso)) === iso;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Feriados nacionais (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023). */
function feriadoNacional(iso: string): string | null {
  const ano = Number(iso.slice(0, 4));
  const fixos: Record<string, string> = {
    "01-01": "Confraternização Universal",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência",
    "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação da República",
    "12-25": "Natal",
  };
  if (ano >= 2024) fixos["11-20"] = "Dia Nacional de Zumbi e da Consciência Negra";
  return fixos[mmdd(iso)] ?? null;
}

function diaUsual(iso: string, escolhidos: Set<DiaUsual>): { nome: string; tipo: "sem_expediente" | "reduzido" } | null {
  const p = pascoa(Number(iso.slice(0, 4)));
  const relativo = Math.round((paraData(iso).getTime() - paraData(p).getTime()) / DIA_MS);
  const candidatos: [DiaUsual, boolean][] = [
    ["carnaval", relativo === -48 || relativo === -47],
    ["cinzas", relativo === -46],
    ["quartaSanta", relativo === -4],
    ["quintaSanta", relativo === -3],
    ["sextaSanta", relativo === -2],
    ["corpusChristi", relativo === 60],
    ["onzeAgosto", mmdd(iso) === "08-11"],
    ["todosSantos", mmdd(iso) === "11-01"],
    ["oitoDezembro", mmdd(iso) === "12-08"],
    ["recesso", mmdd(iso) >= "12-20" || mmdd(iso) <= "01-06"],
  ];
  for (const [chave, bate] of candidatos) {
    if (bate && escolhidos.has(chave)) return { nome: DIAS_USUAIS[chave].nome, tipo: DIAS_USUAIS[chave].tipo };
  }
  return null;
}

const emSuspensaoFimDeAno = (iso: string) => mmdd(iso) >= "12-20" || mmdd(iso) <= "01-20";

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

/** Quantidade máxima de dias aceita: prazos processuais não passam disso. */
export const MAXIMO_DIAS = 365;

export function calcularPrazo(p: ParametrosPrazo): ResultadoPrazo {
  if (!dataValida(p.data)) throw new Error("Informe uma data válida.");
  const dias = Math.round(p.dias) * (p.emDobro ? 2 : 1);
  if (dias < 1 || dias > MAXIMO_DIAS * 2) throw new Error("Informe um prazo entre 1 e 365 dias.");

  const escolhidos = new Set(p.diasUsuais);
  const informados = new Map(p.diasInformados.filter((d) => dataValida(d.data)).map((d) => [d.data, d]));
  const suspende = p.ramo !== "penal" || !p.semSuspensaoFimDeAno;

  /** Situação do dia no calendário forense, sem considerar a suspensão de prazos. */
  function situacao(iso: string): { tipo: "util" | "fim_de_semana" | "feriado" | "reduzido"; motivo?: string } {
    const dow = diaDaSemana(iso);
    if (dow === 0 || dow === 6) return { tipo: "fim_de_semana", motivo: dow === 0 ? "Domingo" : "Sábado" };
    const nacional = feriadoNacional(iso);
    if (nacional) return { tipo: "feriado", motivo: `Feriado nacional: ${nacional}` };
    const informado = informados.get(iso);
    if (informado) return { tipo: informado.tipo === "reduzido" ? "reduzido" : "feriado", motivo: informado.descricao };
    const usual = diaUsual(iso, escolhidos);
    if (usual) return { tipo: usual.tipo === "reduzido" ? "reduzido" : "feriado", motivo: usual.nome };
    return { tipo: "util" };
  }
  /** Dia com expediente, ainda que reduzido: serve de data de publicação no DJe. */
  const comExpediente = (iso: string) => ["util", "reduzido"].includes(situacao(iso).tipo);
  /**
   * Dia em que o prazo pode começar ou vencer. No cível e no trabalhista, não pode
   * ser dia de expediente reduzido (CPC, art. 224, § 1º); no penal, basta haver
   * expediente (CPP, art. 798, § 3º, só prorroga domingo e feriado).
   */
  const podeIniciarOuVencer = (iso: string) => (p.ramo === "penal" ? comExpediente(iso) : situacao(iso).tipo === "util");

  const linha: DiaDaLinha[] = [{ data: p.data, tipo: "marco", motivo: p.forma === "dje" ? "Disponibilização no DJe" : "Intimação" }];
  const avisos: string[] = [];
  const fundamentos = [RAMOS[p.ramo].fundamento];

  // Dias entre dois marcos, registrados na linha do tempo com o motivo de não contarem.
  function registrarPulo(iso: string) {
    const s = situacao(iso);
    if (s.tipo === "fim_de_semana") linha.push({ data: iso, tipo: "fim_de_semana", motivo: s.motivo });
    else if (s.tipo === "feriado") linha.push({ data: iso, tipo: "feriado", motivo: s.motivo });
    else if (s.tipo === "reduzido") linha.push({ data: iso, tipo: "reduzido", motivo: `${s.motivo}: não pode iniciar nem encerrar o prazo` });
    else if (suspende && emSuspensaoFimDeAno(iso)) linha.push({ data: iso, tipo: "suspenso", motivo: "Prazos suspensos de 20/12 a 20/01" });
  }

  // 1. Publicação (DJe): primeiro dia útil depois da disponibilização.
  let referencia = p.data;
  let publicacao: string | null = null;
  if (p.forma === "dje") {
    let d = somarDias(p.data, 1);
    while (!comExpediente(d)) {
      registrarPulo(d);
      d = somarDias(d, 1);
    }
    publicacao = d;
    referencia = d;
    linha.push({ data: d, tipo: "publicacao", motivo: "Considera-se publicado (1º dia útil após a disponibilização)" });
    fundamentos.push("Lei 11.419/2006, art. 4º, §§ 3º e 4º");
  }

  // 2. Primeiro dia da contagem: dia útil depois do marco, fora da suspensão.
  let inicio = somarDias(referencia, 1);
  while (!podeIniciarOuVencer(inicio) || (suspende && emSuspensaoFimDeAno(inicio))) {
    registrarPulo(inicio);
    inicio = somarDias(inicio, 1);
  }

  // 3. Contagem.
  let atual = inicio;
  let contados = 0;
  let vencimento = inicio;
  while (true) {
    const s = situacao(atual);
    const suspenso = suspende && emSuspensaoFimDeAno(atual);
    const conta = suspenso ? false : RAMOS[p.ramo].diasUteis ? s.tipo === "util" || s.tipo === "reduzido" : true;
    if (conta) {
      contados++;
      linha.push({ data: atual, tipo: "contado", numero: contados, motivo: s.tipo !== "util" ? s.motivo : undefined });
      if (contados === dias) {
        vencimento = atual;
        break;
      }
    } else {
      registrarPulo(atual);
    }
    atual = somarDias(atual, 1);
  }

  // 4. O vencimento precisa cair em dia útil: senão, vai para o próximo.
  if (!podeIniciarOuVencer(vencimento)) {
    let d = somarDias(vencimento, 1);
    while (!podeIniciarOuVencer(d) || (suspende && emSuspensaoFimDeAno(d))) {
      registrarPulo(d);
      d = somarDias(d, 1);
    }
    linha.push({ data: d, tipo: "contado", motivo: "Vencimento prorrogado para o primeiro dia útil" });
    vencimento = d;
    if (p.ramo === "penal") fundamentos.push("CPP, art. 798, § 3º");
    else fundamentos.push("CPC, art. 224, § 1º");
  }

  if (p.emDobro) avisos.push("Prazo contado em dobro. Confira se a parte tem a prerrogativa (ex.: CPC, arts. 180, 183 e 186).");
  if (p.ramo === "penal" && p.semSuspensaoFimDeAno) avisos.push("Sem a suspensão de 20/12 a 20/01 (réu preso, Lei Maria da Penha ou medida urgente: CPP, art. 798-A).");
  if (p.forma === "intimacao") {
    avisos.push(
      p.ramo === "penal"
        ? "O marco é a data da intimação ou da audiência em que a parte estava presente (CPP, art. 798, § 5º)."
        : "Confira o marco inicial: juntada do mandado ou do aviso de recebimento, ciência no portal ou decurso de 10 dias da intimação eletrônica (CPC, art. 231; Lei 11.419/2006, art. 5º).",
    );
  }
  avisos.push("Feriados estaduais e municipais e suspensões do tribunal entram só se informados. Confira no calendário oficial do tribunal.");

  return { vencimento, publicacao, inicioContagem: inicio, diasContados: contados, linha, avisos, fundamentos };
}

const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function formatarData(iso: string, comDia = false) {
  const [a, m, d] = iso.split("-");
  return comDia ? `${d}/${m}/${a} (${DIAS_DA_SEMANA[diaDaSemana(iso)]})` : `${d}/${m}/${a}`;
}

/** Hoje no fuso de Brasília, em "AAAA-MM-DD". */
export function hojeEmBrasilia(agora = new Date()) {
  return paraIso(new Date(agora.getTime() - 3 * 60 * 60 * 1000));
}

export function diasAte(iso: string, hoje = hojeEmBrasilia()) {
  return Math.round((paraData(iso).getTime() - paraData(hoje).getTime()) / DIA_MS);
}
