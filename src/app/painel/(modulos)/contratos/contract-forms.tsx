"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { FileUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/form-bits";
import { cn } from "@/lib/utils";
import { auditarContrato } from "./actions";

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

const PERSPECTIVAS = [
  { valor: "contratante", nome: "Contratante", detalhe: "Quem recebe o serviço e paga" },
  { valor: "contratado", nome: "Contratado(a)", detalhe: "Quem presta o serviço e recebe" },
  { valor: "neutra", nome: "Revisão neutra", detalhe: "Riscos para as duas partes" },
];

/** `limiteCaracteres` vem do servidor: depende do contexto configurado para a IA local. */
export function AuditForm({ limiteCaracteres, clientes }: { limiteCaracteres: number; clientes: { id: string; nome: string }[] }) {
  const [state, formAction, pendente] = useActionState(auditarContrato, undefined);
  const [modo, setModo] = useState<"arquivo" | "texto">("arquivo");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string>();
  const paginas = Math.floor(limiteCaracteres / 3400);

  // Validação no navegador antes de enviar; o servidor valida de novo.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroEnvio(undefined);
    const dados = new FormData(e.currentTarget);
    if (modo === "arquivo") {
      const arquivo = dados.get("arquivo");
      if (!(arquivo instanceof File) || arquivo.size === 0) return setErroEnvio("Escolha um arquivo PDF ou DOCX.");
      const extensao = arquivo.name.split(".").pop()?.toLowerCase();
      if (extensao !== "pdf" && extensao !== "docx") return setErroEnvio("Envie um arquivo .pdf ou .docx.");
      if (arquivo.size > TAMANHO_MAXIMO) return setErroEnvio("O arquivo passa de 20 MB.");
      dados.delete("texto");
    } else {
      dados.delete("arquivo");
      const texto = String(dados.get("texto") ?? "").trim();
      if (texto.length > limiteCaracteres) {
        return setErroEnvio(`O texto tem ${texto.length.toLocaleString("pt-BR")} caracteres; o limite é ${limiteCaracteres.toLocaleString("pt-BR")}. Divida o contrato em partes.`);
      }
    }
    startTransition(() => formAction(dados));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Nome do contrato</Label>
          <Input id="titulo" name="titulo" placeholder="Ex.: Prestação de serviços de TI — Fornecedor X" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clienteId">Cliente (opcional)</Label>
          <select id="clienteId" name="clienteId" defaultValue="" className="h-9 w-full rounded-lg border border-input bg-folha px-2.5 text-sm">
            <option value="">Sem vínculo</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Você representa</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERSPECTIVAS.map((p, i) => (
            <label
              key={p.valor}
              className="flex cursor-pointer gap-2.5 rounded-lg border border-border bg-folha p-3 has-checked:border-tinta has-checked:bg-accent/60"
            >
              <input type="radio" name="perspectiva" value={p.valor} defaultChecked={i === 0} className="mt-1 accent-tinta" />
              <span>
                <span className="block text-sm font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{p.detalhe}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <div role="radiogroup" aria-label="Como enviar o contrato" className="inline-flex rounded-lg border border-border bg-folha p-1 text-sm">
          {(["arquivo", "texto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={cn("rounded-md px-3 py-1.5", modo === m ? "bg-tinta text-white" : "text-muted-foreground hover:text-grafite")}
            >
              {m === "arquivo" ? "Enviar arquivo" : "Colar texto"}
            </button>
          ))}
        </div>

        {modo === "arquivo" ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-folha px-6 py-10 text-center hover:border-tinta has-focus-visible:ring-2 has-focus-visible:ring-ring/50">
            <FileUpIcon className="size-6 text-tinta" aria-hidden />
            <span className="text-sm font-medium">{nomeArquivo ?? "Escolha um PDF ou DOCX"}</span>
            <span className="text-xs text-muted-foreground">
              Até 20 MB e cerca de {paginas} páginas de texto. PDFs digitalizados (imagem) não têm texto pesquisável. O arquivo é lido para extrair o texto e não fica guardado.
            </span>
            <input
              type="file"
              name="arquivo"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        ) : (
          <Textarea name="texto" rows={12} placeholder={`Cole aqui o texto integral do contrato (até ${limiteCaracteres.toLocaleString("pt-BR")} caracteres)`} className="texto-juridico" />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Contexto para a análise</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Opcional. Ex.: o cliente quer sair do contrato em 6 meses; preocupa a cláusula de exclusividade."
        />
      </div>

      <FormError message={erroEnvio ?? state?.error} />
      <SubmitButton size="lg" className="h-10 px-5" disabled={pendente}>
        {pendente ? "Enviando e registrando…" : "Auditar contrato"}
      </SubmitButton>
    </form>
  );
}
