import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/**
 * Página de documento legal (termos, privacidade, reembolso, acessibilidade):
 * título, data e versão visíveis, índice das seções e corpo com 16px ou mais
 * (CDC, art. 54, § 3º).
 */
export function DocumentoLegal({
  titulo,
  atualizadoEm,
  versao,
  indice,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  versao?: string;
  indice?: { id: string; titulo: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          {indice && (
            <nav aria-label="Nesta página" className="text-sm lg:sticky lg:top-8 lg:self-start">
              <p className="mb-2 font-medium">Nesta página</p>
              <ol className="space-y-1.5 text-muted-foreground">
                {indice.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="hover:text-tinta hover:underline hover:underline-offset-2">
                      {s.titulo}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <article className="documento-legal max-w-3xl min-w-0 lg:col-start-2">
            <header className="mb-8 border-b border-border pb-6">
              <h1 className="font-serif text-4xl font-semibold tracking-tight">{titulo}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Última atualização: {atualizadoEm}
                {versao && <> · Versão {versao}</>}
              </p>
            </header>
            {children}
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Tabela que rola na horizontal em telas estreitas, sem alargar a página. */
export function TabelaDoc({ cabecalho, linhas }: { cabecalho: string[]; linhas: ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="min-w-[36rem]">
        <thead>
          <tr>
            {cabecalho.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {linha.map((celula, j) => (
                <td key={j}>{celula}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
