"use client";

import { useActionState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { ASSUNTOS_TRIAGEM } from "@/lib/triagem";
import { UFS } from "@/lib/format";
import { enviarTriagem } from "./actions";

const selectClasse = "h-10 w-full rounded-lg border border-input bg-folha px-2.5 text-base sm:text-sm";

export function TriagemForm({ codigo, advogado }: { codigo: string; advogado: string }) {
  const [state, action] = useActionState(enviarTriagem.bind(null, codigo), undefined);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center" role="status">
        <CircleCheckIcon className="mx-auto size-10 text-deferido" aria-hidden />
        <h2 className="font-serif text-xl font-semibold">Respostas enviadas</h2>
        <p className="text-muted-foreground">
          {advogado} recebeu as informações do seu caso e vai entrar em contato pelo telefone informado. Se for urgente, fale
          diretamente com o escritório.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* Campo invisível contra robôs. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Site
          <input type="text" name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nome">Seu nome</Label>
          <Input id="nome" name="nome" required autoComplete="name" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone ou WhatsApp, com DDD</Label>
          <Input id="telefone" name="telefone" required inputMode="tel" autoComplete="tel" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail (opcional)</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cidade">Cidade (opcional)</Label>
          <Input id="cidade" name="cidade" autoComplete="address-level2" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uf">Estado (opcional)</Label>
          <select id="uf" name="uf" defaultValue="" className={selectClasse}>
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
        <Label htmlFor="assunto">Sobre o que é o seu caso?</Label>
        <select id="assunto" name="assunto" defaultValue="" required className={selectClasse}>
          <option value="" disabled>
            Escolha uma opção
          </option>
          {ASSUNTOS_TRIAGEM.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="relato">Conte o que aconteceu</Label>
        <Textarea
          id="relato"
          name="relato"
          rows={6}
          required
          minLength={30}
          maxLength={6000}
          placeholder="Explique com suas palavras: o que houve, com quem (empresa, órgão ou pessoa) e o que já foi feito."
          className="text-base sm:text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quando">Quando aconteceu? (opcional)</Label>
          <Input id="quando" name="quando" placeholder="Ex.: março de 2026" className="h-10" />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Tem documentos, prints ou contratos?</legend>
          <div className="flex gap-4 pt-1.5 text-sm">
            {[
              ["sim", "Sim"],
              ["nao", "Não"],
              ["nao_sei", "Não sei"],
            ].map(([valor, nome]) => (
              <label key={valor} className="flex items-center gap-1.5">
                <input type="radio" name="temDocumentos" value={valor} defaultChecked={valor === "nao_sei"} className="accent-tinta" />
                {nome}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="objetivo">O que você espera resolver? (opcional)</Label>
        <Textarea id="objetivo" name="objetivo" rows={2} maxLength={1000} className="text-base sm:text-sm" />
      </div>

      <label className="flex gap-2.5 text-sm">
        <input type="checkbox" name="aceite" required className="mt-1 accent-tinta" />
        <span>
          Li o aviso abaixo e concordo em enviar estas informações a {advogado} para a análise do meu caso e o contato.
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Não envie documentos pessoais, senhas nem informações de saúde por aqui: o advogado pede o que for necessário depois.
      </p>
      <FormError message={state?.error} />
      <SubmitButton size="lg" className="h-11 w-full" pendingText="Enviando…">
        Enviar respostas
      </SubmitButton>
    </form>
  );
}
