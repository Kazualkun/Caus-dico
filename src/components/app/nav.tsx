"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenTextIcon,
  CalculatorIcon,
  CalendarClockIcon,
  FileTextIcon,
  LayoutGridIcon,
  LibraryIcon,
  MessageCircleIcon,
  ScaleIcon,
  ShieldIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/painel", nome: "Painel", icone: LayoutGridIcon, exato: true },
  { href: "/painel/clientes", nome: "Clientes", icone: UsersRoundIcon },
  { href: "/painel/honorarios", nome: "Honorários", icone: CalculatorIcon },
  { href: "/painel/contratos", nome: "Contratos", icone: FileTextIcon },
  { href: "/painel/pecas", nome: "Peças", icone: ScaleIcon },
  { href: "/painel/pesquisa", nome: "Pesquisa com IA", icone: BookOpenTextIcon },
  { href: "/painel/prazos", nome: "Prazos", icone: CalendarClockIcon },
  { href: "/painel/acervo", nome: "Acervo de legislação", icone: LibraryIcon },
  { href: "/painel/conta", nome: "Minha conta", icone: UserRoundIcon },
  { href: "/contato", nome: "Fale conosco", icone: MessageCircleIcon },
];

const ADMIN = { href: "/admin", nome: "Administração", icone: ShieldIcon };

export function AppNav({ estatico = false, equipe = false }: { estatico?: boolean; equipe?: boolean }) {
  return estatico ? <Lista ativo={null} equipe={equipe} /> : <NavComRotaAtiva equipe={equipe} />;
}

function NavComRotaAtiva({ equipe }: { equipe: boolean }) {
  const pathname = usePathname();
  return <Lista ativo={pathname} equipe={equipe} />;
}

function Lista({ ativo, equipe }: { ativo: string | null; equipe: boolean }) {
  const itens = equipe ? [...ITENS, ADMIN] : ITENS;
  const nav = useRef<HTMLElement>(null);
  // No celular a lista rola na horizontal: traz a aba atual para a vista.
  useEffect(() => {
    const el = nav.current;
    const atual = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && atual && el.scrollWidth > el.clientWidth) el.scrollLeft = atual.offsetLeft - (el.clientWidth - atual.offsetWidth) / 2;
  }, [ativo]);
  return (
    <nav
      ref={nav}
      aria-label="Módulos"
      className="flex gap-1 overflow-x-auto px-3 pb-3 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0 lg:[mask-image:none]"
    >
      {itens.map(({ href, nome, icone: Icone, ...resto }) => {
        const exato = "exato" in resto && resto.exato;
        const atual = ativo !== null && (exato ? ativo === href : ativo.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-grafite",
              atual && "bg-accent font-medium text-tinta hover:bg-accent hover:text-tinta",
            )}
          >
            <Icone className="size-4" aria-hidden />
            {nome}
          </Link>
        );
      })}
    </nav>
  );
}
