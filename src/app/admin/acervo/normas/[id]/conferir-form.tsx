"use client";

import { useActionState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/types";

export function ConferirForm({ acao, fonte }: { acao: (prev: ActionState, formData: FormData) => Promise<ActionState>; fonte: string | null }) {
  const [state, action] = useActionState(acao, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fonte-conferencia">Fonte oficial para conferir</Label>
        <Input id="fonte-conferencia" name="fonte" type="url" defaultValue={fonte ?? ""} required placeholder="https://www.planalto.gov.br/…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="justificativa-conferencia">Observação (opcional)</Label>
        <Input id="justificativa-conferencia" name="justificativa" placeholder="Ex.: conferência após a Lei 14.181/2021" />
      </div>
      {state?.ok && (
        <p className="flex items-center gap-2 text-sm text-deferido" role="status">
          <CircleCheckIcon className="size-4" aria-hidden />
          {state.mensagem}
        </p>
      )}
      <FormError message={state?.error} />
      <SubmitButton variant="outline" pendingText="Conferindo…">
        Conferir com a fonte oficial
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Se todos os artigos baterem, a conferência é registrada na hora. Se não, vai para a revisão de outra pessoa, que confere manualmente.
      </p>
    </form>
  );
}
