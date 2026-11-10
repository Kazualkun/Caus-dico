"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents } from "@/db/schema";
import { requirePapel } from "@/lib/auth";
import { aplicarEvento, type AsaasEvento } from "@/lib/billing/webhook";
import { registrarAuditoria } from "@/lib/registros";
import type { ActionState } from "@/lib/types";

/** Reaplica um evento do Asaas que falhou (depois de corrigida a causa). */
export async function reprocessarEvento(id: string): Promise<ActionState> {
  const ator = await requirePapel("administrador");
  const [evento] = await db.select().from(billingEvents).where(eq(billingEvents.id, id)).limit(1);
  if (!evento) return { error: "Evento não encontrado." };
  try {
    const resultado = await aplicarEvento(db, evento.payload as AsaasEvento);
    await db.update(billingEvents).set({ processedAt: new Date(), error: null }).where(eq(billingEvents.id, id));
    await registrarAuditoria({ ator, acao: "webhook.reprocessado", alvoTipo: "evento", alvoId: id, detalhes: { resultado } });
  } catch (e) {
    await db.update(billingEvents).set({ error: String(e) }).where(eq(billingEvents.id, id));
    return { error: `Falhou de novo: ${e instanceof Error ? e.message : e}` };
  }
  revalidatePath("/admin/assinaturas");
  return { ok: true, mensagem: "Evento aplicado." };
}
