import "server-only";
import { z } from "zod";
import { registrarUsoIa } from "@/lib/registros";

/*
 * IA local: modelo aberto (Qwen) servido pelo Ollama no próprio servidor. O
 * conteúdo das tarefas não é enviado a nenhum provedor externo de IA.
 *
 * - Saída estruturada: o JSON Schema gerado do Zod restringe a geração (campo
 *   `format`) e também vai no prompt, porque é só ali que o modelo lê as
 *   descrições dos campos. A resposta é validada de novo pelo Zod.
 * - Vagas: no máximo IA_PARALELO chamadas ao mesmo tempo (padrão 1), igual ao
 *   OLLAMA_NUM_PARALLEL do servidor de IA; as demais esperam aqui, e não no
 *   Ollama, onde estourariam o tempo do HTTP. Chamadas em que alguém espera na
 *   tela (análise do caso, explicação de norma, carta) passam à frente das
 *   tarefas da fila e desistem depois de IA_ESPERA_MAXIMA_S segundos.
 * - Contexto fixo (OLLAMA_NUM_CTX) em todas as chamadas: mudar o tamanho entre
 *   chamadas faria o Ollama recarregar o modelo.
 * - Raciocínio ("thinking") desligado por padrão: no teste em placa de 8 GB, a
 *   mesma resposta levou 18 vezes mais tempo. OLLAMA_PENSAR=true liga para as
 *   tarefas de esforço alto.
 * - Protocolo: IA_API=ollama (padrão, /api/chat) ou IA_API=openai (/v1/chat/completions,
 *   com saída por JSON Schema), para servir o modelo com vLLM ou SGLang, que agrupam
 *   dezenas de tarefas na mesma placa. OLLAMA_URL é o endereço do servidor nos dois
 *   casos, e IA_API_KEY, se houver, vai como "Authorization: Bearer". IA_OPENAI_EXTRA
 *   (JSON) acrescenta campos próprios de cada servidor ao pedido: o Ollama em /v1, por
 *   exemplo, só desliga o raciocínio com {"reasoning_effort":"none"}.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const PROTOCOLO_OPENAI = process.env.IA_API === "openai";
const EXTRA_OPENAI = JSON.parse(process.env.IA_OPENAI_EXTRA || "{}") as Record<string, unknown>;
const CABECALHOS: Record<string, string> = {
  "content-type": "application/json",
  ...(process.env.IA_API_KEY ? { authorization: `Bearer ${process.env.IA_API_KEY}` } : {}),
};
export const MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";
export const CONTEXTO_TOKENS = Number(process.env.OLLAMA_NUM_CTX ?? 32_768);
const MANTER_CARREGADO = process.env.OLLAMA_KEEP_ALIVE ?? "10m";
const PENSAR_NO_ESFORCO_ALTO = process.env.OLLAMA_PENSAR === "true";
/** Teto por chamada; a mais longa (parecer da auditoria) leva poucos minutos numa placa de 8 GB. */
const TEMPO_MAXIMO_CHAMADA_MS = 20 * 60 * 1000;

export type Effort = "low" | "medium" | "high";
export type Rastreio = { userId?: string | null; recurso: string; referenciaId?: string };

/** Estimativa conservadora para português (~3,2 caracteres por token no Qwen). */
export const estimarTokens = (texto: string) => Math.ceil(texto.length / 3.2);

/** O servidor do Ollama não responde ou o modelo não foi baixado. */
export class IaIndisponivelError extends Error {
  constructor(detalhe: string) {
    super(detalhe);
    this.name = "IaIndisponivelError";
  }
}

/** Mensagem já escrita para o usuário final. */
export class IaAvisoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "IaAvisoError";
  }
}

const VAGAS = Math.max(1, Number(process.env.IA_PARALELO ?? 1) || 1);
const ESPERA_MAXIMA_INTERATIVA_MS = Math.max(10, Number(process.env.IA_ESPERA_MAXIMA_S ?? 180) || 180) * 1000;
/** Recursos em que o usuário espera o resultado na tela. */
const RECURSOS_INTERATIVOS = new Set(["analise_caso", "explicacao", "carta"]);

type Espera = { interativa: boolean; liberar: () => void };
// Em globalThis: sobrevive ao recarregamento de módulos no desenvolvimento.
const global = globalThis as unknown as { vagasIa?: { ocupadas: number; esperando: Espera[] } };
const vagas = (global.vagasIa ??= { ocupadas: 0, esperando: [] });

function liberarVaga() {
  // As interativas saem primeiro; entre iguais, por ordem de chegada.
  const i = vagas.esperando.findIndex((e) => e.interativa);
  const proxima = vagas.esperando.splice(i >= 0 ? i : 0, 1)[0];
  if (proxima) proxima.liberar();
  else vagas.ocupadas--;
}

