"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { AREAS } from "@/lib/pricing/engine";
import { UFS } from "@/lib/format";
import { iniciarPesquisa } from "./actions";

const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

export function ResearchForm({ perguntaInicial, normaId }: { perguntaInicial?: string; normaId?: number }) {
  const [state, action] = useActionState(iniciarPesquisa, undefined);

  return (
    <form action={action} className="space-y-5">
      {normaId && <input type="hidden" name="normaId" value={normaId} />}
      <div className="space-y-1.5">
        <Label htmlFor="pergunta">Dúvida ou tese</Label>
        <Textarea
          id="pergunta"
          name="pergunta"
          rows={3}
          required
          minLength={15}
          defaultValue={perguntaInicial}
          className="texto-juridico text-base"
          placeholder="Ex.: Validade de assinatura eletrônica sem testemunhas em contrato bancário para fins de execução"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[14rem_10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="area">Área</Label>
          <select id="area" name="area" defaultValue="" className={selectClasse}>
            <option value="">Identificar automaticamente</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uf">Legislação estadual</Label>
          <select id="uf" name="uf" defaultValue="" className={selectClasse} aria-describedby="uf-ajuda">
            <option value="">Só federal</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                Incluir {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fatos">Fatos do caso</Label>
          <Textarea id="fatos" name="fatos" rows={2} placeholder="Opcional. Quanto mais concreto, mais útil a recomendação da peça." />
        </div>
      </div>
      <p id="uf-ajuda" className="text-xs text-muted-foreground">
        A pesquisa consulta a legislação federal, as súmulas e os temas do STF e do STJ. Escolha um estado para incluir também
        as leis estaduais dele. A pergunta e os fatos são processados pela IA do próprio Causídico, sem envio a provedores
        externos; mesmo assim, evite incluir dados pessoais que não sejam necessários.
      </p>
      <FormError message={state?.error} />
      <SubmitButton size="lg" className="h-10 px-5" pendingText="Registrando…">
        Pesquisar
      </SubmitButton>
    </form>
  );
}
