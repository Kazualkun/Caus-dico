import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer } from "@/lib/auth";
import { PRAZO_CONTATO_DIAS } from "@/lib/contato";
import { EMPRESA } from "@/lib/legal";
import { ContatoForm } from "./form";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a equipe do Causídico: dúvidas, suporte técnico, assinatura e sugestões.",
};

/** Quem está logado já recebe nome e e-mail preenchidos. */
async function FormularioPreenchido({ searchParams }: { searchParams: PageProps<"/contato">["searchParams"] }) {
  const [viewer, { assunto }] = await Promise.all([getViewer(), searchParams]);
  return (
    <ContatoForm
      nome={viewer?.fullName ?? undefined}
      email={viewer?.email}
      assunto={typeof assunto === "string" ? assunto : undefined}
    />
  );
}

const ATALHOS = [
  { titulo: "Cancelar ou pedir reembolso", texto: "Cancele em Minha conta, sem multa. Em até 7 dias do pagamento, o estorno é automático.", href: "/cancelamento-e-reembolso" },
  { titulo: "Seus dados pessoais (LGPD)", texto: "Acesso, correção, portabilidade ou exclusão dos seus dados.", href: "/privacidade/solicitacao" },
  { titulo: "Acessibilidade", texto: "Encontrou uma barreira de acessibilidade? Conte para nós.", href: "/acessibilidade" },
];

export default function ContatoPage({ searchParams }: PageProps<"/contato">) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
        <div className="max-w-2xl">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Fale com a gente</h1>
          <p className="mt-3 text-muted-foreground">
            Dúvidas, problemas técnicos, assinatura ou sugestões. Respondemos por e-mail em até {PRAZO_CONTATO_DIAS} dias.
            {EMPRESA.emailAtendimento && (
              <>
                {" "}
                Se preferir, escreva para{" "}
                <a href={`mailto:${EMPRESA.emailAtendimento}`} className="text-tinta underline underline-offset-2">
                  {EMPRESA.emailAtendimento}
                </a>
                .
              </>
            )}
            {EMPRESA.telefone && ` Telefone: ${EMPRESA.telefone}.`}
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-labelledby="titulo-form" className="folha px-5 py-6 sm:px-8 sm:py-8">
            <h2 id="titulo-form" className="mb-5 text-base font-semibold">
              Enviar mensagem
            </h2>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <FormularioPreenchido searchParams={searchParams} />
            </Suspense>
          </section>

          <aside aria-label="Atalhos" className="space-y-3">
            {ATALHOS.map((a) => (
              <Link key={a.href} href={a.href} className="block rounded-lg border border-border bg-folha p-4 hover:border-tinta">
                <span className="block text-sm font-medium">{a.titulo}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{a.texto}</span>
              </Link>
            ))}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
