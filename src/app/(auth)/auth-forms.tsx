"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheckIcon, MailCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import { cadastrar, entrar, pedirRedefinicaoSenha, redefinirSenha } from "./actions";
import { UFS } from "@/lib/format";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(entrar, undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {params.get("senha") === "redefinida" && (
        <p className="flex gap-2 rounded-md bg-deferido/10 px-3 py-2 text-sm text-deferido" role="status">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Senha redefinida. Entre com a nova senha.
        </p>
      )}
      {params.get("sessao") === "expirada" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">
          Sua sessão terminou. Entre de novo para continuar.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link href="/recuperar-senha" className="text-xs text-tinta underline underline-offset-2">
            Esqueci minha senha
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
      </div>
      <FormError message={state?.error} />
      <SubmitButton className="h-10 w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-tinta underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(cadastrar, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center" role="status">
        <MailCheckIcon className="mx-auto size-8 text-tinta" aria-hidden />
        <h2 className="font-serif text-xl font-semibold">Confirme seu e-mail</h2>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação. Depois de clicar nele, você escolhe o plano e começa a usar.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required className="h-10" />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="oab_number">Inscrição na OAB (opcional)</Label>
          <Input id="oab_number" name="oab_number" inputMode="numeric" className="h-10" aria-describedby="oab-ajuda" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oab_uf">UF</Label>
          <select id="oab_uf" name="oab_uf" defaultValue="" className="h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id="oab-ajuda" className="-mt-3 text-xs text-muted-foreground">
        Aparece nas propostas de honorários que você gerar.
      </p>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-10"
          aria-describedby="senha-ajuda"
        />
        <p id="senha-ajuda" className="text-xs text-muted-foreground">
          Mínimo de 8 caracteres.
        </p>
      </div>
      <label className="flex gap-2.5 text-sm">
        <input type="checkbox" name="aceite" required className="mt-0.5 accent-tinta" />
        <span>
          Tenho 18 anos ou mais e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-tinta underline underline-offset-2">
            Termos de Uso
          </Link>
          .
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Usamos seu nome, e-mail e inscrição na OAB para criar e manter a conta. Saiba como tratamos seus dados na{" "}
        <Link href="/privacidade" target="_blank" className="underline underline-offset-2">
          Política de Privacidade
        </Link>
        .
      </p>
      <FormError message={state?.error} />
      <SubmitButton className="h-10 w-full" pendingText="Criando conta…">
        Criar conta
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-tinta underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function RecuperarSenhaForm() {
  const [state, action] = useActionState(pedirRedefinicaoSenha, undefined);
  if (state?.ok) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha. O link vale por 1 hora.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail da conta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <FormError message={state?.error} />
      <SubmitButton className="h-10 w-full" pendingText="Enviando…">
        Enviar link de redefinição
      </SubmitButton>
    </form>
  );
}

export function RedefinirSenhaForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(redefinirSenha, undefined);
  const token = params.get("token") ?? "";
  if (!token || params.get("error")) {
    return (
      <p className="text-sm text-muted-foreground">
        Este link é inválido ou expirou.{" "}
        <Link href="/recuperar-senha" className="text-tinta underline underline-offset-2">
          Peça um novo link
        </Link>
        .
      </p>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
      </div>
      <FormError message={state?.error} />
      <SubmitButton className="h-10 w-full" pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
