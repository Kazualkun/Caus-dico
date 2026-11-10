"use client";

import { useActionState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

export type DadosCliente = {
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  origem: string;
  indicadoPor: string | null;
  observacoes: string | null;
};

export function ClienteForm({
  action,
  inicial,
  status,
  origens,
  rotulo,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  inicial?: DadosCliente;
  status: Record<string, string>;
  origens: Record<string, string>;
  rotulo: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-border bg-folha p-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={inicial?.nome} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefone">Telefone ou WhatsApp</Label>
        <Input id="telefone" name="telefone" inputMode="tel" defaultValue={inicial?.telefone ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={inicial?.email ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="documento">CPF ou CNPJ (opcional)</Label>
        <Input id="documento" name="documento" inputMode="numeric" defaultValue={inicial?.documento ?? ""} />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" name="cidade" defaultValue={inicial?.cidade ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ufCliente">UF</Label>
          <select id="ufCliente" name="uf" className={selectClasse} defaultValue={inicial?.uf ?? ""}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="statusCliente">Situação</Label>
        <select id="statusCliente" name="status" className={selectClasse} defaultValue={inicial?.status ?? "lead"}>
          {Object.entries(status).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="origem">Origem</Label>
        <select id="origem" name="origem" className={selectClasse} defaultValue={inicial?.origem ?? "indicacao"}>
          {Object.entries(origens).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="indicadoPor">Indicado por (opcional)</Label>
        <Input id="indicadoPor" name="indicadoPor" defaultValue={inicial?.indicadoPor ?? ""} placeholder="Ex.: Dra. Ana Souza (OAB/SP)" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={inicial?.observacoes ?? ""} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <FormError message={state?.error} />
        {state?.ok && <p className="text-sm text-deferido">{state.mensagem}</p>}
        <SubmitButton className="h-9 px-4" pendingText="Salvando…">
          {rotulo}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Seleção que salva na hora (situação da proposta, vínculo com cliente). */
export function SelecaoImediata({
  rotulo,
  valor,
  opcoes,
  vazio,
  action,
}: {
  rotulo: string;
  valor: string;
  opcoes: { valor: string; nome: string }[];
  vazio?: string;
  action: (valor: string) => Promise<unknown>;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{rotulo}</span>
      <select
        className={selectClasse}
        defaultValue={valor}
        disabled={pendente}
        onChange={(e) => {
          const v = e.target.value;
          iniciar(async () => {
            await action(v);
          });
        }}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