async function comVaga<T>(interativa: boolean, tarefa: () => Promise<T>): Promise<T> {
  if (vagas.ocupadas < VAGAS) {
    vagas.ocupadas++;
  } else {
    await new Promise<void>((resolve, reject) => {
      const espera: Espera = { interativa, liberar: () => (clearTimeout(desistir), resolve()) };
      const desistir = interativa
        ? setTimeout(() => {
            const i = vagas.esperando.indexOf(espera);
            if (i >= 0) vagas.esperando.splice(i, 1);
            reject(new IaAvisoError("A IA está muito ocupada agora. Tente de novo em alguns minutos."));
          }, ESPERA_MAXIMA_INTERATIVA_MS)
        : undefined;
      vagas.esperando.push(espera);
    });
  }
  try {
    return await tarefa();
  } finally {
    liberarVaga();
  }
}

type RespostaOllama = {
  conteudo: string;
  doneReason: string | null;
  promptTokens: number;
  saidaTokens: number;
};

type Pedido = { system: string; usuario: string; schema: Record<string, unknown>; maxTokens: number; pensar: boolean };

/** Corpo da requisição em cada protocolo. */
function corpoDoPedido(p: Pedido) {
  const messages = [
    { role: "system", content: p.system },
    { role: "user", content: p.usuario },
  ];
  if (PROTOCOLO_OPENAI) {
    return {
      model: MODEL,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: p.maxTokens,
      response_format: { type: "json_schema", json_schema: { name: "resposta", schema: p.schema, strict: true } },
      // Qwen no vLLM/SGLang: o raciocínio é ligado e desligado pelo modelo de conversa.
      chat_template_kwargs: { enable_thinking: p.pensar },
      messages,
      ...EXTRA_OPENAI,
    };
  }
  return {
    model: MODEL,
    stream: true,
    think: p.pensar,
    format: p.schema,
    keep_alive: MANTER_CARREGADO,
    options: { num_ctx: CONTEXTO_TOKENS, num_predict: p.maxTokens },
    messages,
  };
}

async function chamarModelo(pedido: Pedido): Promise<RespostaOllama> {
  let resposta: Response;
  try {
    resposta = await fetch(new URL(PROTOCOLO_OPENAI ? "/v1/chat/completions" : "/api/chat", OLLAMA_URL), {
      method: "POST",
      headers: CABECALHOS,
      body: JSON.stringify(corpoDoPedido(pedido)),
      signal: AbortSignal.timeout(TEMPO_MAXIMO_CHAMADA_MS),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") throw new IaAvisoError("A IA demorou demais para responder. Tente novamente.");
    throw new IaIndisponivelError(`sem conexão com o servidor de IA em ${OLLAMA_URL} (rode npm run ia:iniciar): ${e instanceof Error ? e.message : e}`);
  }
  if (!resposta.ok || !resposta.body) {
    const texto = await resposta.text().catch(() => "");
    if (resposta.status === 404) throw new IaIndisponivelError(`modelo ${MODEL} não encontrado (rode npm run ia:baixar -- ${MODEL}): ${texto}`);
    throw new Error(`O servidor de IA respondeu HTTP ${resposta.status}: ${texto.slice(0, 500)}`);
  }
  return PROTOCOLO_OPENAI ? lerStreamingOpenAi(resposta.body) : lerStreamingOllama(resposta.body);
}

type CorpoHttp = NonNullable<Response["body"]>;

/** Linhas completas de um streaming de texto. */
async function* linhasDe(corpo: CorpoHttp) {
  let resto = "";
  const leitor = corpo.pipeThrough(new TextDecoderStream()).getReader();
  for (let lido = await leitor.read(); !lido.done; lido = await leitor.read()) {
    resto += lido.value;
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    for (const linha of linhas) if (linha.trim()) yield linha;
  }
  if (resto.trim()) yield resto;
}

/** Eventos "data: {...}" do protocolo OpenAI; o último traz o uso (stream_options.include_usage). */
async function lerStreamingOpenAi(corpo: CorpoHttp): Promise<RespostaOllama> {
  const r: RespostaOllama = { conteudo: "", doneReason: null, promptTokens: 0, saidaTokens: 0 };
  for await (const linha of linhasDe(corpo)) {
    if (!linha.startsWith("data:")) continue;
    const dado = linha.slice(5).trim();
    if (dado === "[DONE]") break;
    const ev = JSON.parse(dado) as {
      choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      error?: { message?: string } | string;
    };
    if (ev.error) throw new Error(`Servidor de IA: ${typeof ev.error === "string" ? ev.error : ev.error.message}`);
    const escolha = ev.choices?.[0];
    r.conteudo += escolha?.delta?.content ?? "";
    if (escolha?.finish_reason) r.doneReason = escolha.finish_reason;
    if (ev.usage) {
      r.promptTokens = ev.usage.prompt_tokens ?? 0;
      r.saidaTokens = ev.usage.completion_tokens ?? 0;
    }
  }
  return r;
}

async function lerStreamingOllama(corpo: CorpoHttp): Promise<RespostaOllama> {
  // Streaming: os tokens chegam continuamente e a conexão não fica parada à espera do fim.
  const r: RespostaOllama = { conteudo: "", doneReason: null, promptTokens: 0, saidaTokens: 0 };
  for await (const linha of linhasDe(corpo)) {
    const ev = JSON.parse(linha) as {
      message?: { content?: string };
      done?: boolean;
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
      error?: string;
    };
    if (ev.error) throw new Error(`Ollama: ${ev.error}`);
    r.conteudo += ev.message?.content ?? "";
    if (ev.done) {
      r.doneReason = ev.done_reason ?? null;
      r.promptTokens = ev.prompt_eval_count ?? 0;
      r.saidaTokens = ev.eval_count ?? 0;
    }
  }
  return r;
}

/**
 * Chamada com saída estruturada validada por Zod. `content` pode vir em partes
 * (contexto comum primeiro): chamadas seguidas com o mesmo começo reaproveitam
 * o processamento já feito pelo Ollama.
 */
export async function gerarEstruturado<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: string | string[];
  effort: Effort;
  maxTokens?: number;
  /** Quem pediu e para quê: alimenta o painel de uso de IA. */
  rastreio?: Rastreio;
}): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const instrucaoFormato = [
    "<formato_da_resposta>",
    "Responda somente com um objeto JSON válido, em português, que siga este JSON Schema. As descrições explicam o que escrever em cada campo.",
    JSON.stringify(jsonSchema),
    "</formato_da_resposta>",
  ].join("\n");
  const usuario = [...(Array.isArray(opts.content) ? opts.content : [opts.content]), instrucaoFormato].join("\n\n");
  const maxTokens = opts.maxTokens ?? 8000;

  if (estimarTokens(opts.system + usuario) + maxTokens > CONTEXTO_TOKENS) {
    throw new IaAvisoError("O texto enviado é grande demais para a análise. Envie um trecho menor ou divida o documento em partes.");
  }

  const pedido: Pedido = { system: opts.system, usuario, schema: jsonSchema, maxTokens, pensar: PENSAR_NO_ESFORCO_ALTO && opts.effort === "high" };

  return comVaga(RECURSOS_INTERATIVOS.has(opts.rastreio?.recurso ?? ""), async () => {
    const inicio = Date.now();
    const uso = { promptTokens: 0, saidaTokens: 0 };
    let erro: string | null = null;
    try {
      // Uma segunda tentativa cobre a resposta que sai do formato (raro com `format`).
      for (let tentativa = 1; ; tentativa++) {
        const r = await chamarModelo(pedido);
        uso.promptTokens += r.promptTokens;
        uso.saidaTokens += r.saidaTokens;
        if (r.doneReason === "length") {
          throw new IaAvisoError("A resposta excedeu o limite de tamanho. Tente com um texto menor.");
        }
        let json: unknown;
        try {
          json = JSON.parse(r.conteudo);
        } catch {
          json = undefined;
        }
        const validado = opts.schema.safeParse(json);
        if (validado.success) return validado.data as z.infer<S>;
        if (tentativa >= 2) throw new IaAvisoError("A IA não conseguiu montar a resposta no formato esperado. Tente novamente.");
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await registrar(opts.rastreio, uso, inicio, erro);
    }
  });
}

