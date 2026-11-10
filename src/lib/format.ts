const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlSemCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatBRL(cents: number, opts: { semCentavos?: boolean } = {}) {
  return (opts.semCentavos ? brlSemCentavos : brl).format(cents / 100);
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const dataLonga = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

export function formatDateTime(value: string | Date) {
  return dataHora.format(new Date(value));
}

export function formatLongDate(value: string | Date) {
  return dataLonga.format(new Date(value));
}

/** "R$ 1.234,56" ou "1234,56" → centavos. */
export function parseBRLToCents(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) return 0;
  const limpo = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cpfValido(cpf: string) {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digito = (base: string) => {
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

// Aceita o CNPJ alfanumérico (em vigor desde jul/2026): as 12 primeiras
// posições podem ter letras, e cada caractere vale (código ASCII - 48).
function cnpjValido(cnpj: string) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(cnpj.slice(0, 12)) === Number(cnpj[12]) && digito(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

/** Remove pontuação e mantém letras (CNPJ alfanumérico) em maiúsculas. */
export function normalizeCpfCnpj(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCpfCnpj(value: string) {
  const doc = normalizeCpfCnpj(value);
  return doc.length === 11 ? /^\d{11}$/.test(doc) && cpfValido(doc) : cnpjValido(doc);
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
