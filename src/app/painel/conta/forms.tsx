"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormError, SubmitButton } from "@/components/form-bits";
import { UFS } from "@/lib/format";
import { atualizarPerfil, excluirConta } from "./actions";

export function PerfilForm({
  nome,
  oabNumber,
  oabUf,
  officeName,
}: {
  nome: string;
  oabNumber: string;
  oabUf: string;
  officeName: string;
}) {
  const [state, action] = useActionState(atualizarPerfil, undefined);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-folha p-5">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome completo</Label>
        <Input id="nome" name="nome" defaultValue={nome} required autoComplete="name" />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="oabNumber">Inscrição na OAB</Label>
          <Input id="oabNumber" name="oabNumber" defaultValue={oabNumber} inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oabUf">UF</Label>
          <select id="oabUf" name="oabUf" defaultValue={oabUf} className="h-9 w-full rounded-lg border border-input bg-folha px-2 text-sm">
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="officeName">Escritório (aparece nas propostas)</Label>
        <Input id="officeName" name="officeName" defaultValue={officeName} />
      </div>
      <FormError message={state?.error} />
      {state?.mensagem && (
        <p className="text-sm text-deferido" role="status">
          {state.mensagem}
        </p>
      )}
      <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
    </form>
  );
}

export function ExcluirContaForm({ email }: { email: string }) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState(excluirConta, undefined);

  if (!aberto) {
    return (
      <Button variant="destructive" onClick={() => setAberto(true)}>
        Excluir minha conta
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-lg border border-carimbo/40 bg-carimbo/5 p-4 text-sm">
      <p>
        A exclusão apaga seu perfil, contratos, propostas e pesquisas e cancela a renovação da assinatura. Por obrigação
        legal, o histórico de cobrança e os registros de acesso dos últimos 6 meses são mantidos, sem vínculo com o perfil.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="confirmacao">Para confirmar, digite o e-mail da conta ({email})</Label>
        <Input id="confirmacao" name="confirmacao" autoComplete="off" required />
      </div>
      <FormError message={state?.error} />
      <div className="flex gap-2">
        <SubmitButton variant="destructive" pendingText="Excluindo…">
          Excluir definitivamente
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => setAberto(false)}>
          Manter a conta
        </Button>
      </div>
    </form>
  );
}
