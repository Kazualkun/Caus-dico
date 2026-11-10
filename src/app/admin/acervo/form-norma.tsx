"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { ESFERA_NOME, nomeDoTipo, TIPOS_FILTRO } from "@/lib/acervo/catalogo";
import type { Esfera } from "@/lib/acervo/parser";
import type { DadosNorma } from "@/lib/acervo/tipos-curadoria";
import { UFS } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const ESFERAS = Object.keys(ESFERA_NOME) as Esfera[];
const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

export function FormNorma({
  acao,
  inicial,
  texto,
  fonte,
  edicao,
}: {
  acao: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  inicial?: DadosNorma;
  texto?: string;
  fonte?: string | null;
  edicao?: boolean;
}) {
  const [state, action] = useActionState(acao, undefined);
  const [esfera, setEsfera] = useState<Esfera>(inicial?.esfera ?? "federal");
  // A categoria de uma norma existente entra na lista mesmo fora das categorias de filtro,
  // para salvar a edição sem trocá-la por engano.
  const categorias =
    inicial?.tipoSlug && !TIPOS_FILTRO.some((t) => t.slug === inicial.tipoSlug)
      ? [...TIPOS_FILTRO, { slug: inicial.tipoSlug, nome: nomeDoTipo(inicial.tipoSlug) }]
      : TIPOS_FILTRO;

  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4 rounded-lg border border-border bg-folha p-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-sm font-medium">Identificação</legend>
        <div className="space-y-1.5">
          <Label htmlFor="esfera">Esfera</Label>
          <select id="esfera" name="esfera" value={esfera} onChange={(e) => setEsfera(e.target.value as Esfera)} className={selectClasse}>
            {ESFERAS.map((e) => (
              <option key={e} value={e}>
                {ESFERA_NOME[e]}
              </option>
            ))}
          </select>
        </div>
        {(esfera === "estadual" || esfera === "municipal") && (
          <div className="space-y-1.5">
            <Label htmlFor="uf">UF</Label>
            <select id="uf" name="uf" defaultValue={inicial?.uf ?? ""} required className={selectClasse}>
              <option value="" disabled>
                Escolha
              </option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        )}
        {esfera === "municipal" && (
          <div className="space-y-1.5">
            <Label htmlFor="municipio">Município</Label>
            <Input id="municipio" name="municipio" defaultValue={inicial?.municipio ?? ""} required />
          </div>
        )}
        {(esfera === "jurisprudencia" || esfera === "regulador") && (
          <div className="space-y-1.5">
            <Label htmlFor="orgao">{esfera === "jurisprudencia" ? "Tribunal" : "Órgão"}</Label>
            <Input id="orgao" name="orgao" defaultValue={inicial?.orgao ?? ""} placeholder={esfera === "jurisprudencia" ? "STJ" : "ANPD"} required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="tipoSlug">Categoria</Label>
          <select id="tipoSlug" name="tipoSlug" defaultValue={inicial?.tipoSlug ?? ""} className={selectClasse}>
            <option value="">Outra (usa o tipo)</option>
            {categorias.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Input id="tipo" name="tipo" defaultValue={inicial?.tipo ?? ""} placeholder="Lei Ordinária" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" name="numero" defaultValue={inicial?.numero ?? ""} placeholder="8078" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data">Data de assinatura</Label>
          <Input id="data" name="data" type="date" defaultValue={inicial?.data ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ano">Ano (se não houver data)</Label>
          <Input id="ano" name="ano" inputMode="numeric" defaultValue={inicial?.data ? "" : (inicial?.ano ?? "")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" name="titulo" defaultValue={inicial?.titulo ?? ""} placeholder="Lei nº 8.078, de 11 de setembro de 1990" required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="apelido">Nome popular (opcional)</Label>
          <Input id="apelido" name="apelido" defaultValue={inicial?.apelido ?? ""} placeholder="Código de Defesa do Consumidor" />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="ementa">Ementa oficial</Label>
          <Textarea id="ementa" name="ementa" rows={2} defaultValue={inicial?.ementa ?? ""} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="situacao">Situação (opcional)</Label>
          <Input id="situacao" name="situacao" defaultValue={inicial?.situacao ?? ""} placeholder="Não consta revogação expressa" />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="revogada" defaultChecked={inicial?.revogada} className="accent-tinta" />
          Revogada
        </label>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="fonte">Link da fonte oficial</Label>
        <Input
          id="fonte"
          name="fonte"
          type="url"
          defaultValue={fonte ?? ""}
          placeholder="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
          required
          aria-describedby="fonte-ajuda"
        />
        <p id="fonte-ajuda" className="text-xs text-muted-foreground">
          Página oficial com o texto (gov.br, leg.br, jus.br, mp.br ou def.br). O texto abaixo é conferido automaticamente com ela, artigo
          por artigo, ignorando o que estiver riscado (revogado) na página.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="texto">Texto integral</Label>
        <Textarea
          id="texto"
          name="texto"
          rows={18}
          defaultValue={texto ?? ""}
          required
          className="font-mono text-xs leading-relaxed"
          aria-describedby="texto-ajuda"
        />
        <p id="texto-ajuda" className="text-xs text-muted-foreground">
          Um parágrafo por linha. Artigos começando com “Art. 1º”; títulos e capítulos em linhas próprias. Negrito com **asteriscos** é aceito.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="justificativa">{edicao ? "O que mudou e por quê" : "Por que incluir"}</Label>
        <Textarea
          id="justificativa"
          name="justificativa"
          rows={2}
          required
          placeholder={edicao ? "Ex.: o art. 49 estava sem o parágrafo incluído pela Lei 14.181/2021." : "Ex.: lei publicada no DOU de hoje, ainda fora do acervo."}
        />
      </div>

      <FormError message={state?.error} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Conferindo com a fonte oficial…">{edicao ? "Enviar correção para revisão" : "Enviar inclusão para revisão"}</SubmitButton>
        <p className="text-xs text-muted-foreground">Nada é publicado até outro administrador ou desenvolvedor aprovar.</p>
      </div>
    </form>
  );
}
