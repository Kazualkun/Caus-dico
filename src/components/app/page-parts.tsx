import type { ReactNode } from "react";
import { CheckIcon, CircleIcon, Loader2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SituacaoFila } from "@/lib/ai/fila";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl space-y-1.5">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  );
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** "menos de 1 min", "cerca de 4 min", "cerca de 1 h 20 min". */
export function tempoAproximado(seg: number) {
  if (seg < 60) return "menos de 1 min";
  const min = Math.round(seg / 60);
  return `cerca de ${min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`}`;
}

/** Andamento de uma tarefa de IA, etapa por etapa, com a posição na fila. */
export function JobProgress({
  etapas,
  atual,
  estimativa,
  travada,
  fila,
  acao,
}: {
  etapas: readonly string[];
  atual: string | null;
  estimativa: string;
  travada: boolean;
  fila?: SituacaoFila | null;
  acao?: ReactNode;
}) {
  const indice = atual ? etapas.indexOf(atual) : -1;
  const naFila = !travada && fila?.estado === "na_fila" ? fila : null;

  return (
    <div className="folha max-w-xl space-y-5 p-6 sm:p-8">
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold">{travada ? "O processamento parou" : naFila ? "Na fila" : "Em andamento"}</h2>
        <p className="text-sm text-muted-foreground">
          {travada
            ? "Esta tarefa passou do tempo esperado e provavelmente foi interrompida. Tente de novo; ela não conta duas vezes no seu limite."
            : `${estimativa} Você pode sair desta página: o resultado fica salvo no histórico.`}
        </p>
      </div>
      <ol className="space-y-3" aria-live="polite">
        {etapas.map((etapa, i) => {
          const feita = i < indice;
          const corrente = i === indice && !travada;
          return (
            <li key={etapa} className="flex items-center gap-3 text-sm">
              {feita ? (
                <CheckIcon className="size-4 text-deferido" aria-hidden />
              ) : corrente ? (
                <Loader2Icon className="size-4 animate-spin text-tinta" aria-hidden />
              ) : (
                <CircleIcon className="size-4 text-border" aria-hidden />
              )}
              <span className={cn(feita && "text-muted-foreground", corrente && "font-medium text-grafite", !feita && !corrente && "text-muted-foreground")}>
                {etapa}
              </span>
            </li>
          );
        })}
      </ol>
      {naFila ? (
        <div className="rounded-md bg-muted/60 px-4 py-3 text-sm" aria-live="polite">
          <p className="font-medium text-grafite">
            {naFila.aFrente === 0 ? "Você é o próximo da fila." : `Na fila: ${naFila.aFrente} ${naFila.aFrente === 1 ? "pedido" : "pedidos"} na sua frente.`}
          </p>
          <p className="text-muted-foreground">
            Começa em {tempoAproximado(naFila.inicioEmSeg)} e termina em {tempoAproximado(naFila.fimEmSeg)}.
          </p>
        </div>
      ) : !travada && fila?.estado === "processando" ? (
        <p className="text-sm text-muted-foreground">
          {fila.atrasada ? "Está levando mais que o normal; o resultado aparece aqui assim que ficar pronto." : `Previsão de término: ${tempoAproximado(fila.fimEmSeg)}.`}
        </p>
      ) : (
        indice === -1 && !travada && <p className="text-sm text-muted-foreground">Na fila para começar…</p>
      )}
      {acao}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
