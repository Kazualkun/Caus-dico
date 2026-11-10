import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-parts";
import { requirePapel } from "@/lib/auth";
import { proporInclusaoAction } from "../../curadoria/actions";
import { FormNorma } from "../../form-norma";

export const metadata: Metadata = { title: "Incluir norma" };
export const maxDuration = 60;

async function Formulario() {
  await requirePapel("administrador");
  return <FormNorma acao={proporInclusaoAction} />;
}

export default async function NovaNormaPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-8">
      <PageHeader
        title="Incluir norma"
        description="Para normas que ainda não estão no acervo (por exemplo, publicadas hoje no Diário Oficial). O texto é conferido com a fonte oficial e só entra no acervo depois da aprovação de outro revisor."
      />
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}
