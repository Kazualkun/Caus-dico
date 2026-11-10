import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Marca = { inicio: number; id: string };

/** Acima disso, a página mostra o início e aponta para a fonte oficial (anexos e tabelas gigantes). */
const LIMITE_RENDER = 1_500_000;

/**
 * Texto da norma dividido em seções com âncora (títulos e artigos), cada uma
 * renderizada em Markdown. As âncoras são as mesmas gravadas no acervo, e é
 * para elas que apontam as citações dos pareceres e das pesquisas.
 */
export function TextoNorma({
  texto,
  sumario,
  dispositivos,
}: {
  texto: string;
  sumario: { inicio: number; ancora: string }[];
  dispositivos: { inicio: number; ancora: string }[];
}) {
  const corte = Math.min(texto.length, LIMITE_RENDER);
  const marcas: Marca[] = [...sumario.map((s) => ({ inicio: s.inicio, id: s.ancora })), ...dispositivos.map((d) => ({ inicio: d.inicio, id: d.ancora }))]
    .filter((m) => m.inicio < corte)
    .sort((a, b) => a.inicio - b.inicio)
    .filter((m, i, arr) => i === 0 || m.inicio !== arr[i - 1].inicio);

  const secoes: { id: string | null; conteudo: string }[] = [];
  const preambulo = texto.slice(0, marcas[0]?.inicio ?? corte).replace(/^#\s+.+\n?/, "");
  if (preambulo.trim()) secoes.push({ id: null, conteudo: preambulo });
  marcas.forEach((m, i) => secoes.push({ id: m.id, conteudo: texto.slice(m.inicio, marcas[i + 1]?.inicio ?? corte) }));

  return (
    <div className="texto-juridico texto-norma">
      {secoes.map((s, i) => (
        <section key={s.id ?? `p${i}`} id={s.id ?? undefined} className="scroll-mt-6 target:rounded target:bg-marca/25">
          <Markdown remarkPlugins={[remarkGfm]}>{s.conteudo}</Markdown>
        </section>
      ))}
      {corte < texto.length && (
        <p className="mt-6 rounded-md bg-muted px-3 py-2 font-sans text-sm text-muted-foreground">
          O texto continua: esta norma é muito longa para exibir inteira. Consulte a íntegra na fonte oficial.
        </p>
      )}
    </div>
  );
}
