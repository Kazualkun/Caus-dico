"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import { cn } from "@/lib/utils";
import { formatBRL, formatPercent, parseBRLToCents, UFS } from "@/lib/format";
import {
  AREAS,
  COMPLEXIDADES,
  FORMATOS,
  RISCOS,
  calcularHonorarios,
  dividirValor,
  minimoOab,
  type BillingFormat,
  type Complexidade,
  type PricingInputs,
  type PricingResult,
  type Risco,
} from "@/lib/pricing/engine";
import type { OabReferenceRow } from "@/lib/types";
import { salvarProposta } from "./actions";
import { AnaliseCaso } from "./analise-caso";

const numero = (valor: string) => Number(valor.replace(/\./g, "").replace(",", ".")) || 0;
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Para onde vai o valor cobrado do cliente: impostos, repasse por indicação e o líquido do advogado. */
function DivisaoDoValor({ brutoCents, inputs, rotulo }: { brutoCents: number; inputs: PricingInputs; rotulo: string }) {
  const d = dividirValor(brutoCents, inputs);
  const linhas: [string, number][] = [
    [`Impostos (${formatPercent(inputs.impostoPercentual ?? 0)})`, -d.impostoCents],
    ...((inputs.repassePercentual ?? 0) > 0
      ? ([[`Repasse por indicação (${formatPercent(inputs.repassePercentual ?? 0)})`, -d.repasseCents]] as [string, number][])
      : []),
  ];
  return (
    <div className="space-y-1.5 p-5 text-sm">
      <p className="font-medium">Para onde vai o valor</p>
      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{rotulo}</dt>
          <dd>{formatBRL(d.brutoCents)}</dd>
        </div>
        {linhas.map(([nome, valor]) => (
          <div key={nome} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{nome}</dt>
            <dd>{formatBRL(valor)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
          <dt>Fica com você</dt>
          <dd>{formatBRL(d.liquidoCents)}</dd>
        </div>
      </dl>
    </div>
  );
}
const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

function Campo({ id, label, ajuda, children }: { id: string; label: string; ajuda?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

function Segmentado<T extends string>({
  legenda,
  ajuda,
  opcoes,
  valor,
  onChange,
}: {
  legenda: string;
  ajuda?: string;
  opcoes: { valor: T; nome: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legenda}</legend>
      <div className="flex overflow-hidden rounded-lg border border-input bg-folha">
        {opcoes.map((o, i) => (
          <label
            key={o.valor}
            className={cn(
              "flex-1 cursor-pointer px-2 py-2 text-center text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
              i > 0 && "border-l border-input",
              valor === o.valor ? "bg-tinta text-white" : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={`segmentado-${legenda}`}
              className="sr-only"
              checked={valor === o.valor}
              onChange={() => onChange(o.valor)}
            />
            {o.nome}
          </label>
        ))}
      </div>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </fieldset>
  );
}

function ResumoFormato({ formato, r }: { formato: BillingFormat; r: PricingResult }) {
  const f = r.formatos[formato];
  switch (formato) {
    case "fixo":
      return <span>{formatBRL(f.valorCents, { semCentavos: true })}</span>;
    case "exito":
      return (
        <span className="text-right">
          {formatPercent(f.percentual ?? 0)}
          <span className="block text-xs text-muted-foreground">
            esperado {formatBRL(f.valorEsperadoCents ?? 0, { semCentavos: true })}
          </span>
        </span>
      );
    case "misto":
      return (
        <span className="text-right">
          {formatBRL(f.valorFixoCents ?? 0, { semCentavos: true })} + {formatPercent(f.percentual ?? 0)}
          <span className="block text-xs text-muted-foreground">
            esperado {formatBRL(f.valorEsperadoCents ?? 0, { semCentavos: true })}
          </span>
        </span>
      );
    case "hora":
      return (
        <span className="text-right">
          {formatBRL(r.valorHoraEfetivoCents, { semCentavos: true })}/h
          <span className="block text-xs text-muted-foreground">
            {formatBRL(f.faixaCents?.[0] ?? 0, { semCentavos: true })} a {formatBRL(f.faixaCents?.[1] ?? 0, { semCentavos: true })}
          </span>
        </span>
      );
  }
}

function ComparativoOab({
  referencias,
  uf,
  area,
  formato,
  resultado,
  valorCausaCents,
}: {
  referencias: OabReferenceRow[];
  uf: string;
  area: string;
  formato: BillingFormat;
  resultado: PricingResult;
  valorCausaCents: number;
}) {
  const disponiveis = referencias.filter((r) => r.uf === uf && r.area === area);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const ref = disponiveis.find((r) => r.id === servicoId) ?? disponiveis[0];

  if (!ref) {
    return (
      <p className="text-sm text-muted-foreground">
        Não há tabela da OAB/{uf} cadastrada para {AREAS.find((a) => a.id === area)?.nome.toLowerCase()}. Confira o mínimo no
        site da sua seccional antes de enviar a proposta.
      </p>
    );
  }

  const porPercentual = formato === "exito" && ref.percentualMinimo != null;
  const minimo = porPercentual ? Number(ref.percentualMinimo) : minimoOab(ref, valorCausaCents);
  const proposto = porPercentual ? (resultado.formatos.exito.percentual ?? 0) : resultado.formatos[formato].valorCents;
  const abaixo = proposto < minimo;
  const formatar = (v: number) => (porPercentual ? formatPercent(v) : formatBRL(v, { semCentavos: true }));

  return (
    <div className="space-y-2.5">
      {disponiveis.length > 1 && (
        <select
          aria-label="Serviço da tabela da OAB"
          className={selectClasse}
          value={ref.id}
          onChange={(e) => setServicoId(Number(e.target.value))}
        >
          {disponiveis.map((r) => (
            <option key={r.id} value={r.id}>
              {r.servico}
            </option>
          ))}
        </select>
      )}
      <p className="text-sm">
        {disponiveis.length === 1 && <span className="block text-muted-foreground">{ref.servico}</span>}
        Mínimo da tabela: <span className="font-medium">{formatar(minimo)}</span>
      </p>
      <p className={cn("flex gap-2 text-sm", abaixo ? "text-carimbo" : "text-deferido")}>
        {abaixo ? <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {abaixo
          ? `Sua proposta (${formatar(proposto)}) fica abaixo do mínimo, o que pode caracterizar aviltamento de honorários (CED, art. 48, § 6º).`
          : `Sua proposta (${formatar(proposto)}) respeita o mínimo da tabela.`}
      </p>
      {ref.ilustrativo && (
        <p className="rounded-md bg-atencao/10 px-2.5 py-1.5 text-xs text-atencao">
          Valores ilustrativos de teste. Cadastre a tabela vigente da OAB/{uf} antes de usar em produção.
        </p>
      )}
    </div>
  );
}

export function FeeCalculator({ referencias, ufPadrao }: { referencias: OabReferenceRow[]; ufPadrao: string | null }) {
  const [campos, setCampos] = useState({
    custos: "12.000,00",
    horasMes: "120",
    margem: "30",
    valorHora: "350,00",
    horas: "20",
    valorCausa: "80.000,00",
    imposto: "4,5",
    repasse: "10",
  });
  const [indicacao, setIndicacao] = useState(false);
  const [complexidade, setComplexidade] = useState<Complexidade>("media");
  const [risco, setRisco] = useState<Risco>("medio");
  const [area, setArea] = useState<string>("civel");
  const [uf, setUf] = useState<string>(ufPadrao ?? "SP");
  const [formato, setFormato] = useState<BillingFormat>("fixo");
  const [state, action] = useActionState(salvarProposta, undefined);

  const inputs: PricingInputs = useMemo(
    () => ({
      custosFixosMensaisCents: parseBRLToCents(campos.custos),
      horasProdutivasMes: Math.max(1, numero(campos.horasMes)),
      margemPercentual: Math.max(0, numero(campos.margem)),
      valorHoraCents: parseBRLToCents(campos.valorHora),
      horasEstimadas: Math.max(0.5, numero(campos.horas)),
      valorCausaCents: parseBRLToCents(campos.valorCausa),
      complexidade,
      risco,
      impostoPercentual: entre(numero(campos.imposto), 0, 60),
      repassePercentual: indicacao ? entre(numero(campos.repasse), 0, 50) : 0,
    }),
    [campos, complexidade, risco, indicacao],
  );
  const r = useMemo(() => calcularHonorarios(inputs), [inputs]);

  const atualizar = (campo: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }));

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-8">
        <AnaliseCaso
          onAplicar={(s) => {
            setArea(s.area);
            setComplexidade(s.complexidade);
            setRisco(s.risco);
          }}
        />

        <fieldset className="space-y-4">
          <legend className="mb-3 font-serif text-lg font-semibold">Seu escritório</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="custos" label="Custos fixos mensais (R$)" ajuda="Aluguel, equipe, sistemas, anuidade, impostos fixos.">
              <Input id="custos" inputMode="decimal" value={campos.custos} onChange={atualizar("custos")} />
            </Campo>
            <Campo id="horasMes" label="Horas faturáveis por mês" ajuda="Horas de fato dedicadas a clientes.">
              <Input id="horasMes" inputMode="numeric" value={campos.horasMes} onChange={atualizar("horasMes")} />
            </Campo>
            <Campo id="margem" label="Margem desejada (%)">
              <Input id="margem" inputMode="decimal" value={campos.margem} onChange={atualizar("margem")} />
            </Campo>
            <Campo id="valorHora" label="Valor-hora líquido desejado (R$)" ajuda="Quanto quer receber por hora, já descontados impostos e repasse.">
              <Input id="valorHora" inputMode="decimal" value={campos.valorHora} onChange={atualizar("valorHora")} />
            </Campo>
            <Campo
              id="imposto"
              label="Impostos sobre os honorários (%)"
              ajuda="Ex.: 4,5% no Simples Nacional (1ª faixa do Anexo IV). Como pessoa física, o IR pode chegar a 27,5%. Confirme com seu contador."
            >
              <Input id="imposto" inputMode="decimal" value={campos.imposto} onChange={atualizar("imposto")} />
            </Campo>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-serif text-lg font-semibold">O caso</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="area" label="Área">
              <select id="area" className={selectClasse} value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="uf" label="Seccional da OAB">
              <select id="uf" className={selectClasse} value={uf} onChange={(e) => setUf(e.target.value)}>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="horas" label="Horas estimadas para o caso">
              <Input id="horas" inputMode="decimal" value={campos.horas} onChange={atualizar("horas")} />
            </Campo>
            <Campo id="valorCausa" label="Valor da causa ou proveito econômico (R$)" ajuda="Base do êxito. Use 0 se não houver.">
              <Input id="valorCausa" inputMode="decimal" value={campos.valorCausa} onChange={atualizar("valorCausa")} />
            </Campo>
          </div>
          <Segmentado
            legenda="Complexidade"
            opcoes={(Object.keys(COMPLEXIDADES) as Complexidade[]).map((c) => ({ valor: c, nome: COMPLEXIDADES[c].nome }))}
            valor={complexidade}
            onChange={setComplexidade}
          />
          <Segmentado
            legenda="Risco"
            ajuda="Chance de um resultado desfavorável ao cliente. Afeta o percentual de êxito e o valor esperado."
            opcoes={(Object.keys(RISCOS) as Risco[]).map((c) => ({ valor: c, nome: RISCOS[c].nome }))}
            valor={risco}
            onChange={setRisco}
          />
          <div className="space-y-3 rounded-lg border border-border bg-folha p-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={indicacao} onChange={(e) => setIndicacao(e.target.checked)} className="mt-0.5 accent-tinta" />
              <span>
                <span className="block font-medium">O cliente veio por indicação de outro advogado</span>
                <span className="block text-xs text-muted-foreground">
                  O repasse combinado entra no cálculo para que o mínimo continue cobrindo seus custos e sua margem.
                </span>
              </span>
            </label>
            {indicacao && (
              <Campo id="repasse" label="Repasse ao advogado que indicou (% dos honorários)">
                <Input id="repasse" inputMode="decimal" value={campos.repasse} onChange={atualizar("repasse")} className="max-w-32" />
              </Campo>
            )}
          </div>
        </fieldset>

        <details className="rounded-lg border border-border bg-folha p-4 text-sm">
          <summary className="cursor-pointer font-medium">Como o cálculo foi feito</summary>
          <ul className="mt-3 space-y-1.5 text-muted-foreground">
            {r.memoria.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </details>
      </div>

      <aside id="resultado" className="h-fit scroll-mt-4 space-y-5 xl:sticky xl:top-6">
        <div className="folha divide-y divide-border">
          <div className="space-y-3 p-5">
            <dl className="grid grid-cols-3">
              {[
                ["Mínimo aceitável", r.minimoCents],
                ["Médio", r.medioCents],
                ["Ideal", r.idealCents],
              ].map(([rotulo, valor], i) => (
                <div key={rotulo} className={cn(i > 0 && "border-l border-border pl-3")}>
                  <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                  <dd className="font-serif text-lg font-semibold">{formatBRL(Number(valor), { semCentavos: true })}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              O mínimo aceitável já inclui os impostos ({formatPercent(inputs.impostoPercentual ?? 0)})
              {inputs.repassePercentual ? ` e o repasse por indicação (${formatPercent(inputs.repassePercentual)})` : ""}. Abaixo
              dele, o que sobra para você não cobre seus custos e sua margem.
            </p>
          </div>

          <fieldset className="space-y-1 p-3">
            <legend className="px-2 pt-2 pb-1 text-sm font-medium">Formato de cobrança</legend>
            {(Object.keys(FORMATOS) as BillingFormat[]).map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="formato-visivel" checked={formato === f} onChange={() => setFormato(f)} className="accent-tinta" />
                  {FORMATOS[f]}
                </span>
                <ResumoFormato formato={f} r={r} />
              </label>
            ))}
            <p className="px-2 pt-1 pb-1 text-xs text-muted-foreground">{r.formatos[formato].observacao}</p>
          </fieldset>

          {formato !== "exito" && (
            <DivisaoDoValor
              brutoCents={r.formatos[formato].valorCents}
              inputs={inputs}
              rotulo={formato === "misto" ? "Parte fixa cobrada" : "Valor cobrado do cliente"}
            />
          )}

          <div className="space-y-2 p-5">
            <p className="text-sm font-medium">Tabela da OAB/{uf}</p>
            <ComparativoOab
              key={`${uf}-${area}`}
              referencias={referencias}
              uf={uf}
              area={area}
              formato={formato}
              resultado={r}
              valorCausaCents={inputs.valorCausaCents}
            />
          </div>

          {r.alertas.length > 0 && (
            <ul className="space-y-2 p-5">
              {r.alertas.map((a) => (
                <li key={a} className="flex gap-2 text-sm text-atencao">
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form action={action} className="space-y-3 rounded-lg border border-border bg-folha p-5">
          <p className="text-sm font-medium">Gerar proposta</p>
          <input type="hidden" name="inputs" value={JSON.stringify(inputs)} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="uf" value={uf} />
          <input type="hidden" name="billingFormat" value={formato} />
          <Campo id="clientName" label="Cliente">
            <Input id="clientName" name="clientName" required />
          </Campo>
          <Campo id="caseTitle" label="Assunto" ajuda="Ex.: ação revisional de contrato de financiamento de veículo.">
            <Input id="caseTitle" name="caseTitle" required />
          </Campo>
          <FormError message={state?.error} />
          <SubmitButton className="h-9 w-full" pendingText="Salvando…">
            Salvar e abrir a proposta
          </SubmitButton>
        </form>
      </aside>

      {/* No celular, o resultado fica depois do formulário: a barra mostra os valores enquanto as premissas mudam. */}
      <a
        href="#resultado"
        className="barra-fixa-inferior fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-folha/95 px-4 py-2.5 shadow-[0_-8px_24px_-16px_rgb(32_35_43/0.35)] backdrop-blur xl:hidden"
      >
        <dl className="flex gap-4 text-sm">
          {[
            ["Mínimo", r.minimoCents],
            ["Médio", r.medioCents],
            ["Ideal", r.idealCents],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs text-muted-foreground">{rotulo}</dt>
              <dd className="font-serif font-semibold">{formatBRL(Number(valor), { semCentavos: true })}</dd>
            </div>
          ))}
        </dl>
        <span className="text-sm font-medium whitespace-nowrap text-tinta">Detalhes</span>
      </a>
    </div>
  );
}
