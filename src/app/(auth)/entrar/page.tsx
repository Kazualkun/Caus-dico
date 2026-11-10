import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "../auth-forms";
import { JaConectado } from "../ja-conectado";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <>
      <h1 className="mb-6 font-serif text-2xl font-semibold">Entrar</h1>
      <Suspense>
        <JaConectado searchParams={searchParams} voltarPara="/entrar" rotuloSair="Sair e entrar com outra conta">
          <LoginForm />
        </JaConectado>
      </Suspense>
    </>
  );
}
