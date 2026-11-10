import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { MessageCircleIcon } from "lucide-react";
import { db } from "@/db";
import { clientes, triagens } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, ConfirmActionButton, CopyButton } from "@/components/form-bits";
import { EmptyState, PageHeader, Section } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";
import { garantirLinkTriagem, ORIGENS_CLIENTE, STATUS_CLIENTE, type StatusCliente } from "@/lib/crm";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { alternarLinkTriagem, criarCliente, gerarNovoLinkTriagem } from "./actions";
import { ClienteForm } from "./forms";
import { ResumoTriagem } from "./triagem-bits";
import { SeloCliente } from "@/components/app/situacao";

export const metadata: Metadata = { title: "Clientes" };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function LinkDeTriagem() {
  const viewer = await requireSubscriber();
  const link = await garantirLinkTriagem(viewer.id);
  const url = `${SITE}/triagem/${link.codigo}`;
  const mensagem = `Olá! Para eu entender o seu caso, responda a estas perguntas rápidas: ${url}`;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-folha p-5">
      <div className="space-y-1">
        <p className="font-medium">Seu link de triagem</p>
        <p className="text-sm text-muted-foreground">
          Mande pelo WhatsApp a quem pedir atendimento. A pessoa responde pelo celular, o caso entra aqui como lead e a IA
          sugere a complexidade e o risco. Nada é redigido automaticamente.
        </p>
      </div>
      {link.ativo ? (
        <>
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">{url}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={url} label="Copiar link" />
            <Button asChild size="sm">
              <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer">
                <MessageCircleIcon className="size-4" aria-hidden />
                Enviar pelo WhatsApp
              </a>
            </Button>
            <ActionButton size="sm" variant="outline" action={alternarLinkTriagem.bind(null, false)} pendingText="…">
              Desativar
            </ActionButton>
            <ConfirmActionButton
              size="sm"
              variant="ghost"
              action={gerarNovoLinkTriagem}
              confirmText="Gerar um link novo? O link atual deixa de funcionar na hora."
            >
              Gerar link novo
            </ConfirmActionButton>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-atencao">Link desativado: quem abrir verá que ele está indisponível.</p>
          <ActionButton size="sm" action={alternarLinkTriagem.bind(null, true)} pendingText="…">
            Reativar
          </ActionButton>
        </div>
      )}
    </div>
  );
}

async function NovasTriagens() {
  const viewer = await requireSubscriber();
  const lista = await db
    .select()
    .from(triagens)
    .where(and(eq(triagens.userId, viewer.id), isNull(triagens.vistaEm)))
    .orderBy(desc(triagens.createdAt))
    .limit(20);
  if (!lista.length) return null;
  return (
    <Section title={`Novas triagens (${lista.length})`}>
      <div className="space-y-4">
        {lista.map((t) => (
          <ResumoTriagem key={t.id} t={t} comLinkCliente />
        ))}
      </div>
    </Section>
  );
}

async function Lista({ searchParams }: { searchParams: PageProps<"/painel/clientes">["searchParams"] }) {
  const viewer = await requireSubscriber();
  const { status } = await searchParams;
  const filtro = typeof status === "string" && status in STATUS_CLIENTE ? (status as StatusCliente) : null;

  const [contagens, lista] = await Promise.all([
    db.select({ status: clientes.status, n: count() }).from(clientes).where(eq(clientes.userId, viewer.id)).groupBy(clientes.status),
    db
      .select()
      .from(clientes)
      .where(filtro ? and(eq(clientes.userId, viewer.id), eq(clientes.status, filtro)) : eq(clientes.userId, viewer.id))
      .orderBy(desc(clientes.updatedAt))
      .limit(200),
  ]);
  const total = contagens.reduce((s, c) => s + c.n, 0);
  const abas: [StatusCliente | null, string, number][] = [
    [null, "Todos", total],
    ...(Object.keys(STATUS_CLIENTE) as StatusCliente[]).map(
      (s) => [s, STATUS_CLIENTE[s], contagens.find((c) => c.status === s)?.n ?? 0] as [StatusCliente, string, number],
    ),
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Situação" className="flex flex-wrap gap-2">
        {abas.map(([s, nome, n]) => (
          <Link
            key={nome}
            href={s ? `/painel/clientes?status=${s}` : "/painel/clientes"}
            aria-current={filtro === s ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              filtro === s ? "border-tinta bg-tinta text-white" : "border-border bg-folha hover:border-tinta",
            )}
          >
            {nome} <span className="opacity-75">{n}</span>
          </Link>
        ))}
      </nav>
      {lista.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-folha">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/painel/clientes/${c.id}`} className="grid gap-1 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:gap-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.nome}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[c.telefone, c.email, ORIGENS_CLIENTE[c.origem]].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-sm sm:flex-col sm:items-end sm:gap-1">
                  <SeloCliente status={c.status} />
                  <span className="text-muted-foreground">{formatDateTime(c.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={filtro ? "Nenhum cliente nesta situação" : "Nenhum cliente ainda"}>
          Cadastre abaixo, mande o link de triagem ou salve uma proposta na calculadora.
        </EmptyState>
      )}
    </div>
  );
}

export default function ClientesPage({ searchParams }: PageProps<"/painel/clientes">) {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Clientes"
        description="Leads, negociações e clientes, com as propostas da calculadora, as auditorias, os processos e as triagens de cada um."
      />
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <LinkDeTriagem />
      </Suspense>
      <Suspense fallback={null}>
        <NovasTriagens />
      </Suspense>
      <Section title="Funil">
        <Suspense fallback={<Skeleton className="h-60 w-full" />}>
          <Lista searchParams={searchParams} />
        </Suspense>
      </Section>
      <Section title="Novo cliente">
        <ClienteForm action={criarCliente} status={STATUS_CLIENTE} origens={ORIGENS_CLIENTE} rotulo="Cadastrar cliente" />
      </Section>
      <p className="text-xs text-muted-foreground">
        Você é o responsável (controlador) pelos dados dos seus clientes; o Causídico só os guarda e organiza para você. Cadastre
        apenas o necessário e apague o que não precisar mais.
      </p>
    </div>
  );
}
