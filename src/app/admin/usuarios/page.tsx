import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-parts";
import { Celula, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Usuários" };

async function Lista({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  await requirePapel("suporte");
  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";
  const lista = await db
    .select({
      id: users.id,
      nome: users.name,
      email: users.email,
      role: users.role,
      bloqueado: users.blockedAt,
      criado: users.createdAt,
      plano: subscriptions.plan,
      status: subscriptions.status,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(termo ? or(ilike(users.email, `%${termo}%`), ilike(users.name, `%${termo}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <form method="get" className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <Input id="q" name="q" defaultValue={termo} placeholder="Nome ou e-mail" />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
      <Tabela cabecalho={["Nome", "E-mail", "Papel", "Plano", "Cadastro"]} vazio={lista.length === 0}>
        {lista.map((u) => (
          <tr key={u.id} className="hover:bg-muted/40">
            <Celula>
              <Link href={`/admin/usuarios/${u.id}`} className="font-medium hover:text-tinta hover:underline">
                {u.nome}
              </Link>
              {u.bloqueado && <span className="ml-2 text-xs text-carimbo">bloqueado</span>}
            </Celula>
            <Celula className="text-muted-foreground">{u.email}</Celula>
            <Celula>{u.role ?? "usuario"}</Celula>
            <Celula>{u.plano ? `${PLANS[u.plano].nome} (${u.status})` : "—"}</Celula>
            <Celula className="whitespace-nowrap text-muted-foreground">{formatDateTime(u.criado)}</Celula>
          </tr>
        ))}
      </Tabela>
      <p className="text-xs text-muted-foreground">Mostrando até 100 usuários, dos mais recentes para os mais antigos.</p>
    </div>
  );
}

export default async function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("suporte");
  return (
    <>
      <PageHeader title="Usuários" description="Contas, papéis e assinaturas." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </>
  );
}
