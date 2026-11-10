import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer } from "@/lib/auth";
import { EMPRESA } from "@/lib/legal";
import { SolicitacaoForm } from "./form";

export const metadata: Metadata = {
  title: "Seus dados (LGPD)",
  description: "Peça acesso, correção, portabilidade ou exclusão dos seus dados pessoais no Causídico.",
};

/** Quem está logado já recebe nome e e-mail preenchidos. */
async function FormularioPreenchido() {
  const viewer = await getViewer();
  return <SolicitacaoForm nome={viewer?.fullName ?? undefined} email={viewer?.email} />;
}

export default function SolicitacaoPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Seus dados (LGPD)</h1>
        <p className="mt-3 text-muted-foreground">
          Use este formulário para exercer os direitos previstos no art. 18 da LGPD. Respondemos por e-mail em até 15 dias e
          podemos pedir informações para confirmar sua identidade.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-folha p-4 text-sm">
          <p className="font-medium">Tem conta? Resolva na hora em Minha conta</p>
          <p className="mt-1 text-muted-foreground">
            Em <Link href="/painel/conta" className="text-tinta underline underline-offset-2">Minha conta</Link> você corrige
            seus dados, baixa uma cópia completa (portabilidade) e exclui a conta, sem esperar resposta.
          </p>
        </div>

        <section aria-labelledby="titulo-form" className="folha mt-8 px-5 py-6 sm:px-8 sm:py-8">
          <h2 id="titulo-form" className="mb-5 text-base font-semibold">
            Nova solicitação
          </h2>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <FormularioPreenchido />
          </Suspense>
        </section>

        <div className="mt-8 space-y-2 text-sm text-muted-foreground">
          <p>
            {EMPRESA.encarregado
              ? `Encarregado pelo tratamento de dados: ${EMPRESA.encarregado.nome} · ${EMPRESA.encarregado.email}`
              : "Ainda não há encarregado designado: este formulário é o canal oficial para pedidos sobre dados pessoais."}
          </p>
          <p>
            Se a resposta não resolver, você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
            Saiba como tratamos seus dados na <Link href="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
