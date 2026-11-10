/**
 * Dados do fornecedor e versões dos documentos legais.
 *
 * A empresa ainda não foi aberta. Os campos `null` aparecem no site como "em
 * constituição" ou "a definir", sem inventar dados, e o painel Sistema lista o
 * que falta. Preencha todos antes do lançamento (Decreto 7.962/2013, art. 2º;
 * LGPD, art. 41). Ver AUDITORIA-JURIDICA.md.
 */
type Empresa = {
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  /** Endereço completo com CEP. */
  endereco: string | null;
  emailAtendimento: string | null;
  /** Telefone ou WhatsApp de atendimento. */
  telefone: string | null;
  /** Encarregado pelo tratamento de dados (DPO). Sem ele, o canal é o formulário /privacidade/solicitacao. */
  encarregado: { nome: string; email: string } | null;
  /** Comarca da sede, para a cláusula de foro dos Termos. */
  foro: string | null;
  /** Fornecedores de hospedagem e banco de dados, com país ou região. */
  hospedagem: string;
};

export const EMPRESA: Empresa = {
  nomeFantasia: "Causídico",
  razaoSocial: null,
  cnpj: null,
  endereco: null,
  emailAtendimento: null,
  telefone: null,
  encarregado: null,
  foro: null,
  hospedagem: "banco de dados PostgreSQL no Neon (região a definir) e hospedagem da aplicação a definir",
};

/** Como os dados de identificação aparecem no site enquanto a empresa está em constituição. */
export const EXIBIR = {
  razaoSocial: EMPRESA.razaoSocial ?? `${EMPRESA.nomeFantasia} (empresa em constituição)`,
  cnpj: EMPRESA.cnpj ?? "em constituição",
  endereco: EMPRESA.endereco ?? "endereço a definir na abertura da empresa",
};

/** O que ainda falta preencher antes do lançamento (painel Sistema e relatório). */
export function dadosFaltantes() {
  const faltam: string[] = [];
  if (!EMPRESA.razaoSocial) faltam.push("razão social");
  if (!EMPRESA.cnpj) faltam.push("CNPJ");
  if (!EMPRESA.endereco) faltam.push("endereço");
  if (!EMPRESA.emailAtendimento) faltam.push("e-mail de atendimento");
  if (!EMPRESA.telefone) faltam.push("telefone");
  if (!EMPRESA.encarregado) faltam.push("encarregado de dados");
  if (!EMPRESA.foro) faltam.push("foro");
  return faltam;
}

export const VERSAO_TERMOS = "2026-11-02";
export const VERSAO_PRIVACIDADE = "2026-11-02";
export const DATA_DOCUMENTOS = "2 de novembro de 2026";
