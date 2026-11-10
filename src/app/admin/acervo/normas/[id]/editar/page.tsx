import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-parts";
import { requirePapel } from "@/lib/auth";
import { dadosDe, normaParaCuradoria } from "@/lib/acervo/curadoria";
import { proporEdicaoAction } from "../../../curadoria/actions";
import { FormNorma } from "../../../form-norma";

export const metadata: Metadata = { title: "Corrigir norma" };
export const maxDuration = 60;

async function Formulario({ params }: { params: PageProps<"/admin/acervo/normas/[id]/editar">["params"] }) {
  await requirePapel("administrador");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const norma = await normaParaCuradoria(id);
  if (!norma) notFound();
  return (
    <>
      <PageHeader
        title={`Corrigir: ${norma.apelido ?? norma.titulo}`}
        description={
          <>
            A correção é conferida com a fonte oficial e só é publicada depois da aprovação de outro revisor. A versão atual fica guardada no
            histórico.{" "}
            <Link href={`/admin/acervo/normas/${id}`} className="text-tinta underline underline-offset-2">
              Voltar à norma
            </Link>
          </>
        }
      />
      <FormNorma acao={proporEdicaoAction.bind(null, id)} inicial={dadosDe(norma)} texto={norma.texto} fonte={norma.fonteUrl} edicao />
    </>
  );
}

export default async function EditarNormaPage({ params }: PageProps<"/admin/acervo/normas/[id]/editar">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("administrador");
  return (
    <div className="space-y-8">
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <Formulario params={params} />
      </Suspense>
    </div>
  );
}
