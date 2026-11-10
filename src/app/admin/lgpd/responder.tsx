"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { responderSolicitacao } from "./actions";

export function ResponderSolicitacao({ id }: { id: string }) {
  const [state, action] = useActionState(responderSolicitacao, undefined);
  if (state?.ok) return <p className="text-sm text-deferido">{state.mensagem}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`resposta-${id}`} className="sr-only">
        Resposta ao titular
      </label>
      <Textarea id={`resposta-${id}`} name="resposta" rows={3} placeholder="Resposta que será enviada por e-mail ao titular" />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`status-${id}`} className="sr-only">
          Situação
        </label>
        <select id={`status-${id}`} name="status" defaultValue="concluida" className="h-8 rounded-lg border border-input bg-folha px-2 text-sm">
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
          <option value="indeferida">Indeferida (com motivo)</option>
        </select>
        <SubmitButton size="sm" pendingText="Enviando…">
          Registrar
        </SubmitButton>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
