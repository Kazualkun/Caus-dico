import "server-only";
import { CONTEXTO_TOKENS, gerarEstruturado, MODEL, type Rastreio } from "@/lib/ai/ollama";
import {
  ParecerContrato,
  PlanoDeBusca,
  RelatorioEspecialista,
  type ContractAnalysisData,
} from "@/lib/ai/schemas";
import {
  PAPEL_ANALISTA,
  PAPEL_ESTRATEGISTA,
  PAPEL_PESQUISADOR,
  SISTEMA_EQUIPE,
  SISTEMA_PLANEJAMENTO,
} from "@/lib/ai/prompts";
import { ETAPAS_ANALISE, type ReportarEtapa } from "@/lib/ai/etapas";
import { buscarFontes, filtrarIds, fontesCitadas, formatarFontes } from "@/lib/legal/retrieval";
import { verificarCitacoes } from "@/lib/acervo/citacoes";

/*
 * Auditoria de contratos em equipe, no formato do "AI Legal Agent Team"
 * (awesome-llm-apps): papéis especializados e um líder que consolida.
 *
 *   1. Planejamento   identifica o tipo de contrato e monta as consultas
 *   2. Acervo         busca artigos, súmulas e temas no acervo ctresb/leis
 *   3. Especialistas  Analista (brechas/ambiguidades) e Pesquisador
 *                     (conformidade legal), um depois do outro
 *   4. Estrategista   consolida, corrige severidades e orienta as correções
 *                     (a IA não redige cláusulas; quem redige é o advogado)
 *
 * As três chamadas da equipe compartilham o mesmo começo (sistema, contrato e
 * fontes), que o Ollama reaproveita entre chamadas; só a instrução do papel muda.
 */

export type Perspectiva = "contratante" | "contratado" | "neutra";

const PERSPECTIVAS: Record<Perspectiva, string> = {
  contratante: "O advogado representa a parte contratante (quem recebe o produto ou serviço e paga por ele).",
  contratado: "O advogado representa a parte contratada (quem fornece o produto ou serviço e é remunerada).",
  neutra: "Revisão neutra: aponte os riscos para ambas as partes e para a segurança jurídica do instrumento.",
};

/**
 * Tamanho máximo do contrato: o que sobra do contexto da IA depois do sistema,
 * das fontes, dos dois relatórios e da resposta do Estrategista (≈ 22 mil
 * tokens). Com 32 mil tokens de contexto, ~34 mil caracteres (≈ 10 páginas).
 */
export const LIMITE_CARACTERES_CONTRATO = Math.max(10_000, Math.floor((CONTEXTO_TOKENS - 22_000) * 3.2));
/** Orçamento do bloco <fontes> na auditoria, menor que o padrão para sobrar espaço ao contrato. */
const CARACTERES_FONTES = 16_000;