async function registrar(rastreio: Rastreio | undefined, uso: { promptTokens: number; saidaTokens: number }, inicio: number, erro: string | null) {
  if (!rastreio) return;
  await registrarUsoIa({
    userId: rastreio.userId ?? null,
    recurso: rastreio.recurso,
    referenciaId: rastreio.referenciaId ?? null,
    modelo: MODEL,
    inputTokens: uso.promptTokens,
    outputTokens: uso.saidaTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    duracaoMs: Date.now() - inicio,
    sucesso: erro === null,
    erro,
  });
}

/** O servidor de IA responde e tem o modelo configurado (painel da administração). */
export async function iaDisponivel(): Promise<boolean> {
  try {
    const r = await fetch(new URL(PROTOCOLO_OPENAI ? "/v1/models" : "/api/tags", OLLAMA_URL), { headers: CABECALHOS, signal: AbortSignal.timeout(2000) });
    if (!r.ok) return false;
    if (PROTOCOLO_OPENAI) return ((await r.json()) as { data: { id: string }[] }).data.some((m) => m.id === MODEL);
    const { models } = (await r.json()) as { models: { name: string }[] };
    return models.some((m) => m.name === MODEL);
  } catch {
    return false;
  }
}

/** Mensagem segura para mostrar ao usuário quando uma tarefa de IA falha. */
export function mensagemDeErro(error: unknown) {
  if (error instanceof IaAvisoError) return error.message;
  if (error instanceof IaIndisponivelError) {
    console.error("[ia]", error.message);
    return "O serviço de IA está indisponível no momento. Tente novamente mais tarde; se continuar, fale com o suporte.";
  }
  // Detalhes técnicos ficam no log; o usuário recebe uma mensagem genérica.
  console.error("[ia] falha:", error);
  return "Não foi possível concluir a análise. Tente novamente; se continuar, fale com o suporte.";
}
