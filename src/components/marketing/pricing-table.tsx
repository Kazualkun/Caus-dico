"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { PLAN_IDS, PLANS, type Cycle } from "@/lib/plans";

export function PricingTable() {
  const [ciclo, setCiclo] = useState<Cycle>("mensal");

  return (
    <div className="space-y-8">
      <div role="radiogroup" aria-label="Ciclo de cobrança" className="inline-flex rounded-lg border border-border bg-folha p-1 text-sm">
        {(["mensal", "anual"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ciclo === c}
            onClick={() => setCiclo(c)}
            className={cn(
              "rounded-md px-4 py-1.5 transition-colors",
              ciclo === c ? "bg-tinta text-white" : "text-muted-foreground hover:text-grafite",
            )}
          >
            {c === "mensal" ? "Mensal" : "Anual, com 2 meses sem custo"}
          </button>
        ))}
      </div>

      <div className="grid overflow-hidden rounded-xl border border-border bg-folha md:grid-cols-3">
        {PLAN_IDS.map((id, i) => {
          const plano = PLANS[id];
          const destaque = id === "profissional";
          const preco = ciclo === "anual" ? plano.precoAnualCents : plano.precoMensalCents;
          return (
            <section
              key={id}
              aria-labelledby={`plano-${id}`}
              className={cn(
                "flex flex-col gap-5 p-6 sm:p-7",
                i > 0 && "border-t border-border md:border-t-0 md:border-l",
                destaque && "bg-accent/50",
              )}
            >
              <header className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 id={`plano-${id}`} className="font-serif text-xl font-semibold">
                    {plano.nome}
                  </h3>
                  {destaque && <span className="text-xs font-medium text-tinta">Mais escolhido</span>}
                </div>
                <p className="text-sm text-muted-foreground">{plano.publico}</p>
              </header>
              <p>
                <span className="font-serif text-3xl font-semibold">{formatBRL(preco, { semCentavos: true })}</span>
                <span className="text-sm text-muted-foreground">{ciclo === "anual" ? " por ano" : " por mês"}</span>
              </p>
              <ul className="space-y-2 text-sm">
                {plano.destaques.map((d) => (
                  <li key={d} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-deferido" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" variant={destaque ? "default" : "outline"} className="mt-auto h-10">
                <Link href={`/assinatura/checkout?plano=${id}&ciclo=${ciclo}`}>Assinar o {plano.nome}</Link>
              </Button>
            </section>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Pagamento por Pix, cartão de crédito ou boleto, processado pelo Asaas. Com Pix e cartão, o acesso é liberado assim que
        o pagamento é confirmado. Cancele quando quiser, sem multa.
      </p>
    </div>
  );
}
