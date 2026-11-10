/**
 * Nomes pelos quais as normas mais citadas são conhecidas. Chave:
 * "<pasta do tipo>:<número sem pontos>:<ano>". Os demais nomes populares vêm
 * do normas.leg.br (campo alternateName) na etapa de enriquecimento oficial.
 */
const APELIDOS: Record<string, string> = {
  // Leis ordinárias
  "leis-ordinarias:10406:2002": "Código Civil",
  "leis-ordinarias:3071:1916": "Código Civil de 1916",
  "leis-ordinarias:8078:1990": "Código de Defesa do Consumidor (CDC)",
  "leis-ordinarias:13105:2015": "Código de Processo Civil (CPC)",
  "leis-ordinarias:5869:1973": "Código de Processo Civil de 1973",
  "leis-ordinarias:5172:1966": "Código Tributário Nacional (CTN)",
  "leis-ordinarias:9503:1997": "Código de Trânsito Brasileiro",
  "leis-ordinarias:4737:1965": "Código Eleitoral",
  "leis-ordinarias:12651:2012": "Código Florestal",
  "leis-ordinarias:8906:1994": "Estatuto da Advocacia e da OAB",
  "leis-ordinarias:8069:1990": "Estatuto da Criança e do Adolescente (ECA)",
  "leis-ordinarias:10741:2003": "Estatuto da Pessoa Idosa",
  "leis-ordinarias:13146:2015": "Estatuto da Pessoa com Deficiência (LBI)",
  "leis-ordinarias:10257:2001": "Estatuto da Cidade",
  "leis-ordinarias:10826:2003": "Estatuto do Desarmamento",
  "leis-ordinarias:8112:1990": "Estatuto dos Servidores Públicos Civis da União",
  "leis-ordinarias:13709:2018": "Lei Geral de Proteção de Dados (LGPD)",
  "leis-ordinarias:12965:2014": "Marco Civil da Internet",
  "leis-ordinarias:8245:1991": "Lei do Inquilinato",
  "leis-ordinarias:9307:1996": "Lei de Arbitragem",
  "leis-ordinarias:13140:2015": "Lei de Mediação",
  "leis-ordinarias:9099:1995": "Lei dos Juizados Especiais Cíveis e Criminais",
  "leis-ordinarias:10259:2001": "Lei dos Juizados Especiais Federais",
  "leis-ordinarias:12153:2009": "Lei dos Juizados Especiais da Fazenda Pública",
  "leis-ordinarias:14063:2020": "Lei das Assinaturas Eletrônicas",
  "leis-ordinarias:13874:2019": "Lei da Liberdade Econômica",
  "leis-ordinarias:11101:2005": "Lei de Recuperação Judicial e Falências",
  "leis-ordinarias:6404:1976": "Lei das Sociedades por Ações",
  "leis-ordinarias:11340:2006": "Lei Maria da Penha",
  "leis-ordinarias:8429:1992": "Lei de Improbidade Administrativa",
  "leis-ordinarias:11343:2006": "Lei de Drogas",
  "leis-ordinarias:12846:2013": "Lei Anticorrupção",
  "leis-ordinarias:12527:2011": "Lei de Acesso à Informação",
  "leis-ordinarias:12016:2009": "Lei do Mandado de Segurança",
  "leis-ordinarias:7347:1985": "Lei da Ação Civil Pública",
  "leis-ordinarias:7210:1984": "Lei de Execução Penal",
  "leis-ordinarias:14133:2021": "Lei de Licitações e Contratos Administrativos",
  "leis-ordinarias:8666:1993": "Lei de Licitações (1993)",
  "leis-ordinarias:8009:1990": "Lei do Bem de Família",
  "leis-ordinarias:9605:1998": "Lei de Crimes Ambientais",
  "leis-ordinarias:9279:1996": "Lei de Propriedade Industrial",
  "leis-ordinarias:9610:1998": "Lei de Direitos Autorais",
  "leis-ordinarias:9609:1998": "Lei do Software",
  "leis-ordinarias:6015:1973": "Lei de Registros Públicos",
  "leis-ordinarias:5478:1968": "Lei de Alimentos",
  "leis-ordinarias:14181:2021": "Lei do Superendividamento",
  "leis-ordinarias:13869:2019": "Lei de Abuso de Autoridade",
  "leis-ordinarias:13964:2019": "Pacote Anticrime",
  "leis-ordinarias:9613:1998": "Lei de Lavagem de Dinheiro",
  "leis-ordinarias:8072:1990": "Lei dos Crimes Hediondos",
  "leis-ordinarias:9455:1997": "Lei de Tortura",
  "leis-ordinarias:7716:1989": "Lei do Crime Racial",
  "leis-ordinarias:8080:1990": "Lei Orgânica da Saúde (SUS)",
  "leis-ordinarias:8213:1991": "Lei de Benefícios da Previdência Social",
  "leis-ordinarias:8212:1991": "Lei de Custeio da Seguridade Social",
  "leis-ordinarias:8036:1990": "Lei do FGTS",
  "leis-ordinarias:6019:1974": "Lei do Trabalho Temporário e da Terceirização",
  "leis-ordinarias:13467:2017": "Reforma Trabalhista",
  "leis-ordinarias:11788:2008": "Lei do Estágio",
  "leis-ordinarias:5764:1971": "Lei das Cooperativas",
  "leis-ordinarias:4591:1964": "Lei de Condomínios e Incorporações",
  "leis-ordinarias:8987:1995": "Lei de Concessões",
  "leis-ordinarias:11079:2004": "Lei das Parcerias Público-Privadas",
  "leis-ordinarias:9784:1999": "Lei do Processo Administrativo Federal",
  "leis-ordinarias:6830:1980": "Lei de Execução Fiscal",
  "leis-ordinarias:9514:1997": "Lei da Alienação Fiduciária de Imóveis",
  "leis-ordinarias:10931:2004": "Lei da Cédula de Crédito Bancário e do Patrimônio de Afetação",
  "leis-ordinarias:9394:1996": "Lei de Diretrizes e Bases da Educação (LDB)",
  "leis-ordinarias:4320:1964": "Lei de Normas Gerais de Direito Financeiro",
  "leis-ordinarias:9868:1999": "Lei da ADI e da ADC",
  "leis-ordinarias:9882:1999": "Lei da ADPF",
  "leis-ordinarias:13300:2016": "Lei do Mandado de Injunção",
  "leis-ordinarias:13465:2017": "Lei da Regularização Fundiária (Reurb)",
  "leis-ordinarias:12414:2011": "Lei do Cadastro Positivo",
  // Leis complementares
  "leis-complementares:123:2006": "Estatuto da Microempresa e Simples Nacional",
  "leis-complementares:101:2000": "Lei de Responsabilidade Fiscal",
  "leis-complementares:116:2003": "Lei do ISS",
  "leis-complementares:87:1996": "Lei Kandir (ICMS)",
  "leis-complementares:135:2010": "Lei da Ficha Limpa",
  "leis-complementares:64:1990": "Lei das Inelegibilidades",
  "leis-complementares:182:2021": "Marco Legal das Startups",
  "leis-complementares:214:2025": "Lei da Reforma Tributária do Consumo (IBS, CBS e IS)",
  // Decretos-leis
  "decretos-lei:2848:1940": "Código Penal",
  "decretos-lei:3689:1941": "Código de Processo Penal (CPP)",
  "decretos-lei:5452:1943": "Consolidação das Leis do Trabalho (CLT)",
  "decretos-lei:4657:1942": "Lei de Introdução às Normas do Direito Brasileiro (LINDB)",
  "decretos-lei:3688:1941": "Lei das Contravenções Penais",
  "decretos-lei:1001:1969": "Código Penal Militar",
  "decretos-lei:1002:1969": "Código de Processo Penal Militar",
  "decretos-lei:911:1969": "Lei da Alienação Fiduciária de Bens Móveis",
  "decretos-lei:3365:1941": "Lei de Desapropriação por Utilidade Pública",
  "decretos-lei:25:1937": "Lei do Tombamento",
  // Medidas provisórias e emendas
  "medidas-provisorias:22002:2001": "ICP-Brasil (assinatura digital)",
  "emendas-constitucionais:132:2023": "Reforma Tributária",
  "emendas-constitucionais:103:2019": "Reforma da Previdência",
  "emendas-constitucionais:45:2004": "Reforma do Judiciário",
};

/** Pares ["<pasta do tipo>:<número>:<ano>", nome] das normas mais citadas (usado para conferir citações). */
export const NORMAS_CONHECIDAS = Object.entries(APELIDOS);

export function apelidoConhecido(caminho: string, tipoSlug: string, numero: string | null, ano: number | null) {
  if (caminho === "constituicao.md") return "Constituição Federal de 1988";
  if (!numero || !ano) return null;
  return APELIDOS[`${tipoSlug}:${numero.replace(/\D/g, "")}:${ano}`] ?? null;
}

/** Escolhe um nome popular entre os nomes alternativos oficiais (normas.leg.br). */
export function apelidoDosNomesOficiais(nomes: string[]) {
  const candidatos = nomes
    .filter((n) => !/^[A-Z]+-[\dA-Z-]+$/.test(n)) // descarta identificadores como "LEI-8078-1990-09-11"
    .map((n) => n.replace(/\s*\(\d{4}\)/g, "").replace(/\s+/g, " ").trim())
    .filter((n) => n.length >= 4 && n.length <= 120);
  return candidatos.sort((a, b) => a.length - b.length)[0] ?? null;
}
