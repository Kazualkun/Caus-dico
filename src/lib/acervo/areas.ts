/**
 * Classificação automática por área do direito, a partir de título, nome
 * popular, ementa e indexação oficial. Serve para navegar e filtrar o acervo;
 * a tela identifica que a classificação é automática.
 */
import type { Esfera } from "./parser";

const sa = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const AREAS_DIREITO = [
  { id: "constitucional", nome: "Constitucional", termos: /\bconstitui(cao|cional)|emenda constitucional|direitos fundamentais|controle (concentrado|de constitucionalidade)\b/ },
  { id: "civil", nome: "Civil", termos: /\bcodigo civil|\bcontrat|\bobrigac|responsabilidade civil|\bposse\b|usucapi|direito real|propriedade (imovel|movel)|\bdoac(ao|oes)\b|\bmandato\b/ },
  { id: "familia", nome: "Família e sucessões", termos: /\bcasamento|divorci|uniao estavel|\balimentos?\b|guarda (compartilhada|de filhos)|\bsucess(ao|oes)|heranca|testament|inventario|paternidade|adoc(ao|oes)/ },
  { id: "consumidor", nome: "Consumidor", termos: /consumidor|relac(ao|oes) de consumo|\bfornecedor|\bprocon\b|superendividamento/ },
  { id: "trabalhista", nome: "Trabalhista", termos: /trabalh|\bempregad|\bemprego|salari|sindica|\bclt\b|\bfgts\b|jornada|ferias|estagio/ },
  { id: "previdenciario", nome: "Previdenciário", termos: /previdenci|aposentadoria|\binss\b|pensao por morte|seguridade social|beneficio previdenciario/ },
  { id: "tributario", nome: "Tributário", termos: /tribut|\bimposto|\bicms\b|\biss\b|\biptu\b|\bipva\b|\bipi\b|imposto de renda|contribuic(ao|oes) (social|sociais|de melhoria|previdenciaria)|\btaxa\b|isenc(ao|oes)|credito tributario|\bfiscal\b|receita federal|\bcbs\b|\bibs\b/ },
  { id: "penal", nome: "Penal e processo penal", termos: /\bpenal|\bcrime|criminal|\bpena\b|\bpenas\b|prisao|delito|contravenc|execucao penal|inquerito policial/ },
  { id: "processual", nome: "Processo civil", termos: /processo civil|processual|juizados especiais|\brecurso|acao civil publica|mandado de (seguranca|injuncao)|tutela (provisoria|de urgencia)|execucao (civil|de titulo)/ },
  { id: "administrativo", nome: "Administrativo", termos: /servidor(es)? public|\bcargos?\b|licitac|administracao publica|concurso publico|autarquia|improbidade|\bconcess(ao|oes) de servico|estrutura organizacional|quadro de pessoal/ },
  { id: "empresarial", nome: "Empresarial", termos: /\bempresa|sociedade(s)? (anonima|limitada|empresaria)|falencia|recuperacao judicial|comercial|junta comercial|titulos? de credito|duplicata|microempresa|startup/ },
  { id: "financeiro", nome: "Bancário e mercado financeiro", termos: /bancari|instituic(ao|oes) financeira|banco central|conselho monetario|cambio|mercado de capitais|valores mobiliarios|cedula de credito|operac(ao|oes) de credito|cooperativas? de credito/ },
  { id: "ambiental", nome: "Ambiental", termos: /ambient|floresta|florestal|recursos hidricos|\baguas\b|fauna|flora|poluic|saneamento|residuos solidos|unidade de conservacao/ },
  { id: "digital", nome: "Digital e proteção de dados", termos: /internet|dados pessoais|protecao de dados|\blgpd\b|assinatura(s)? (eletronica|digital)|certificado digital|chaves publicas|icp-brasil|documento eletronico|software|informatica/ },
  { id: "imobiliario", nome: "Imobiliário e urbanístico", termos: /\bimove(l|is)\b|imobiliari|locac(ao|oes)|inquilin|condominio|incorporac(ao|oes) imobiliaria|loteamento|parcelamento do solo|plano diretor|zoneamento|regularizacao fundiaria|registro de imoveis/ },
  { id: "saude", nome: "Saúde", termos: /\bsaude\b|\bsus\b|hospital|medicament|vigilancia sanitaria|anvisa|epidemi|vacina/ },
  { id: "educacao", nome: "Educação", termos: /educac|\bensino|\bescola|universidade|professor|\bestudante/ },
  { id: "transito", nome: "Trânsito e transportes", termos: /transito|\bveiculos?\b|rodovi|transporte (publico|coletivo|de passageiros|de cargas)|habilitac(ao|oes) para conduzir/ },
  { id: "eleitoral", nome: "Eleitoral", termos: /eleitor|eleic(ao|oes)|partido(s)? politico|inelegibilidade|propaganda eleitoral/ },
  { id: "agrario", nome: "Agrário", termos: /agrari|\brural\b|reforma agraria|terras devolutas|agropecu|\bposseiro/ },
  { id: "seguranca", nome: "Segurança pública", termos: /policia|seguranca publica|bombeiro|guarda municipal|\barmas? de fogo|sistema prisional|penitenciari/ },
  { id: "orcamento", nome: "Orçamento e finanças públicas", termos: /orcament|diretrizes orcamentarias|\bldo\b|\bloa\b|plano plurianual|credito (suplementar|especial|adicional)|responsabilidade fiscal|divida publica/ },
  { id: "homenagens", nome: "Homenagens, denominações e datas", termos: /\bdenomina|utilidade publica|cidad(ao|a) honorari|titulo de cidad|institui o dia|\bdia (estadual|municipal|nacional) d|data comemorativa|calendario (oficial|de eventos)|homenage|semana (estadual|municipal) d/ },
] as const;

export type AreaId = (typeof AREAS_DIREITO)[number]["id"];

export function nomeDaArea(id: string) {
  return AREAS_DIREITO.find((a) => a.id === id)?.nome ?? id;
}

export function classificarAreas(n: {
  titulo: string;
  apelido: string | null;
  ementa: string | null;
  indexacao: string | null;
  esfera: Esfera;
  tipoSlug: string;
}): string[] {
  const texto = sa([n.apelido, n.titulo, n.ementa, n.indexacao].filter(Boolean).join(" \n "));
  const encontradas: string[] = [];
  if (n.tipoSlug === "constituicao" || n.tipoSlug === "emendas-constitucionais") encontradas.push("constitucional");
  if (n.esfera === "jurisprudencia" && n.tipoSlug === "controle-concentrado") encontradas.push("constitucional");
  for (const area of AREAS_DIREITO) {
    if (encontradas.length >= 4) break;
    if (!encontradas.includes(area.id) && area.termos.test(texto)) encontradas.push(area.id);
  }
  // Homenagens e denominações são excludentes: não misturar com as áreas técnicas.
  return encontradas.includes("homenagens") ? ["homenagens"] : encontradas;
}
