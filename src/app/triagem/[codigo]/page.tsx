import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { advogadoDaTriagem } from "@/lib/crm";
import { EMPRESA } from "@/lib/legal";
import { TriagemForm } from "./form";

// Link pessoal do advogado: não deve aparecer em buscadores.
export const metadata: Metadata = { title: "Triagem do seu caso", robots: { index: false, follow: false } };

async function Conteudo({ params }: { params: PageProps<"/triagem/[codigo]">["params"] }) {
  const { codigo } = await params;
  const advogado = await advogadoDaTriagem(codigo);

  if (!advogado) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-xl font-semibold">Link indisponível</h1>
        <p className="text-sm text-muted-foreground">Este link de triagem não está ativo. Fale diretamente com o advogado ou escritório.</p>
      </div>
    );
  }

  const identificacao = [advogado.nome, advogado.oab].filter(Boolean).join(", ");
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{advogado.escritorio ?? "Atendimento jurídico"}</p>
        <h1 className="font-serif text-2xl font-semibold">Conte sobre o seu caso</h1>
        <p className="text-sm text-muted-foreground">
          As respostas vão para {identificacao}, que vai avaliar o caso e entrar em contato. Leva poucos minutos.
        </p>
      </header>

      <TriagemForm codigo={codigo} advogado={advogado.nome} />

      <section aria-labelledby="aviso" className="space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <h2 id="aviso" className="font-medium text-grafite">
          Como seus dados são usados
        </h2>
        <p>
          Quem decide sobre o uso dos seus dados é {identificacao} (controlador), que vai usá-los só para avaliar o seu caso e
          falar com você (LGPD, art. 7º, V: procedimentos preliminares a um contrato, a seu pedido). O {EMPRESA.nomeFantasia}{" "}
          apenas hospeda o formulário e organiza as respostas para o advogado (operador), sem usá-las para outra finalidade.
          Uma ferramenta de inteligência artificial que roda no próprio {EMPRESA.nomeFantasia} lê o relato, com CPF, telefones
          e e-mails ocultos, para sugerir ao advogado a complexidade do caso; ela não decide nada sobre você.
        </p>
        <p>
          Enviar este formulário não contrata o advogado nem garante atendimento. Para acessar, corrigir ou apagar seus dados,
          peça ao advogado. Mais detalhes na{" "}
          <Link href="/privacidade" className="underline underline-offset-2">
            Política de Privacidade do {EMPRESA.nomeFantasia}
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default function TriagemPage({ params }: PageProps<"/triagem/[codigo]">) {
  return (
    <main id="conteudo" className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="folha w-full max-w-xl px-5 py-7 sm:px-8">
        <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
          <Conteudo params={params} />
        </Suspense>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        Formulário oferecido por <Wordmark className="scale-75" />
      </p>
    </main>
  );
}
