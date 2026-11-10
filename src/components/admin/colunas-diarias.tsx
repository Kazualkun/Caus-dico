"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Colunas de uma série diária (ex.: tempo de processamento da IA). Série única: sem legenda, o
 * título diz o que é. Colunas finas com topo arredondado, 2px de respiro entre
 * elas, grade de linha fina e tooltip por coluna (mouse e teclado). A tabela
 * ao lado traz os mesmos valores sem depender de hover.
 */
const FORMATOS = {
  usd: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 }),
  inteiro: (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
  minutos: (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`,
  brl: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v > 0 && v < 100 ? 2 : 0 }),
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function ColunasDiarias({
  dados,
  formato,
  rotulo,
  mensal = false,
}: {
  dados: { dia: string; valor: number }[];
  formato: keyof typeof FORMATOS;
  rotulo: string;
  /** Cada coluna é um mês (o rótulo vira "out/26"). */
  mensal?: boolean;
}) {
  const formatar = FORMATOS[formato];
  const [ativo, setAtivo] = useState<number | null>(null);
  // O desenho usa a largura real do contêiner (1 unidade = 1px): o texto do eixo tem sempre o mesmo tamanho.
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const observador = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  const altura = 160;
  const margem = { topo: 12, base: 22, esquerda: formato === "inteiro" ? 32 : 64 };
  const area = { l: largura - margem.esquerda, a: altura - margem.topo - margem.base };
  const maximo = Math.max(...dados.map((d) => d.valor), 0);
  const passo = maximo > 0 ? niceStep(maximo / 3) : 1;
  const topo = Math.max(passo * 3, passo);
  const faixa = area.l / Math.max(dados.length, 1);
  const larguraColuna = Math.min(24, faixa - 2);
  const y = (v: number) => margem.topo + area.a - (v / topo) * area.a;
  const dia = (iso: string) => (mensal ? `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}` : `${iso.slice(8, 10)}/${iso.slice(5, 7)}`);

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{rotulo}</figcaption>
      <div ref={caixa} className="relative">
        <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label={rotulo}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line x1={margem.esquerda} x2={largura} y1={y(passo * i)} y2={y(passo * i)} stroke="var(--border)" strokeWidth={1} />
              <text x={margem.esquerda - 6} y={y(passo * i) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {formatar(passo * i)}
              </text>
            </g>
          ))}
          {dados.map((d, i) => {
            const x = margem.esquerda + i * faixa + (faixa - larguraColuna) / 2;
            const h = Math.max(0, y(0) - y(d.valor));
            const r = Math.min(4, h, larguraColuna / 2);
            return (
              <g
                key={d.dia}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${dia(d.dia)}: ${formatar(d.valor)}`}
                onPointerEnter={() => setAtivo(i)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                className="outline-none"
              >
                {/* Área de toque maior que a coluna */}
                <rect x={margem.esquerda + i * faixa} y={margem.topo} width={faixa} height={area.a} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${y(d.valor) + r} Q${x},${y(d.valor)} ${x + r},${y(d.valor)} H${x + larguraColuna - r} Q${x + larguraColuna},${y(d.valor)} ${x + larguraColuna},${y(d.valor) + r} V${y(0)} Z`}
                    fill="var(--tinta-grafico)"
                    opacity={ativo === null || ativo === i ? 1 : 0.55}
                  />
                )}
              </g>
            );
          })}
          {dados.length > 0 &&
            [0, Math.floor(dados.length / 2), dados.length - 1].map((i, j) => (
              // As pontas alinham para dentro, para o rótulo não ser cortado na borda.
              <text
                key={i}
                x={j === 0 ? margem.esquerda + i * faixa : j === 2 ? margem.esquerda + (i + 1) * faixa : margem.esquerda + i * faixa + faixa / 2}
                y={altura - 6}
                textAnchor={j === 0 ? "start" : j === 2 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {dia(dados[i].dia)}
              </text>
            ))}
        </svg>
        {ativo !== null && (
          <div
            className="pointer-events-none absolute -top-2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: `${((margem.esquerda + ativo * faixa + faixa / 2) / largura) * 100}%`, transform: "translate(-50%, -100%)" }}
          >
            <span className="block font-semibold">{formatar(dados[ativo].valor)}</span>
            <span className="text-muted-foreground">{dia(dados[ativo].dia)}</span>
          </div>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Ver como tabela</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody>
            {dados.map((d) => (
              <tr key={d.dia} className="border-b border-border">
                <td className="py-1">{dia(d.dia)}</td>
                <td className="py-1 text-right">{formatar(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Passo "redondo" (1, 2, 5 × 10ⁿ) para os rótulos do eixo. */
function niceStep(bruto: number) {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * potencia;
}
