import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: o sinal de parágrafo (§), o símbolo mais cotidiano do texto legal. */
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2 text-grafite outline-offset-4", className)}
      aria-label="Causídico, página inicial"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-[3px] bg-tinta font-serif text-lg leading-none text-white"
      >
        §
      </span>
      <span className="font-serif text-lg font-semibold tracking-tight">Causídico</span>
    </Link>
  );
}
