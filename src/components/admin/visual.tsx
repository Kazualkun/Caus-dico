import type { ReactNode } from "react";
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indicador: rótulo, valor (algarismos proporcionais) e um detalhe opcional. */
export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="space-y-1 bg-folha p-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-2xl font-semibold tracking-tight">{valor}</dd>
      {detalhe && <dd className="text-xs text-muted-foreground">{detalhe}</dd>}
    </div>
  );
}

export function LinhaDeIndicadores({ children }: { children: ReactNode }) {
  return (
    <dl className="grid overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-5" style={{ gap: 1 }}>
      {children}
    </dl>
  );
}

export type Estado = "ok" | "atencao" | "erro" | "andamento";

const ESTADOS: Record<Estado, { icone: typeof CircleCheckIcon; classe: string; nome: string }> = {
  ok: { icone: CircleCheckIcon, classe: "text-deferido", nome: "OK" },
  atencao: { icone: CircleAlertIcon, classe: "text-atencao", nome: "Atenção" },
  erro: { icone: CircleXIcon, classe: "text-carimbo", nome: "Erro" },
  andamento: { icone: LoaderIcon, classe: "text-tinta", nome: "Em andamento" },
};

/** Estado sempre com ícone e rótulo — nunca só a cor. */
export function SeloEstado({ estado, children }: { estado: Estado; children?: ReactNode }) {
  const e = ESTADOS[estado];
  const Icone = e.icone;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", e.classe)}>
      <Icone className={cn("size-4 shrink-0", estado === "andamento" && "animate-spin")} aria-hidden />
      <span>{children ?? e.nome}</span>
    </span>
  );
}

/** Tabela simples e acessível para as listas da administração. */
export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-folha">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {vazio ? (
            <tr>
              <td colSpan={cabecalho.length} className="px-3 py-6 text-center text-muted-foreground">
                Nada para mostrar.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Celula = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn("px-3 py-2 align-top", className)}>{children}</td>
);
