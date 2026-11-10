import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { PageSkeleton } from "@/components/app/page-parts";
import { getViewer, requirePapel, temPapel, type Papel, type Viewer } from "@/lib/auth";
import { NavAdmin, type ItemAdmin } from "./nav";

/** Nem o título da aba revela a área a quem não é da equipe. */
export async function generateMetadata(): Promise<Metadata> {
  if (!temPapel(await getViewer(), "suporte")) return { title: "Página não encontrada", robots: { index: false } };
  return { title: { default: "Administração", template: "%s | Administração | Causídico" } };
}

/*
 * O papel é conferido no topo do layout, antes de qualquer coisa ser enviada: sem
 * isso, a casca pré-renderizada (título e cabeçalho da área) sairia com HTTP 200
 * para qualquer pessoa logada. Quem não é da equipe recebe a página "não encontrada"
 * (o código HTTP fica 200, porque a casca do layout raiz já saiu). A área renderiza
 * a cada requisição, então pode bloquear a navegação até a conferência.
 *
 * O layout não protege as páginas sozinho: elas renderizam em paralelo com ele. Por
 * isso cada página da administração também confere o próprio papel na primeira linha.
 */
export const instant = false;

/** Seções da administração e o papel mínimo de cada uma. */
const SECOES: (ItemAdmin & { minimo: Papel })[] = [
  { href: "/admin", nome: "Visão geral", minimo: "suporte" },
  { href: "/admin/desempenho", nome: "Desempenho", minimo: "administrador" },
  { href: "/admin/faturamento", nome: "Faturamento", minimo: "administrador" },
  { href: "/admin/usuarios", nome: "Usuários", minimo: "suporte" },
  { href: "/admin/contato", nome: "Contato", minimo: "suporte" },
  { href: "/admin/ia", nome: "Tarefas e uso de IA", minimo: "suporte" },
  { href: "/admin/assinaturas", nome: "Assinaturas e pagamentos", minimo: "administrador" },
  { href: "/admin/acervo", nome: "Acervo", minimo: "administrador" },
  { href: "/admin/acervo/curadoria", nome: "Curadoria do acervo", minimo: "administrador" },
  { href: "/admin/lgpd", nome: "LGPD", minimo: "administrador" },
  { href: "/admin/auditoria", nome: "Auditoria", minimo: "administrador" },
  { href: "/admin/sistema", nome: "Sistema", minimo: "desenvolvedor" },
];

const NOME_PAPEL: Record<Papel, string> = {
  usuario: "Usuário",
  suporte: "Suporte",
  administrador: "Administrador(a)",
  desenvolvedor: "Desenvolvedor(a)",
};

function Navegacao({ viewer }: { viewer: Viewer }) {
  const itens = SECOES.filter((s) => temPapel(viewer, s.minimo)).map(({ href, nome }) => ({ href, nome }));
  return (
    <>
      <NavAdmin itens={itens} />
      <p className="mt-auto hidden border-t border-border p-4 text-xs text-muted-foreground lg:block">
        {viewer.fullName ?? viewer.email}
        <span className="block">{NOME_PAPEL[viewer.role]}</span>
      </p>
    </>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requirePapel("suporte");
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-border bg-folha lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between px-6 lg:block lg:h-auto lg:py-5">
          <Wordmark href="/admin" />
          <p className="hidden text-xs text-muted-foreground lg:mt-1 lg:block">Administração</p>
        </div>
        <Navegacao viewer={viewer} />
        <Link href="/painel" className="flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground hover:text-grafite lg:border-t lg:border-border">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Voltar ao painel
        </Link>
      </aside>
      <main id="conteudo" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
