/**
 * Perfis de servidor de IA usados no teste de carga (emulador de GPU e simulação da fila).
 *
 * Modelo: qwen3.5:9b (8,95 bilhões de parâmetros, arquitetura híbrida). O cache de
 * contexto é pequeno (544 MB para 32 mil tokens, medido no log do Ollama), então a
 * memória da placa comporta dezenas de tarefas simultâneas; o limite é o cálculo.
 *
 * - umaTarefa: tokens/s de geração com uma tarefa por vez.
 * - total: tokens/s de geração somando todas as tarefas, com a placa cheia (lote grande).
 * - leitura: tokens/s de leitura do prompt (prefill).
 * - vagas: tarefas simultâneas (IA_PARALELO e o paralelismo do servidor de IA).
 *
 * "medido": RTX 2070 Super desta máquina, com o Ollama. Os demais são estimativas
 * conservadoras para vLLM com o modelo quantizado (FP8/AWQ), a partir da banda de
 * memória de cada placa e de testes publicados com modelos de 8B; confirme com
 * `vllm bench serve` na máquina contratada antes de fechar contrato longo.
 */
export type PerfilGpu = {
  id: string;
  nome: string;
  placa: string;
  motor: string;
  umaTarefa: number;
  total: number;
  leitura: number;
  vagas: number;
  /** Preço mensal de referência e onde foi visto (consultado em 02/11/2026). */
  preco: string;
  origem: "medido" | "estimado";
};

export const PERFIS: PerfilGpu[] = [
  {
    id: "local",
    nome: "Esta máquina",
    placa: "RTX 2070 Super 8 GB",
    motor: "Ollama",
    // Efetivo nas chamadas longas (contexto de 5 a 9 mil tokens), com 4 das 33 camadas na CPU.
    umaTarefa: 13.5,
    total: 13.5,
    leitura: 900,
    vagas: 1,
    preco: "computador do escritório (sem custo mensal)",
    origem: "medido",
  },
  {
    id: "rtx4000",
    nome: "Hetzner GEX44",
    placa: "RTX 4000 SFF Ada 20 GB",
    motor: "vLLM",
    umaTarefa: 35,
    total: 550,
    leitura: 3_000,
    vagas: 12,
    preco: "≈ € 184/mês + € 114 de instalação (Alemanha/Finlândia)",
    origem: "estimado",
  },
  {
    id: "l4",
    nome: "AWS g6.xlarge (São Paulo)",
    placa: "L4 24 GB",
    motor: "vLLM",
    umaTarefa: 45,
    total: 800,
    leitura: 4_000,
    vagas: 16,
    preco: "≈ US$ 999/mês sob demanda; ~US$ 170/mês em spot (pode ser interrompida)",
    origem: "estimado",
  },
  {
    id: "l40s",
    nome: "Magalu Cloud (São Paulo)",
    placa: "L40S 48 GB",
    motor: "vLLM",
    umaTarefa: 100,
    total: 2_500,
    leitura: 12_000,
    vagas: 48,
    preco: "R$ 6.310/mês (8 vCPU, 64 GB, 1× L40S)",
    origem: "estimado",
  },
  {
    id: "rtxpro6000",
    nome: "Hetzner GEX131",
    placa: "RTX PRO 6000 Blackwell 96 GB",
    motor: "vLLM",
    umaTarefa: 150,
    total: 4_000,
    leitura: 20_000,
    vagas: 64,
    preco: "≈ € 889 a € 1.199/mês + instalação (Alemanha/Finlândia)",
    origem: "estimado",
  },
];

export function perfil(id: string): PerfilGpu {
  const p = PERFIS.find((x) => x.id === id);
  if (!p) throw new Error(`perfil desconhecido: ${id} (use ${PERFIS.map((x) => x.id).join(", ")})`);
  return p;
}

/**
 * Tokens/s de cada tarefa com `n` gerando ao mesmo tempo: a vazão total cresce com o
 * lote até saturar (curva n/(n+k)), e a de cada tarefa cai.
 */
export function velocidadePorTarefa(p: PerfilGpu, n: number) {
  if (n <= 1) return p.umaTarefa;
  const k = p.total / p.umaTarefa - 1;
  const totalAgora = k <= 0 ? p.umaTarefa : (p.total * n) / (n + k);
  return totalAgora / n;
}

/**
 * Tamanho típico de cada chamada (tokens), medido nas tarefas reais desta máquina
 * (tabela ai_usage, 02/11/2026: 9 auditorias, 6 pesquisas, 4 análises do caso, 4
 * triagens). O emulador e a simulação sorteiam ±25% em torno destes valores.
 */
export const CHAMADAS = {
  planejamento: { entrada: 700, saida: 150 },
  analista: { entrada: 4_900, saida: 1_650 },
  pesquisador: { entrada: 4_900, saida: 1_720 },
  estrategista: { entrada: 7_500, saida: 2_500 },
  nota_pesquisa: { entrada: 4_300, saida: 1_110 },
  peca: { entrada: 4_500, saida: 1_300 },
  analise_caso: { entrada: 700, saida: 340 },
  explicacao: { entrada: 3_000, saida: 900 },
  carta: { entrada: 1_200, saida: 700 },
} as const;
export type TipoChamada = keyof typeof CHAMADAS;

/** Chamadas de cada tarefa, em sequência. */
export const TAREFAS = {
  auditoria: ["planejamento", "analista", "pesquisador", "estrategista"],
  pesquisa: ["planejamento", "nota_pesquisa"],
  peca: ["planejamento", "peca"],
  analise_caso: ["analise_caso"],
} as const satisfies Record<string, readonly TipoChamada[]>;
export type TipoTarefaCarga = keyof typeof TAREFAS;
