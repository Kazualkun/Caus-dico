"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { responderContato } from "./actions";

export function ResponderContato({ id }: { id: string }) {
  const [state, action] = useActionState(responderContato, undefined);
  if (state?.ok) return <p className="text-sm text-deferido">{state.mensagem}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`resposta-${id}`} className="sr-only">
        Resposta
      </label>
      <Textarea id={`resposta-${id}`} name="resposta" rows={3} placeholder="Resposta que será enviada por e-mail" />
      <FormError message={state?.error} />
      <SubmitButton size="sm" pendingText="Enviando…">
        Responder
      </SubmitButton>
    </form>
  );
}
