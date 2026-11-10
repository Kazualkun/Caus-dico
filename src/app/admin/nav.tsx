"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ItemAdmin = { href: string; nome: string };

export function NavAdmin({ itens }: { itens: ItemAdmin[] }) {
  const pathname = usePathname();
  // A seção atual é a de endereço mais específico ("/admin/acervo/curadoria" antes de "/admin/acervo").
  const atualHref = itens
    .filter((i) => (i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Administração" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {itens.map((i) => {
        const atual = i.href === atualHref;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-grafite",
              atual && "bg-accent font-medium text-tinta hover:bg-accent hover:text-tinta",
            )}
          >
            {i.nome}
          </Link>
        );
      })}
    </nav>
  );
}
