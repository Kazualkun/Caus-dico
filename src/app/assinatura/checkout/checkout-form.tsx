"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/form-bits";
import { iniciarCheckout } from "../actions";
import type { Cycle, PlanId } from "@/lib/plans";

const FORMAS = [
  { valor: "PIX", nome: "Pix", detalhe: "Confirmação em segundos. A cada renovação, você recebe um novo Pix por e-mail." },
  { valor: "CREDIT_CARD", nome: "Cartão de crédito", detalhe: "Confirmação imediata e renovação automática no cartão." },
  { valor: "BOLETO", nome: "Boleto", detalhe: "O acesso é liberado após a compensação, em até 3 dias úteis." },
] as const;

export function CheckoutForm({
  plano,
  ciclo,
  nome,
  documento,
}: {
  plano: PlanId;
  ciclo: Cycle;
  nome: string;
  documento: string;
}) {
  const [state, action] = useActionState(iniciarCheckout, undefined);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="plano" value={plano} />
      <input type="hidden" name="ciclo" value={ciclo} />

      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo ou razão social</Label>
        <Input id="nome" name="nome" defaultValue={nome} required autoComplete="name" className="h-10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
          <Input id="cpfCnpj" name="cpfCnpj" defaultValue={documento} required className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="celular">Celular</Label>
          <Input id="celular" name="celular" type="tel" autoComplete="tel" placeholder="(11) 91234-5678" className="h-10" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>
        {FORMAS.map((f, i) => (
          <label
            key={f.valor}
            className="flex cursor-pointer gap-3 rounded-lg border border-border bg-folha p-3.5 has-checked:border-tinta has-checked:bg-accent/60"
          >
            <input type="radio" name="billingType" value={f.valor} defaultChecked={i === 0} className="mt-1 accent-tinta" />
            <span>
              <span className="block text-sm font-medium">{f.nome}</span>
              <span className="block text-sm text-muted-foreground">{f.detalhe}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2 rounded-lg border border-border bg-folha p-4 text-sm">
        <p className="font-medium">Antes de pagar</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            A assinatura renova automaticamente a cada {ciclo === "anual" ? "ano" : "mês"}, pelo mesmo valor, até você
            cancelar.
          </li>
          <li>Você cancela a qualquer momento em Minha conta, sem multa, e mantém o acesso até o fim do período pago.</li>
          <li>
            Se desistir em até 7 dias do pagamento da contratação (ou da renovação anual), devolvemos o valor integral (CDC,
            art. 49).
          </li>
        </ul>
        <label className="flex gap-2.5 pt-1">
          <input type="checkbox" name="ciente" required className="mt-0.5 accent-tinta" />
          <span>
            Li e concordo com as condições acima, com os{" "}
            <Link href="/termos" target="_blank" className="text-tinta underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e com a{" "}
            <Link href="/cancelamento-e-reembolso" target="_blank" className="text-tinta underline underline-offset-2">
              Política de Cancelamento e Reembolso
            </Link>
            .
          </span>
        </label>
      </div>

      <FormError message={state?.error} />
      <SubmitButton size="lg" className="h-11 w-full text-[0.95rem]" pendingText="Gerando a cobrança…">
        Ir para o pagamento
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        O pagamento é processado pelo Asaas, que recebe seu nome, CPF ou CNPJ, e-mail e celular para emitir a cobrança e a
        nota fiscal. Os dados do cartão são digitados na página segura do Asaas e não passam pelo Causídico. Detalhes na{" "}
        <Link href="/privacidade" target="_blank" className="underline underline-offset-2">
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}
