"use client";

import { useActionState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { registrarSolicitacao } from "./actions";

const TIPOS = [
  ["confirmacao", "Confirmar se vocês tratam meus dados"],
  ["acesso", "Acessar meus dados"],
  ["correcao", "Corrigir dados incompletos ou desatualizados"],
  ["anonimizacao", "Anonimizar, bloquear ou eliminar dados desnecessários"],
  ["portabilidade", "Levar meus dados para outro fornecedor"],
  ["exclusao", "Excluir meus dados"],
  ["compartilhamento", "Saber com quem meus dados foram compartilhados"],
  ["revogacao", "Revogar um consentimento"],
  ["oposicao", "Me opor a um tratamento"],
  ["outro", "Outro assunto sobre meus dados"],
] as const;

export function SolicitacaoForm({ nome, email }: { nome?: string; email?: string }) {
  const [state, action] = useActionState(registrarSolicitacao, undefined);

  if (state?.ok) {
    return (
      <p className="flex gap-2 rounded-lg border border-deferido/30 bg-deferido/5 p-4 text-sm" role="status">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-deferido" aria-hidden />
        {state.mensagem ?? "Solicitação registrada."}
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
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" name="nome" defaultValue={nome} required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail para a resposta</Label>
          <Input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tipo">O que você quer fazer</Label>
        <select id="tipo" name="tipo" required defaultValue="" className="h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm">
          <option value="" disabled>
            Escolha uma opção
          </option>
          {TIPOS.map(([valor, nome]) => (
            <option key={valor} value={valor}>
              {nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="descricao">Detalhes (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={4} placeholder="Ex.: quais dados, de qual período, ou o motivo do pedido." />
      </div>
      <p className="text-xs text-muted-foreground">
        Usamos seu nome e e-mail só para responder a esta solicitação e comprovar que ela foi atendida (LGPD, arts. 18 e 37).
      </p>
      <FormError message={state?.error} />
      <SubmitButton pendingText="Enviando…">Enviar solicitação</SubmitButton>
    </form>
  );
}
