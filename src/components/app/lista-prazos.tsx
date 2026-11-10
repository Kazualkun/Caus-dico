import Link from "next/link";
import { ActionButton, ConfirmActionButton } from "@/components/form-bits";
import { cn } from "@/lib/utils";
import { calcularPrazo, diasAte, formatarData, type DiaInformado } from "@/lib/prazos/calculo";
import { excluirPrazo, marcarPrazo } from "@/app/painel/(modulos)/prazos/actions";
import type { PrazoRow } from "@/lib/types";

function Situacao({ vencimento, cumprido }: { vencimento: string; cumprido: boolean }) {
  if (cumprido) return <span className="text-deferido">Cumprido</span>;
  const n = diasAte(vencimento);
  if (n < 0) return <span className="font-medium text-carimbo">Vencido há {-n} dia{n === -1 ? "" : "s"}</span>;
  if (n === 0) return <span className="font-medium text-carimbo">Vence hoje</span>;
  if (n === 1) return <span className="font-medium text-atencao">Vence amanhã</span>;
  return <span className={cn(n <= 5 ? "text-atencao" : "text-muted-foreground")}>Em {n} dias</span>;
}

/**
 * Prazos salvos, do mais próximo ao mais distante. Se os dias sem expediente
 * cadastrados mudaram depois do cálculo, o vencimento é refeito e o advogado
 * vê o aviso.
 */
export function ListaPrazos({
  prazos,
  diasInformados,
  processos,
}: {
  prazos: PrazoRow[];
  diasInformados: DiaInformado[];
  processos?: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
      {prazos.map((p) => {
        const atual = calcularPrazo({ ...p.parametros, diasInformados }).vencimento;
        const mudou = atual !== p.vencimento && !p.cumpridoEm;
        return (
          <li key={p.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <p className={cn("font-medium", p.cumpridoEm && "text-muted-foreground line-through")}>{p.descricao}</p>
              <p className="text-sm text-muted-foreground">
                Vence em <span>{formatarData(p.vencimento, true)}</span> ·{" "}
                <Situacao vencimento={p.vencimento} cumprido={Boolean(p.cumpridoEm)} />
                {p.processoId && processos?.get(p.processoId) && (
                  <>
                    {" · "}
                    <Link href={`/painel/prazos/processos/${p.processoId}`} className="text-tinta underline underline-offset-2">
                      {processos.get(p.processoId)}
                    </Link>
                  </>
                )}
              </p>
              {mudou && (
                <p className="text-sm text-atencao">
                  Com os dias sem expediente cadastrados agora, o vencimento seria {formatarData(atual, true)}. Confira.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <ActionButton size="sm" variant="outline" action={marcarPrazo.bind(null, p.id, !p.cumpridoEm)} pendingText="…">
                {p.cumpridoEm ? "Reabrir" : "Marcar cumprido"}
              </ActionButton>
              <ConfirmActionButton size="sm" variant="ghost" action={excluirPrazo.bind(null, p.id)} confirmText="Excluir este prazo?">
                Excluir
              </ConfirmActionButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
