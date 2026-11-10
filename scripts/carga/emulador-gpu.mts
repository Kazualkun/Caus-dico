/**
 * Emulador de servidor de IA para o teste de carga: responde como o Ollama
 * (/api/chat e /api/tags), com um JSON válido para o formato pedido e no tempo que
 * a GPU do perfil levaria, considerando quantas tarefas ela está gerando ao mesmo
 * tempo. Serve para testar site, banco e fila com 100 pessoas sem ter a GPU.
 *
 *   npx tsx scripts/carga/emulador-gpu.mts --perfil l40s --porta 11500
 *
 * Aponte o servidor do Causídico para ele: OLLAMA_URL=http://127.0.0.1:11500 e
 * IA_PARALELO igual às vagas do perfil.
 */
import { createServer } from "node:http";
import { CHAMADAS, perfil, velocidadePorTarefa, type TipoChamada } from "./perfis.mjs";
import { gerar, TEXTO, type Schema } from "./json-do-schema.mjs";

const arg = (nome: string, padrao: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const P = perfil(arg("perfil", "local"));
const PORTA = Number(arg("porta", "11500"));
const MODELO = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";

// ---------------------------------------------------------------------------
// Tipo de chamada e tamanho
// ---------------------------------------------------------------------------

function tipoDaChamada(sistema: string, usuario: string): TipoChamada {
  if (sistema.startsWith("Você prepara consultas")) return "planejamento";
  if (sistema.startsWith("Você integra uma equipe de revisão contratual")) {
    if (usuario.includes("Seu papel agora: Estrategista")) return "estrategista";
    if (usuario.includes("Seu papel agora: Pesquisador")) return "pesquisador";
    return "analista";
  }
  if (sistema.startsWith("Você é um pesquisador jurídico")) return "nota_pesquisa";
  if (sistema.startsWith("Você orienta advogados brasileiros na escolha da peça")) return "peca";
  if (sistema.startsWith("Você redige propostas")) return "carta";
  if (sistema.startsWith("Você ajuda advogados brasileiros, principalmente os que estão começando")) return "analise_caso";
  return "explicacao";
}

/** Variação de ±25% em torno do típico. */
const sortear = (media: number) => Math.max(20, Math.round(media * (0.75 + Math.random() * 0.5)));

// ---------------------------------------------------------------------------
// GPU: vagas, leitura do prompt e geração compartilhada
// ---------------------------------------------------------------------------

type Pedido = { lerRestante: number; gerarRestante: number; fim: () => void };
const ativos: Pedido[] = [];
const espera: Pedido[] = [];
let concluidos = 0;

function entrar(p: Pedido) {
  if (ativos.length < P.vagas) ativos.push(p);
  else espera.push(p);
}

let ultimo = performance.now();
setInterval(() => {
  const agora = performance.now();
  const dt = (agora - ultimo) / 1000;
  ultimo = agora;
  const lendo = ativos.filter((p) => p.lerRestante > 0);
  const gerando = ativos.filter((p) => p.lerRestante <= 0);
  for (const p of lendo) p.lerRestante -= (P.leitura / lendo.length) * dt;
  const v = velocidadePorTarefa(P, gerando.length);
  for (const p of gerando) p.gerarRestante -= v * dt;
  for (let i = ativos.length - 1; i >= 0; i--) {
    if (ativos[i].lerRestante <= 0 && ativos[i].gerarRestante <= 0) {
      const [feito] = ativos.splice(i, 1);
      concluidos++;
      feito.fim();
      const proximo = espera.shift();
      if (proximo) ativos.push(proximo);
    }
  }
}, 50);

setInterval(() => {
  if (ativos.length || espera.length) {
    console.log(`[${new Date().toLocaleTimeString("pt-BR")}] gerando ${ativos.length}/${P.vagas}, esperando ${espera.length}, concluídas ${concluidos}`);
  }
}, 15_000);

// ---------------------------------------------------------------------------
// HTTP compatível com o Ollama
// ---------------------------------------------------------------------------

createServer((req, res) => {
  if (req.url === "/api/tags") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ models: [{ name: MODELO }] }));
    return;
  }
  if (req.url !== "/api/chat" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const pedido = JSON.parse(corpo) as { messages: { role: string; content: string }[]; format?: Schema; options?: { num_predict?: number } };
    const sistema = pedido.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = pedido.messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n");
    const tipo = tipoDaChamada(sistema, usuario);
    const entrada = Math.ceil((sistema.length + usuario.length) / 3.2);
    const saida = Math.min(sortear(CHAMADAS[tipo].saida), pedido.options?.num_predict ?? Infinity);
    const conteudo = JSON.stringify(pedido.format ? gerar(pedido.format) : { texto: TEXTO });

    res.writeHead(200, { "content-type": "application/x-ndjson" });
    // Um pedaço vazio a cada 10 s mantém a conexão viva, como o streaming real.
    const vivo = setInterval(() => res.write(`${JSON.stringify({ message: { content: "" }, done: false })}\n`), 10_000);
    req.on("close", () => clearInterval(vivo));
    entrar({
      lerRestante: entrada,
      gerarRestante: saida,
      fim: () => {
        clearInterval(vivo);
        res.write(`${JSON.stringify({ message: { content: conteudo }, done: false })}\n`);
        res.end(`${JSON.stringify({ message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: entrada, eval_count: saida })}\n`);
      },
    });
  });
}).listen(PORTA, "127.0.0.1", () => {
  console.log(`Emulador de GPU "${P.nome}" (${P.placa}, ${P.motor}) em http://127.0.0.1:${PORTA}: ${P.vagas} vagas, ${P.umaTarefa} tok/s com uma tarefa, até ${P.total} tok/s no total.`);
});
