import { Suspense } from "react";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { AppNav } from "@/components/app/nav";
import { PageSkeleton } from "@/components/app/page-parts";
import { RodapeCompacto } from "@/components/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer, getViewer, temPapel } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { sair } from "@/app/(auth)/actions";

async function LoginGate({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return children;
}

/** Navegação com o item de administração para quem é da equipe. */
async function NavDoUsuario() {
  const viewer = await getViewer();
  return <AppNav equipe={temPapel(viewer, "suporte")} />;
}

async function ContaResumo() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const plano = viewer.subscription ? PLANS[viewer.subscription.plan].nome : "Sem plano";
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href="/painel/conta" className="min-w-0 text-sm hover:text-tinta">
        <span className="block truncate font-medium">{viewer.fullName ?? viewer.email}</span>
        <span className="block text-xs text-muted-foreground">Plano {plano}</span>
      </Link>
      <form action={sair}>
        <button
          type="submit"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-grafite"
          aria-label="Sair"
          title="Sair"
        >
          <LogOutIcon className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-border bg-folha lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center px-6">
          <Wordmark href="/painel" />
        </div>
        <Suspense fallback={<AppNav estatico />}>
          <NavDoUsuario />
        </Suspense>
        <div className="mt-auto hidden border-t border-border p-4 lg:block">
          <Suspense fallback={<Skeleton className="h-9 w-full" />}>
            <ContaResumo />
          </Suspense>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageSkeleton />}>
            <LoginGate>{children}</LoginGate>
          </Suspense>
          <RodapeCompacto className="mt-16 border-t border-border pt-6" />
        </div>
      </main>
    </div>
  );
}
