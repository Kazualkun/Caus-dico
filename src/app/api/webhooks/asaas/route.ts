import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents } from "@/db/schema";
import { aplicarEvento, type AsaasEvento } from "@/lib/billing/webhook";

/*
 * Webhook do Asaas (Integrações → Webhooks, versão v3).
 * - Autenticação: o token configurado no painel chega no header `asaas-access-token`.
 * - Entrega "at least once": o `id` do evento é gravado em billing_events e um
 *   evento já processado não é aplicado de novo.
 * - Responde 200 depois de persistir e aplicar; erro de processamento devolve
 *   500 para o Asaas reenviar.
 */

function tokenValido(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!tokenValido(request.headers.get("asaas-access-token"))) {
    return Response.json({ error: "token inválido" }, { status: 401 });
  }

  let evento: AsaasEvento;
  try {
    evento = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!evento?.id || !evento?.event) {
    return Response.json({ error: "evento sem id" }, { status: 400 });
  }

  try {
    const inserido = await db
      .insert(billingEvents)
      .values({ id: evento.id, event: evento.event, payload: evento })
      .onConflictDoNothing()
      .returning({ id: billingEvents.id });
    if (inserido.length === 0) {
      // Reentrega: só reaplica se a tentativa anterior não terminou.
      const [anterior] = await db.select({ processedAt: billingEvents.processedAt }).from(billingEvents).where(eq(billingEvents.id, evento.id));
      if (anterior?.processedAt) return Response.json({ ok: true, duplicado: true });
    }
  } catch (e) {
    console.error("[asaas] falha ao registrar evento", evento.id, e);
    return Response.json({ error: "falha ao registrar" }, { status: 500 });
  }

  try {
    const resultado = await aplicarEvento(db, evento);
    await db.update(billingEvents).set({ processedAt: new Date(), error: null }).where(eq(billingEvents.id, evento.id));
    return Response.json({ ok: true, resultado });
  } catch (e) {
    console.error("[asaas] falha ao processar", evento.id, e);
    await db.update(billingEvents).set({ error: String(e) }).where(eq(billingEvents.id, evento.id));
    return Response.json({ error: "falha ao processar" }, { status: 500 });
  }
}
