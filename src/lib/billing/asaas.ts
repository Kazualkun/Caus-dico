import "server-only";

/**
 * Cliente mínimo da API v3 do Asaas.
 * Autenticação pelo header `access_token`; `User-Agent` é obrigatório para
 * contas criadas a partir de 13/06/2024. Sandbox e produção usam chaves diferentes.
 */
const BASE_URL =
  process.env.ASAAS_ENV === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "causidico/1.0",
      access_token: process.env.ASAAS_API_KEY ?? "",
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const descricao = (body?.errors as { description?: string }[] | undefined)
      ?.map((e) => e.description)
      .filter(Boolean)
      .join("; ");
    throw new AsaasError(descricao || `O Asaas respondeu ${res.status}`, res.status, body);
  }
  return body as T;
}

export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
export type AsaasCycle = "MONTHLY" | "YEARLY";

export type AsaasCustomer = { id: string; name: string; cpfCnpj: string; email: string };

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: AsaasCycle;
  nextDueDate: string;
  billingType: AsaasBillingType;
};

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  billingType: AsaasBillingType;
  invoiceUrl: string;
  subscription?: string | null;
  externalReference?: string | null;
};

export function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  externalReference: string;
}) {
  return asaas<AsaasCustomer>("/customers", { method: "POST", body: JSON.stringify(input) });
}

export function createSubscription(input: {
  customer: string;
  billingType: AsaasBillingType;
  /** Em reais, não em centavos. */
  value: number;
  nextDueDate: string;
  cycle: AsaasCycle;
  description: string;
  externalReference: string;
}) {
  return asaas<AsaasSubscription>("/subscriptions", { method: "POST", body: JSON.stringify(input) });
}

export async function listSubscriptionPayments(subscriptionId: string) {
  const res = await asaas<{ data: AsaasPayment[] }>(`/subscriptions/${subscriptionId}/payments`);
  return res.data;
}

export function cancelSubscription(subscriptionId: string) {
  return asaas<{ deleted: boolean; id: string }>(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

/** Estorno integral de uma cobrança paga (direito de arrependimento). */
export function refundPayment(paymentId: string) {
  return asaas<AsaasPayment>(`/payments/${paymentId}/refund`, { method: "POST", body: JSON.stringify({}) });
}

/** Data de hoje em Brasília no formato AAAA-MM-DD, como o Asaas espera. */
export function hojeEmBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
