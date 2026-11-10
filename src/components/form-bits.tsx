"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, Loader2Icon, OctagonAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Botão de envio que mostra o estado pendente do formulário. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <OctagonAlertIcon aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Atualiza a página periodicamente enquanto uma tarefa está em andamento. */
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiado(true);
          toast.success("Texto copiado");
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto manualmente.");
        }
      }}
    >
      {copiado ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      {copiado ? "Copiado" : label}
    </Button>
  );
}

/** Botão que pede confirmação antes de executar uma Server Action destrutiva. */
export function ConfirmActionButton({
  action,
  confirmText,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  action: () => Promise<unknown>;
  confirmText: string;
}) {
  const [pendente, setPendente] = useState(false);
  return (
    <Button
      type="button"
      disabled={pendente}
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setPendente(true);
        try {
          const resultado = (await action()) as { error?: string; mensagem?: string } | undefined;
          if (resultado?.error) toast.error(resultado.error);
          else if (resultado?.mensagem) toast.success(resultado.mensagem);
        } finally {
          setPendente(false);
        }
      }}
      {...props}
    >
      {pendente && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Botão para Server Actions sem confirmação (ex.: tentar novamente, redigir carta). */
export function ActionButton({
  action,
  pendingText,
  successText,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  action: () => Promise<unknown>;
  pendingText?: string;
  successText?: string;
}) {
  const [pendente, setPendente] = useState(false);
  return (
    <Button
      type="button"
      disabled={pendente}
      onClick={async () => {
        setPendente(true);
        try {
          const resultado = (await action()) as { error?: string } | undefined;
          if (resultado?.error) toast.error(resultado.error);
          else if (successText) toast.success(successText);
        } finally {
          setPendente(false);
        }
      }}
      {...props}
    >
      {pendente && <Loader2Icon className="animate-spin" aria-hidden />}
      {pendente ? (pendingText ?? children) : children}
    </Button>
  );
}
