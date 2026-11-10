import { renderToBuffer } from "@react-pdf/renderer";
import { getViewer } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pricingProposals } from "@/db/schema";
import { PropostaPdf } from "@/lib/pdf/proposal-pdf";

export async function GET(_request: Request, ctx: RouteContext<"/api/propostas/[id]/pdf">) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "proposta não encontrada" }, { status: 404 });
  // Só o dono encontra a proposta.
  const [proposta] = await db
    .select()
    .from(pricingProposals)
    .where(and(eq(pricingProposals.id, id), eq(pricingProposals.userId, viewer.id)))
    .limit(1);
  if (!proposta) return Response.json({ error: "proposta não encontrada" }, { status: 404 });

  const pdf = await renderToBuffer(
    PropostaPdf({
      proposta,
      advogado: {
        nome: viewer.fullName ?? viewer.email,
        oab: viewer.oabNumber ? `${viewer.oabNumber}${viewer.oabUf ? `/${viewer.oabUf}` : ""}` : null,
        escritorio: viewer.officeName,
        email: viewer.email,
      },
    }),
  );

  const arquivo = `proposta-${proposta.clientName}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