export async function analisarContrato(input: {
  texto: string;
  perspectiva: Perspectiva;
  observacoes?: string;
  onEtapa?: ReportarEtapa;
  rastreio?: Rastreio;
}): Promise<ContractAnalysisData> {
  const etapa = input.onEtapa ?? (() => undefined);

  // O planejamento só precisa do começo do contrato para identificar o tipo e
  // os institutos; a análise em si recebe o texto completo.
  await etapa(ETAPAS_ANALISE[0]);
  const plano = await gerarEstruturado({
    schema: PlanoDeBusca,
    system: SISTEMA_PLANEJAMENTO,
    content: `<contrato>\n${input.texto.slice(0, 20_000)}\n</contrato>`,
    effort: "low",
    maxTokens: 2000,
    rastreio: input.rastreio,
  });

  await etapa(ETAPAS_ANALISE[1]);
  const fontes = await buscarFontes(plano.termos_busca, { limite: 24, maxCaracteres: CARACTERES_FONTES });

  const contexto = [
    [
      `<perspectiva>${PERSPECTIVAS[input.perspectiva]}</perspectiva>`,
      `<tipo_identificado>${plano.tipo}${plano.relacao_de_consumo ? " (relação de consumo aparente)" : ""}</tipo_identificado>`,
      input.observacoes ? `<observacoes_do_advogado>${input.observacoes}</observacoes_do_advogado>` : "",
      `<contrato>\n${input.texto}\n</contrato>`,
    ]
      .filter(Boolean)
      .join("\n"),
    formatarFontes(fontes),
  ];

  const especialista = (papel: string) =>
    gerarEstruturado({
      schema: RelatorioEspecialista,
      system: SISTEMA_EQUIPE,
      content: [...contexto, papel],
      effort: "high",
      maxTokens: 5000,
      rastreio: input.rastreio,
    });

  // Um depois do outro: a IA local atende uma chamada por vez de qualquer forma.
  await etapa(ETAPAS_ANALISE[2]);
  const analista = await especialista(PAPEL_ANALISTA);
  const pesquisador = await especialista(PAPEL_PESQUISADOR);

  await etapa(ETAPAS_ANALISE[3]);
  const parecer = await gerarEstruturado({
    schema: ParecerContrato,
    system: SISTEMA_EQUIPE,
    content: [
      ...contexto,
      [
        PAPEL_ESTRATEGISTA,
        `<relatorio_analista>\n${JSON.stringify(analista)}\n</relatorio_analista>`,
        `<relatorio_pesquisador>\n${JSON.stringify(pesquisador)}\n</relatorio_pesquisador>`,
      ].join("\n\n"),
    ],
    effort: "high",
    maxTokens: 8000,
    rastreio: input.rastreio,
  });

  // Pós-processamento: o modelo não pode citar fonte inexistente, e a nota
  // precisa ficar entre 0 e 100.
  parecer.nota_risco = Math.max(0, Math.min(100, Math.round(parecer.nota_risco)));
  for (const achado of parecer.achados) achado.fonte_ids = filtrarIds(achado.fonte_ids, fontes);
  // Cada fundamento é conferido no acervo: artigo encontrado vira fonte; inexistente vira alerta.
  const verificacao = await verificarCitacoes(
    parecer.achados.map((a) => a.fundamento),
    fontes,
  );
  parecer.achados.forEach((a, i) => (a.fonte_ids = [...new Set([...a.fonte_ids, ...verificacao.ids[i]])]));

  return {
    tipo: "analise",
    parecer,
    localizacao: parecer.achados.map((a) => localizarTrecho(input.texto, a.trecho)),
    fontes: fontesCitadas(
      verificacao.fontes,
      parecer.achados.flatMap((a) => a.fonte_ids),
    ),
    alertasCitacao: verificacao.alertas,
    equipe: {
      analista: analista.achados.length,
      pesquisador: pesquisador.achados.length,
      observacoes: [analista.observacoes, pesquisador.observacoes].filter((o) => o.trim()),
    },
    modelo: MODEL,
    geradoEm: new Date().toISOString(),
  };
}

const normalizarCaractere = (c: string) =>
  c.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").toLowerCase();

/**
 * Encontra a posição do trecho citado no texto original, tolerando diferenças
 * de espaços, aspas e travessões. Se o trecho inteiro não bater, tenta os
 * primeiros 60 caracteres. Devolve null quando não encontra.
 */
export function localizarTrecho(texto: string, trecho: string): { inicio: number; fim: number } | null {
  const agulha = normalizarCaractere(trecho).replace(/\s+/g, " ").trim();
  if (agulha.length < 12) return null;

  let palheiro = "";
  const mapa: number[] = [];
  let ultimoFoiEspaco = false;
  for (let i = 0; i < texto.length; i++) {
    if (/\s/.test(texto[i])) {
      if (!ultimoFoiEspaco && palheiro.length > 0) {
        palheiro += " ";
        mapa.push(i);
      }
      ultimoFoiEspaco = true;
    } else {
      // Mantém um caractere por posição para o mapa continuar alinhado.
      const normalizado = normalizarCaractere(texto[i]);
      palheiro += normalizado.length === 1 ? normalizado : texto[i];
      mapa.push(i);
      ultimoFoiEspaco = false;
    }
  }

  for (const alvo of [agulha, agulha.slice(0, 60)]) {
    const pos = palheiro.indexOf(alvo);
    if (pos >= 0) return { inicio: mapa[pos], fim: mapa[pos + alvo.length - 1] + 1 };
  }
  return null;
}
