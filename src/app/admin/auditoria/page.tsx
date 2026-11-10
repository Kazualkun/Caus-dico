import { Suspense } from "react";
import type { Metadata } from "next";
import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-parts";
import { Celula, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

async function Trilha({ searchParams }: { searchParams: PageProps<"/admin/auditoria">["searchParams"] }) {
  await requirePapel("administrador");
  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";
  const eventos = await db
    .select()
    .from(auditLog)
    .where(termo ? or(ilike(auditLog.acao, `%${termo}%`), ilike(auditLog.atorEmail, `%${termo}%`), ilike(auditLog.alvoId, `%${termo}%`)) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(200);
  return (
    <div className="space-y-4">
      <form method="get" className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Filtrar por ação, pessoa ou alvo
        </label>
        <Input id="q" name="q" defaultValue={termo} placeholder="Ação, e-mail de quem fez ou ID do alvo" />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      <Tabela cabecalho={["Quando", "Quem", "Ação", "Alvo", "Detalhes"]} vazio={eventos.length === 0}>
        {eventos.map((e) => (
          <tr key={e.id}>
            <Celula className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Celula>
            <Celula>{e.atorEmail ?? "sistema"}</Celula>
            <Celula className="font-mono text-xs">{e.acao}</Celula>
            <Celula className="text-muted-foreground">{e.alvoTipo ? `${e.alvoTipo} ${e.alvoId ?? ""}` : "—"}</Celula>
            <Celula className="max-w-xs font-mono text-xs text-muted-foreground">
              {Object.keys(e.detalhes).length ? JSON.stringify(e.detalhes) : ""}
            </Celula>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}

export default async function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <>
      <PageHeader title="Auditoria" description="Quem fez o quê: papéis, bloqueios, cancelamentos, exportações e exclusões de conta, reprocessamentos." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Trilha searchParams={searchParams} />
      </Suspense>
    </>
  );
}
