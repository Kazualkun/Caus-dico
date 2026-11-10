"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import { RAMOS, type Ramo } from "@/lib/prazos/calculo";
import { adicionarDiaSemExpediente, criarProcesso } from "./actions";

const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

export function NovoProcessoForm({ clientes, clienteInicial }: { clientes: { id: string; nome: string }[]; clienteInicial?: string }) {
  const [state, action] = useActionState(criarProcesso, undefined);
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border bg-folha p-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="titulo">Nome do processo</Label>
        <Input id="titulo" name="titulo" required placeholder="Ex.: Indenização — Maria x Banco" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="numero">Número (opcional)</Label>
        <Input id="numero" name="numero" inputMode="numeric" placeholder="0000000-00.0000.0.00.0000" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ramo">Ramo</Label>
        <select id="ramo" name="ramo" className={selectClasse} defaultValue="civel">
          {(Object.keys(RAMOS) as Ramo[]).map((r) => (
            <option key={r} value={r}>
              {RAMOS[r].nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="orgao">Vara ou tribunal (opcional)</Label>
        <Input id="orgao" name="orgao" placeholder="Ex.: 3ª Vara Cível de Campinas" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clienteProcesso">Cliente (opcional)</Label>
        <select id="clienteProcesso" name="clienteId" className={selectClasse} defaultValue={clienteInicial ?? ""}>
          <option value="">Sem vínculo</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormError message={state?.error} />
        <SubmitButton className="h-9 px-4" pendingText="Criando…">
          Criar processo
        </SubmitButton>
      </div>
    </form>
  );
}

export function DiaSemExpedienteForm() {
  const [state, action] = useActionState(adicionarDiaSemExpediente, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-border bg-folha p-4 sm:grid-cols-[10rem_1fr_12rem_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="dataDia">Data</Label>
        <Input id="dataDia" name="data" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="descricaoDia">Descrição</Label>
        <Input id="descricaoDia" name="descricao" required placeholder="Ex.: Feriado municipal de Campinas" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tipoDia">Tipo</Label>
        <select id="tipoDia" name="tipo" className={selectClasse} defaultValue="sem_expediente">
          <option value="sem_expediente">Sem expediente</option>
          <option value="reduzido">Expediente reduzido</option>
        </select>
      </div>
      <SubmitButton className="h-9 px-4" pendingText="Salvando…">
        Adicionar
      </SubmitButton>
      <div className="sm:col-span-4">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}
