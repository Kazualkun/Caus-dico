import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { auth, PAPEIS, type Papel } from "@/lib/better-auth";
import type { PlanId } from "@/lib/plans";
import type { SubscriptionRow } from "@/lib/types";

export type { Papel };

export type Viewer = {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  role: Papel;
  oabNumber: string | null;
  oabUf: string | null;
  officeName: string | null;
  cpfCnpj: string | null;
  phone: string | null;
  subscription: SubscriptionRow | null;
};

/** Assinante (ou equipe): `plano` define os limites de uso. */
export type Subscriber = Viewer & { plano: PlanId };

/** Usuário atual, com papel e assinatura. Memoizado por requisição. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao) return null;
  const u = sessao.user;
  if (u.blockedAt) return null; // conta bloqueada pela administração

  const [assinatura] = await db.select().from(subscriptions).where(eq(subscriptions.userId, u.id)).limit(1);
  const role = PAPEIS.includes(u.role as Papel) ? (u.role as Papel) : "usuario";

  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    fullName: u.name || null,
    role,
    oabNumber: u.oabNumber ?? null,
    oabUf: u.oabUf ?? null,
    officeName: u.officeName ?? null,
    cpfCnpj: u.cpfCnpj ?? null,
    phone: u.phone ?? null,
    subscription: assinatura ?? null,
  };
});

const NIVEL: Record<Papel, number> = { usuario: 0, suporte: 1, administrador: 2, desenvolvedor: 3 };

export function temPapel(viewer: Pick<Viewer, "role"> | null, minimo: Papel) {
  return Boolean(viewer) && NIVEL[viewer!.role] >= NIVEL[minimo];
}

/** Papéis que este usuário pode atribuir a outros (nunca acima do próprio). */
export function papeisAtribuiveis(viewer: Pick<Viewer, "role">): Papel[] {
  if (viewer.role === "desenvolvedor") return [...PAPEIS];
  if (viewer.role === "administrador") return ["usuario", "suporte"];
  return [];
}

const CARENCIA_RENOVACAO_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Acesso liberado quando a assinatura está ativa (com 5 dias de carência para
 * a confirmação da renovação) ou cancelada mas ainda dentro do período pago.
 */
export function hasActiveAccess(sub: SubscriptionRow | null, agora = new Date()) {
  if (!sub) return false;
  const fim = sub.currentPeriodEnd?.getTime() ?? null;
  if (sub.status === "ativa") return fim === null || fim + CARENCIA_RENOVACAO_MS > agora.getTime();
  if (sub.status === "cancelada") return fim !== null && fim > agora.getTime();
  return false;
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  // Só chega aqui quem tem cookie de sessão (o proxy barra quem não tem): a sessão
  // expirou, foi encerrada ou a conta foi bloqueada. O proxy limpa o cookie vencido.
  if (!viewer) redirect("/entrar?sessao=expirada");
  return viewer;
}

/** Módulos pagos: exige assinatura ativa. A equipe entra com os limites do plano Escritório. */
export async function requireSubscriber(): Promise<Subscriber> {
  const viewer = await requireViewer();
  if (viewer.subscription && hasActiveAccess(viewer.subscription)) {
    return { ...viewer, plano: viewer.subscription.plan };
  }
  if (temPapel(viewer, "suporte")) return { ...viewer, plano: "escritorio" };
  const aguardando = viewer.subscription?.status === "pendente" || viewer.subscription?.status === "inadimplente";
  redirect(aguardando ? "/assinatura/aguardando" : "/planos?assinar=1");
}

/** Área administrativa: quem não tem o papel recebe 404 (a área não se revela). */
export async function requirePapel(minimo: Papel): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!temPapel(viewer, minimo)) notFound();
  return viewer;
}
