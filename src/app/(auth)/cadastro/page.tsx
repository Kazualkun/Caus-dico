import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "../auth-forms";
import { JaConectado } from "../ja-conectado";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage({ searchParams }: PageProps<"/cadastro">) {
  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold">Criar conta</h1>
      <p className="mb-6 text-sm text-muted-foreground">Depois do cadastro, você escolhe o plano e paga por Pix ou cartão.</p>
      <Suspense>
        <JaConectado searchParams={searchParams} voltarPara="/cadastro" rotuloSair="Sair e criar outra conta">
          <SignupForm />
        </JaConectado>
      </Suspense>
    </>
  );
}
