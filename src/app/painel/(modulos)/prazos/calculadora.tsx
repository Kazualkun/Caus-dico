"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import { cn } from "@/lib/utils";
import {
  calcularPrazo,
  DIAS_USUAIS,
  DIAS_USUAIS_POR_JUSTICA,
  formatarData,
  hojeEmBrasilia,
  JUSTICAS,
  RAMOS,
  type DiaDaLinha,
  type DiaInformado,
  type DiaUsual,
  type FormaIntimacao,
  type Justica,
  type Ramo,
} from "@/lib/prazos/calculo";
import { salvarPrazo } from "./actions";

const selectClasse = "h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm";

function Campo({ id, label, ajuda, children }: { id: string; label: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

type Trecho = { tipo: DiaDaLinha["tipo"] | "vencimento"; de: string; ate: string; numeroDe?: number; numeroAte?: number; motivo?: string };

/** Junta dias seguidos do mesmo tipo (fins de semana, suspensão, dias contados) para a linha do tempo caber na tela. */
function agrupar(linha: DiaDaLinha[], vencimento: string): Trecho[] {
  const trechos: Trecho[] = [];
  for (const d of linha) {
    const tipo = d.data === vencimento && d.tipo === "contado" ? "vencimento" : d.tipo;
    const ultimo = trechos.at(-1);
    const junta =
      ultimo &&
      ultimo.tipo === tipo &&
      tipo !== "marco" &&
      tipo !== "publicacao" &&
      tipo !== "vencimento" &&
      (tipo === "contado" ? !d.motivo && !ultimo.motivo : ultimo.motivo === d.motivo || tipo === "fim_de_semana");
    if (junta) {
      ultimo.ate = d.data;
      ultimo.numeroAte = d.numero;
      if (tipo === "fim_de_semana") ultimo.motivo = "Fim de semana";
    } else {
      trechos.push({ tipo, de: d.data, ate: d.data, numeroDe: d.numero, numeroAte: d.numero, motivo: d.motivo });
    }
  }
  return trechos;
}

const ROTULO: Record<Trecho["tipo"], string> = {
  marco: "Marco",
  publicacao: "Publicação",
  contado: "Contagem",
  vencimento: "Vencimento",
  fim_de_semana: "Não conta",
  feriado: "Não conta",
  suspenso: "Suspenso",
  reduzido: "Expediente reduzido",
};

export function LinhaDoTempo({ linha, vencimento }: { linha: DiaDaLinha[]; vencimento: string }) {
  const trechos = agrupar(linha, vencimento);
  return (
    <ol className="relative space-y-0 border-l border-border pl-5 text-sm">
      {trechos.map((t, i) => {
        const periodo = t.de === t.ate ? formatarData(t.de) : `${formatarData(t.de)} a ${formatarData(t.ate)}`;
        const contagem =
          t.numeroDe != null ? (t.numeroDe === t.numeroAte ? `dia ${t.numeroDe}` : `dias ${t.numeroDe} a ${t.numeroAte}`) : null;
        return (
          <li key={i} className="relative py-1.5">
            <span
              aria-hidden
              className={cn(
                "absolute top-3 -left-[1.66rem] size-2.5 rounded-full border-2 border-folha",
                t.tipo === "vencimento" ? "bg-carimbo" : t.tipo === "contado" ? "bg-deferido" : t.tipo === "suspenso" ? "bg-atencao" : t.tipo === "marco" || t.tipo === "publicacao" ? "bg-tinta" : "bg-muted-foreground/40",
              )}
            />
            <span className={cn("font-medium", t.tipo === "vencimento" && "text-carimbo")}>{periodo}</span>
            <span className="text-muted-foreground">
              {" "}
              · {ROTULO[t.tipo]}
              {contagem ? `, ${contagem}` : ""}
              {t.motivo ? `: ${t.motivo}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CalculadoraPrazos({
  diasInformados,
  processos,
}: {
  diasInformados: DiaInformado[];
  processos: { id: string; titulo: string }[];
}) {
  const [ramo, setRamo] = useState<Ramo>("civel");
  const [justica, setJustica] = useState<Justica>("estadual");
  const [forma, setForma] = useState<FormaIntimacao>("dje");
  const [data, setData] = useState(hojeEmBrasilia());
  const [dias, setDias] = useState("15");
  const [emDobro, setEmDobro] = useState(false);
  const [semSuspensao, setSemSuspensao] = useState(false);
  const [usuais, setUsuais] = useState<DiaUsual[]>(DIAS_USUAIS_POR_JUSTICA.estadual);
  const [state, action] = useActionState(salvarPrazo, undefined);

  // Quem digita antes de a página terminar de carregar vê o valor no campo, mas o
  // estado ainda não o recebeu: ao hidratar, o cálculo passa a usar o que está na tela.
  const campoData = useRef<HTMLInputElement>(null);
  const campoDias = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (campoData.current && campoData.current.value !== data) setData(campoData.current.value);
    if (campoDias.current && campoDias.current.value !== dias) setDias(campoDias.current.value);
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parametros = {
    ramo,
    forma,
    data,
    dias: Math.round(Number(dias)) || 0,
    emDobro,
    semSuspensaoFimDeAno: ramo === "penal" && semSuspensao,
    diasUsuais: usuais,
  };
  const calculo = useMemo(() => {
    try {
      return { r: calcularPrazo({ ...parametros, diasInformados }) };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Confira os dados." };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramo, forma, data, dias, emDobro, semSuspensao, usuais, diasInformados]);

  function trocarJustica(j: Justica) {
    setJustica(j);
    setUsuais(DIAS_USUAIS_POR_JUSTICA[j]);
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="ramo" label="Ramo" ajuda={RAMOS[ramo].fundamento}>
            <select id="ramo" className={selectClasse} value={ramo} onChange={(e) => setRamo(e.target.value as Ramo)}>
              {(Object.keys(RAMOS) as Ramo[]).map((r) => (
                <option key={r} value={r}>
                  {RAMOS[r].nome}, {RAMOS[r].diasUteis ? "dias úteis" : "dias corridos"}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="justica" label="Justiça">
            <select id="justica" className={selectClasse} value={justica} onChange={(e) => trocarJustica(e.target.value as Justica)}>
              {(Object.keys(JUSTICAS) as Justica[]).map((j) => (
                <option key={j} value={j}>
                  {JUSTICAS[j]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="forma" label="Como foi a intimação">
            <select id="forma" className={selectClasse} value={forma} onChange={(e) => setForma(e.target.value as FormaIntimacao)}>
              <option value="dje">Publicação no Diário de Justiça Eletrônico</option>
              <option value="intimacao">Outra (pessoal, oficial, AR, portal)</option>
            </select>
          </Campo>
          <Campo
            id="data"
            label={forma === "dje" ? "Data da disponibilização no DJe" : "Data que marca o início"}
            ajuda={forma === "dje" ? "O dia em que o texto saiu no diário, não o da publicação." : "Ciência, juntada do mandado ou do AR, conforme a lei."}
          >
            <Input id="data" ref={campoData} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo id="dias" label="Prazo (dias)">
            <Input id="dias" ref={campoDias} inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 3))} className="max-w-28" />
          </Campo>
          <div className="space-y-2 pt-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={emDobro} onChange={(e) => setEmDobro(e.target.checked)} className="accent-tinta" />
              Prazo em dobro (Fazenda Pública, MP, Defensoria)
            </label>
            {ramo === "penal" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={semSuspensao} onChange={(e) => setSemSuspensao(e.target.checked)} className="accent-tinta" />
                Réu preso, Lei Maria da Penha ou medida urgente
              </label>
            )}
          </div>
        </div>

        <fieldset className="space-y-2 rounded-lg border border-border bg-folha p-4">
          <legend className="px-1 text-sm font-medium">Dias sem expediente forense considerados</legend>
          <p className="text-xs text-muted-foreground">
            Feriados nacionais e fins de semana já entram. Os dias abaixo variam por tribunal: a sugestão de {JUSTICAS[justica]}{" "}
            só marca os que têm respaldo seguro. Confira o calendário do seu tribunal e marque os demais. Marcar um dia em que o
            tribunal funcionou alonga o prazo indevidamente.
          </p>
          <div className="grid gap-x-4 gap-y-1.5 pt-1 text-sm sm:grid-cols-2">
            {(Object.keys(DIAS_USUAIS) as DiaUsual[]).map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-tinta"
                  checked={usuais.includes(d)}
                  onChange={(e) => setUsuais((u) => (e.target.checked ? [...u, d] : u.filter((x) => x !== d)))}
                />
                {DIAS_USUAIS[d].nome}
              </label>
            ))}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            {diasInformados.length
              ? `Mais ${diasInformados.length} dia(s) informados por você (feriados locais e suspensões), na seção abaixo.`
              : "Feriados estaduais e municipais e suspensões do tribunal: cadastre na seção Seus dias sem expediente, abaixo."}
          </p>
        </fieldset>
      </div>

      <aside className="h-fit space-y-5 xl:sticky xl:top-6">
        <div className="folha space-y-4 p-5" aria-live="polite">
          {"erro" in calculo ? (
            <FormError message={calculo.erro} />
          ) : (
            calculo.r && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-serif text-2xl font-semibold text-carimbo">{formatarData(calculo.r.vencimento, true)}</p>
                  <p className="text-sm text-muted-foreground">
                    {calculo.r.publicacao ? `Publicação em ${formatarData(calculo.r.publicacao)}. ` : ""}
                    Contagem a partir de {formatarData(calculo.r.inicioContagem)}, {calculo.r.diasContados}{" "}
                    {RAMOS[ramo].diasUteis ? "dias úteis" : "dias corridos"}.
                  </p>
                </div>
                <LinhaDoTempo linha={calculo.r.linha} vencimento={calculo.r.vencimento} />
                <ul className="space-y-1.5 text-xs text-atencao">
                  {calculo.r.avisos.map((a) => (
                    <li key={a} className="flex gap-1.5">
                      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Base: {calculo.r.fundamentos.join("; ")}.</p>
              </>
            )
          )}
        </div>

        <form action={action} className="space-y-3 rounded-lg border border-border bg-folha p-5">
          <p className="text-sm font-medium">Salvar na linha do tempo</p>
          <input type="hidden" name="parametros" value={JSON.stringify(parametros)} />
          <Campo id="descricao" label="Prazo">
            <Input id="descricao" name="descricao" placeholder="Ex.: Contestação" required />
          </Campo>
          <Campo id="processoId" label="Processo">
            <select id="processoId" name="processoId" className={selectClasse} defaultValue="">
              <option value="">Sem processo</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <FormError message={state?.error} />
          {state?.ok && <p className="text-sm text-deferido">{state.mensagem}</p>}
          <SubmitButton className="h-9 w-full" pendingText="Salvando…" disabled={"erro" in calculo}>
            Salvar prazo
          </SubmitButton>
        </form>
      </aside>
    </div>
  );
}
