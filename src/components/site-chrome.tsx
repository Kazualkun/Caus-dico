import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { EMPRESA, EXIBIR } from "@/lib/legal";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="border-b border-border/70 bg-papel/90 backdrop-blur supports-[backdrop-filter]:bg-papel/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
          <Link href="/#modulos" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-grafite sm:block">
            Como funciona
          </Link>
          <Link href="/planos" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-grafite min-[420px]:block">
            Planos
          </Link>
          <Link href="/contato" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-grafite md:block">
            Contato
          </Link>
          <Link href="/entrar" className="rounded-md px-2.5 py-2 text-muted-foreground hover:text-grafite sm:px-3">
            Entrar
          </Link>
          <Button asChild size="lg" className="ml-1 px-3.5">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

/** Canais de atendimento: o formulário de contato e, quando houver, e-mail e telefone. */
export function ContatoAtendimento() {
  const { emailAtendimento: email, telefone } = EMPRESA;
  return (
    <>
      <Link href="/contato" className="underline underline-offset-2 hover:text-grafite">
        formulário de contato
      </Link>
      {(email || telefone) && " · "}
      {email && (
        <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-grafite">
          {email}
        </a>
      )}
      {email && telefone && " · "}
      {telefone}
    </>
  );
}

/** Canal para assuntos de dados pessoais: o encarregado, quando houver, ou o formulário do site. */
export function ContatoPrivacidade() {
  const e = EMPRESA.encarregado;
  if (e) {
    return (
      <>
        {e.nome} (<a href={`mailto:${e.email}`}>{e.email}</a>)
      </>
    );
  }
  return (
    <>
      o formulário <Link href="/privacidade/solicitacao">Seus dados (LGPD)</Link>
    </>
  );
}

/** Identificação do fornecedor (Decreto 7.962/2013, art. 2º, I e II). */
export function IdentificacaoEmpresa({ className }: { className?: string }) {
  return (
    <address className={cn("not-italic", className)}>
      {EXIBIR.razaoSocial} · CNPJ {EXIBIR.cnpj}
      <br />
      {EXIBIR.endereco}
      <br />
      Atendimento: <ContatoAtendimento />
    </address>
  );
}

const LINKS_LEGAIS = [
  { href: "/contato", nome: "Contato" },
  { href: "/termos", nome: "Termos de Uso" },
  { href: "/privacidade", nome: "Política de Privacidade" },
  { href: "/cancelamento-e-reembolso", nome: "Cancelamento e reembolso" },
  { href: "/privacidade/solicitacao", nome: "Seus dados (LGPD)" },
  { href: "/acessibilidade", nome: "Acessibilidade" },
] as const;

export function LinksLegais({ className }: { className?: string }) {
  return (
    <nav aria-label="Informações legais" className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LINKS_LEGAIS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-grafite hover:underline hover:underline-offset-2">
              {l.nome}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Rodapé enxuto das áreas de cadastro, checkout e painel: links legais e identificação. */
export function RodapeCompacto({ className }: { className?: string }) {
  return (
    <footer className={cn("space-y-2 text-xs leading-relaxed text-muted-foreground", className)}>
      <LinksLegais />
      <IdentificacaoEmpresa />
    </footer>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-folha">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl space-y-3">
          <Wordmark />
          <p>
            O Causídico é uma ferramenta de apoio ao trabalho do advogado. Não presta serviços advocatícios, e todo
            resultado gerado deve ser revisado por profissional habilitado antes do uso.
          </p>
          <p>
            Acervo de legislação e jurisprudência baseado no projeto aberto{" "}
            <a href="https://github.com/ctresb/leis" className="underline underline-offset-2 hover:text-grafite">
              ctresb/leis
            </a>
            , com link para a fonte oficial de cada norma.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex gap-6 md:flex-col md:gap-2">
          <Link href="/planos" className="hover:text-grafite">
            Planos
          </Link>
          <Link href="/contato" className="hover:text-grafite">
            Contato
          </Link>
          <Link href="/entrar" className="hover:text-grafite">
            Entrar
          </Link>
          <Link href="/cadastro" className="hover:text-grafite">
            Criar conta
          </Link>
        </nav>
        <div className="space-y-3 border-t border-border pt-6 text-xs leading-relaxed md:col-span-2">
          <LinksLegais />
          <IdentificacaoEmpresa />
        </div>
      </div>
    </footer>
  );
}
