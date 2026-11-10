"use client";

import { useActionState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { ASSUNTOS_CONTATO } from "@/lib/contato";
import { enviarContato } from "./actions";

export function ContatoForm({ nome, email, assunto }: { nome?: string; email?: string; assunto?: string }) {
  const [state, action] = useActionState(enviarContato, undefined);

  if (state?.ok) {
    return (
      <p className="flex gap-2 rounded-lg border border-deferido/30 bg-deferido/5 p-4 text-sm" role="status">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-deferido" aria-hidden />
        {state.mensagem}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="hidden" aria-hidden>
        <label>
          Site <input name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" defaultValue={nome} required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail para a resposta</Label>
          <Input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assunto">Assunto</Label>
        <select
          id="assunto"
          name="assunto"
          required
          defaultValue={assunto && assunto in ASSUNTOS_CONTATO ? assunto : ""}
          className="h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm"
        >
          <option value="" disabled>
            Escolha uma opção
          </option>
          {Object.entries(ASSUNTOS_CONTATO).map(([valor, nome]) => (
            <option key={valor} value={valor}>
              {nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mensagem">Mensagem</Label>
        <Textarea id="mensagem" name="mensagem" rows={6} required minLength={10} maxLength={5000} />
      </div>
      <p className="text-xs text-muted-foreground">
        Usamos seu nome e e-mail só para responder a esta mensagem. Ela fica guardada por até 2 anos depois da resposta (veja a{" "}
        <a href="/privacidade" className="underline underline-offset-2">
          Política de Privacidade
        </a>
        ). Não envie dados de clientes nem documentos sigilosos por aqui.
      </p>
      <FormError message={state?.error} />
      <SubmitButton pendingText="Enviando…">Enviar mensagem</SubmitButton>
    </form>
  );
}
