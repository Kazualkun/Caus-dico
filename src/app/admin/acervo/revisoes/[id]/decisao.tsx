"use client";

import { useActionState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/types";

type Acao = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Concluido({ mensagem }: { mensagem?: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-deferido/30 bg-deferido/5 p-4 text-sm" role="status">
      <CircleCheckIcon className="size-4 text-deferido" aria-hidden />
      {mensagem}
    </p>
  );
}

export function AprovarForm({ acao, divergente }: { acao: Acao; divergente: boolean }) {
  const [state, action] = useActionState(acao, undefined);
  if (state?.ok) return <Concluido mensagem={state.mensagem} />;
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-folha p-5">
      <h3 className="font-medium">Aprovar e publicar</h3>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="conferiu" required className="mt-1 accent-tinta" />
        <span>
          Abri a fonte oficial e conferi que o texto e os dados correspondem a ela, incluindo a vigência dos artigos alterados.
        </span>
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="parecer">{divergente ? "Por que o texto está correto apesar da divergência" : "Observação (opcional)"}</Label>
        <Textarea
          id="parecer"
          name="parecer"
          rows={3}
          required={divergente}
          minLength={divergente ? 20 : undefined}
          placeholder={divergente ? "Ex.: a página oficial ainda não incorporou a Lei 14.905/2024; conferi no DOU de 01/07/2024." : undefined}
        />
      </div>
      <FormError message={state?.error} />
      <SubmitButton pendingText="Publicando…">Aprovar e publicar</SubmitButton>
    </form>
  );
}

export function RejeitarForm({ acao }: { acao: Acao }) {
  const [state, action] = useActionState(acao, undefined);
  if (state?.ok) return <Concluido mensagem={state.mensagem} />;
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-folha p-5">
      <h3 className="font-medium">Rejeitar</h3>
      <div className="space-y-1.5">
        <Label htmlFor="motivo">Motivo</Label>
        <Textarea id="motivo" name="motivo" rows={3} required minLength={10} placeholder="O que precisa ser corrigido antes de reenviar." />
      </div>
      <FormError message={state?.error} />
      <SubmitButton variant="outline" pendingText="Registrando…">
        Rejeitar
      </SubmitButton>
    </form>
  );
}
