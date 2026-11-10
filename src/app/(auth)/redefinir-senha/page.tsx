import { Suspense } from "react";
import type { Metadata } from "next";
import { RedefinirSenhaForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function RedefinirSenhaPage() {
  return (
    <>
      <h1 className="mb-6 font-serif text-2xl font-semibold">Criar nova senha</h1>
      <Suspense>
        <RedefinirSenhaForm />
      </Suspense>
    </>
  );
}
