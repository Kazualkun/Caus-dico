"use client";

import { useActionState, useState } from "react";
import { CircleCheckIcon, FileUpIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { AREAS, COMPLEXIDADES, RISCOS, type Complexidade, type Risco } from "@/lib/pricing/engine";
import { analisarCasoComIa } from "./actions";

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export type SugestaoCaso = { area: string; complexidade: Complexidade; risco: Risco };

/**
 * Para quem ainda não tem segurança em classificar o caso: a IA lê o resumo
 * e/ou o arquivo e sugere área, complexidade e risco, que o advogado confere
 * antes de aplicar. Nada do que é enviado fica guardado.
 */
export function AnaliseCaso({ onAplicar }: { onAplicar: (s: SugestaoCaso) => void }) {
  const [state, action, pendente] = useActionState(analisarCasoComIa, undefined);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string>();
  const [aplicada, setAplicada] = useState<object | null>(null);
  const a = state?.analise;

  return (
    <section aria-labelledby="titulo-analise-caso" className="space-y-4 rounded-lg border border-border bg-folha p-5">
      <div className="space-y-1">
        <h2 id="titulo-analise-caso" className="font-serif text-lg font-semibold">
          Análise do caso com IA
        </h2>
        <p className="text-sm text-muted-foreground">
          Em dúvida sobre a complexidade e o risco? Descreva o caso ou envie o arquivo. A IA sugere a área, a complexidade e o
          risco, com a justificativa, para você conferir antes de usar.
        </p>
      </div>

      <form
        action={(dados) => {
          setAplicada(null);
          const arquivo = dados.get("arquivo");
          if (arquivo instanceof File && arquivo.size > TAMANHO_MAXIMO) return setErroArquivo("O arquivo passa de 10 MB.");
          setErroArquivo(undefined);
          setNomeArquivo(null);
          return action(dados);
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="resumo">Resumo do caso</Label>
          <Textarea
            id="resumo"
            name="resumo"
            rows={4}
            maxLength={8000}
            placeholder="Ex.: o cliente quitou o financiamento do carro em 2024, mas o banco manteve o nome dele negativado por 8 meses. Tem os comprovantes e a carta de quitação. Perdeu um financiamento imobiliário por isso."
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm hover:border-tinta has-focus-visible:ring-2 has-focus-visible:ring-ring/50">
          <FileUpIcon className="size-5 shrink-0 text-tinta" aria-hidden />
          <span>
            <span className="block font-medium">{nomeArquivo ?? "Anexar o arquivo do caso (opcional)"}</span>
            <span className="block text-xs text-muted-foreground">PDF com texto, DOCX ou TXT, até 10 MB.</span>
          </span>
          <input
            type="file"
            name="arquivo"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-deferido" aria-hidden />
          <span>
            Análise anônima: o texto e o arquivo são lidos só para esta análise e descartados em seguida, sem ficar no banco
            de dados nem no histórico. CPF, CNPJ, e-mails, telefones, CEPs e números de processo são mascarados antes da
            leitura pela IA, que roda no próprio Causídico. Evite escrever nomes.
          </span>
        </p>
        <FormError message={erroArquivo ?? state?.error} />
        <SubmitButton className="h-9 px-4" disabled={pendente} pendingText="Analisando… pode levar até um minuto">
          Analisar caso
        </SubmitButton>
      </form>

      {a && (
        <div className="space-y-4 border-t border-border pt-4" aria-live="polite">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Área</dt>
              <dd className="font-medium">{AREAS.find((x) => x.id === a.area)?.nome ?? a.area}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Complexidade</dt>
              <dd className="font-medium">{COMPLEXIDADES[a.complexidade].nome}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Risco</dt>
              <dd className="font-medium">{RISCOS[a.risco].nome}</dd>
            </div>
          </dl>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Por que essa complexidade: </span>
              {a.justificativa_complexidade}
            </p>
            <p>
              <span className="font-medium">Por que esse risco: </span>
              {a.justificativa_risco}
            </p>
          </div>
          {a.pontos_de_atencao.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Pontos de atenção</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {a.pontos_de_atencao.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {a.informacoes_faltantes.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Para avaliar melhor, falta saber</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {a.informacoes_faltantes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {(state?.mascarados || state?.truncado) && (
            <p className="text-xs text-muted-foreground">
              {state.mascarados ? `${state.mascarados} dado(s) pessoal(is) foram mascarados antes da análise. ` : ""}
              {state.truncado ? "O texto era longo e só os primeiros 40 mil caracteres foram analisados." : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={aplicada === a ? "outline" : "default"}
              onClick={() => {
                onAplicar({ area: a.area, complexidade: a.complexidade, risco: a.risco });
                setAplicada(a);
              }}
            >
              Usar na calculadora
            </Button>
            {aplicada === a && (
              <span className="flex items-center gap-1.5 text-sm text-deferido">
                <CircleCheckIcon className="size-4" aria-hidden />
                Área, complexidade e risco aplicados. Você pode ajustar abaixo.
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">É uma sugestão para apoiar sua avaliação, não um parecer. Confira antes de usar.</p>
        </div>
      )}
    </section>
  );
}
