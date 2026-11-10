import type { Metadata } from "next";
import { RecuperarSenhaForm } from "../auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold">Recuperar senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">Informe o e-mail da conta para receber o link de redefinição.</p>
      <RecuperarSenhaForm />
    </>
  );
}
