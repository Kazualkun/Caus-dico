"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { AREAS } from "@/lib/pricing/engine";
import { UFS } from "@/lib/format";
import { iniciarRecomendacao } from "./actions";

const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

const POLOS = [
  { valor: "autor", nome: "Autor", detalhe: "O cliente vai entrar com a ação ou pedir algo" },
  { valor: "reu", nome: "Réu", detalhe: "O cliente foi acionado e precisa se defender" },
];

export function PecaForm({ clientes, clienteInicial }: { clientes: { id: string; nome: string }[]; clienteInicial?: string }) {
  const [state, action] = useActionState(iniciarRecomendacao, undefined);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">O cliente é</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {POLOS.map((p, i) => (
            <label
              key={p.valor}
              className="flex cursor-pointer gap-2.5 rounded-lg border border-border bg-folha p-3 has-checked:border-tinta has-checked:bg-accent/60"
            >
              <input type="radio" name="polo" value={p.valor} defaultChecked={i === 0} className="mt-1 accent-tinta" />
              <span>
                <span className="block text-sm font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{p.detalhe}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[14rem_10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="area">Área</Label>
          <select id="area" name="area" defaultValue="civel" className={selectClasse}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uf">Leis estaduais</Label>
          <select id="uf" name="uf" defaultValue="" className={selectClasse}>
            <option value="">Só federal</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                Incluir {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clienteId">Cliente (opcional)</Label>
          <select id="clienteId" name="clienteId" defaultValue={clienteInicial ?? ""} className={selectClasse}>
            <option value="">Sem vínculo</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="titulo">Nome do caso (opcional)</Label>
        <Input id="titulo" name="titulo" placeholder="Ex.: Negativação indevida após quitação — Banco X" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fatos">Fatos do caso</Label>
        <Textarea
          id="fatos"
          name="fatos"
          rows={6}
          required
          minLength={80}
          maxLength={8000}
          className="texto-juridico text-base"
          placeholder="O que aconteceu, quando, quem são as partes (sem nomes), que documentos existem e, se o cliente é réu, o que foi pedido contra ele."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="objetivo">O que o cliente quer (opcional)</Label>
        <Textarea id="objetivo" name="objetivo" rows={2} maxLength={2000} placeholder="Ex.: retirar o nome do cadastro e ser indenizado." />
      </div>

      <p className="text-xs text-muted-foreground">
        A IA recomenda a peça, os requisitos legais, os fundamentos do acervo, os pedidos cabíveis e os prazos. Ela não redige a
        peça: a redação é sua. CPF, CNPJ, telefones e números de processo são mascarados antes da análise, que roda no próprio
        Causídico.
      </p>
      <FormError message={state?.error} />
      <SubmitButton size="lg" className="h-10 px-5" pendingText="Registrando…">
        Recomendar peça
      </SubmitButton>
    </form>
  );
}
