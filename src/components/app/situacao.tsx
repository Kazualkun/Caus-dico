import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";
import type { StatusCliente } from "@/lib/crm";
import { STATUS_CLIENTE } from "@/lib/crm";
import { cn } from "@/lib/utils";

/*
 * Situação de um item nas listas: sempre ícone e rótulo, nunca só a cor.
 */

type Tom = "tinta" | "atencao" | "carimbo" | "deferido" | "neutro";

const TOM: Record<Tom, string> = {
  tinta: "text-tinta",
  atencao: "text-atencao",
  carimbo: "text-carimbo",
  deferido: "text-deferido",
  neutro: "text-muted-foreground",
};

function Selo({ tom, icone: Icone, children, className }: { tom: Tom; icone: typeof ClockIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", TOM[tom], className)}>
      <Icone className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** Nota de risco da auditoria (0 a 100): alto a partir de 60, médio a partir de 30. */
export function SeloRisco({ nota, className }: { nota: number; className?: string }) {
  const [tom, icone, nivel]: [Tom, typeof ClockIcon, string] =
    nota >= 60 ? ["carimbo", TriangleAlertIcon, "alto"] : nota >= 30 ? ["atencao", CircleAlertIcon, "médio"] : ["deferido", CircleCheckIcon, "baixo"];
  return (
    <Selo tom={tom} icone={icone} className={className}>
      Risco {nivel}, {nota}/100
    </Selo>
  );
}

/** Tarefa de IA: em andamento, com erro ou concluída (a auditoria concluída mostra o risco). */
export function SituacaoTarefa({
  status,
  risco,
  feminino = true,
  className,
}: {
  status: "processando" | "concluido" | "erro";
  risco?: number | null;
  feminino?: boolean;
  className?: string;
}) {
  if (status === "processando") {
    return (
      <Selo tom="tinta" icone={ClockIcon} className={className}>
        Em andamento
      </Selo>
    );
  }
  if (status === "erro") {
    return (
      <Selo tom="carimbo" icone={CircleXIcon} className={className}>
        {feminino ? "Não concluída" : "Não concluído"}
      </Selo>
    );
  }
  if (risco != null) return <SeloRisco nota={risco} className={className} />;
  return (
    <Selo tom="deferido" icone={CircleCheckIcon} className={className}>
      {feminino ? "Concluída" : "Concluído"}
    </Selo>
  );
}

const TOM_CLIENTE: Record<StatusCliente, string> = {
  lead: "border-tinta/30 bg-accent text-tinta",
  negociacao: "border-atencao/30 bg-atencao/10 text-atencao",
  cliente: "border-deferido/30 bg-deferido/10 text-deferido",
  encerrado: "border-border bg-muted text-muted-foreground",
  perdido: "border-carimbo/25 bg-carimbo/5 text-carimbo",
};

/** Etapa do cliente no funil do CRM. */
export function SeloCliente({ status }: { status: StatusCliente }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TOM_CLIENTE[status])}>
      {STATUS_CLIENTE[status]}
    </span>
  );
}
