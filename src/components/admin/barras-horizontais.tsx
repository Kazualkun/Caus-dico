/**
 * Barras horizontais de uma só série (magnitude por categoria). A cor é a
 * mesma em todas: quem identifica a barra é o rótulo, e o valor vem escrito
 * ao lado, então o gráfico se lê sem passar o mouse e sem depender da cor.
 */
const FORMATOS = {
  inteiro: (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
  brl: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
};

export function BarrasHorizontais({
  rotulo,
  dados,
  formato,
}: {
  rotulo: string;
  dados: { nome: string; valor: number; detalhe?: string }[];
  formato: keyof typeof FORMATOS;
}) {
  const formatar = FORMATOS[formato];
  const maximo = Math.max(...dados.map((d) => d.valor), 0);
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-medium">{rotulo}</figcaption>
      {dados.length === 0 || maximo === 0 ? (
        <p className="text-sm text-muted-foreground">Nada no período.</p>
      ) : (
        <ul className="space-y-2.5">
          {dados.map((d) => (
            <li key={d.nome} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground" title={d.nome}>
                {d.nome}
              </span>
              <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max((d.valor / maximo) * 100, d.valor > 0 ? 2 : 0)}%`, background: "var(--tinta-grafico)" }}
                />
              </span>
              <span className="text-right">
                {formatar(d.valor)}
                {d.detalhe && <span className="block text-xs text-muted-foreground">{d.detalhe}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
