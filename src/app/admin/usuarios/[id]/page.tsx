import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, registrosAcesso, searchHistory, sessions, subscriptions, users } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton, ConfirmActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, Tabela } from "@/components/admin/visual";
import { papeisAtribuiveis, requirePapel, temPapel, type Papel } from "@/lib/auth";
import { getMonthlyUsage } from "@/lib/usage";
import { formatBRL, formatDateTime } from "@/lib/format";
import { PLANS, RECURSO_LABEL, type Recurso } from "@/lib/plans";
import { alterarPapel, alternarBloqueio, encerrarSessoes } from "../actions";

export const metadata: Metadata = { title: "Usuário" };

async function Usuario({ params }: { params: PageProps<"/admin/usuarios/[id]">["params"] }) {
  const ator = await requirePapel("suporte");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) notFound();
  const papel = (u.role ?? "usuario") as Papel;

  const [[sub], uso, tarefas, pesquisas, nSessoes, acessos] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, id)).limit(1),
    getMonthlyUsage(id),
    // Só metadados: o conteúdo dos contratos e pesquisas não aparece para a equipe.
    db.select({ id: contracts.id, kind: contracts.kind, title: contracts.title, status: contracts.status, error: contracts.error, createdAt: contracts.createdAt })
      .from(contracts).where(eq(contracts.userId, id)).orderBy(desc(contracts.createdAt)).limit(10),
    db.select({ id: searchHistory.id, status: searchHistory.status, error: searchHistory.error, createdAt: searchHistory.createdAt })
      .from(searchHistory).where(eq(searchHistory.userId, id)).orderBy(desc(searchHistory.createdAt)).limit(10),
    db.$count(sessions, eq(sessions.userId, id)),
    temPapel(ator, "administrador")
      ? db.select().from(registrosAcesso).where(eq(registrosAcesso.userId, id)).orderBy(desc(registrosAcesso.createdAt)).limit(10)
      : Promise.resolve([]),
  ]);
  const atribuiveis = papeisAtribuiveis(ator);
  const podeGerir = ator.id !== u.id && (ator.role === "desenvolvedor" || (temPapel(ator, "administrador") && !temPapel({ role: papel }, ator.role)));

  return (
    <div className="space-y-10">
      <PageHeader
        title={u.name}
        description={`${u.email}${u.blockedAt ? ` — bloqueado em ${formatDateTime(u.blockedAt)}` : ""}`}
        actions={
          <>
            <ActionButton variant="outline" action={encerrarSessoes.bind(null, u.id)} successText="Sessões encerradas">
              Encerrar sessões ({nSessoes})
            </ActionButton>
            {podeGerir && (
              <ConfirmActionButton
                variant={u.blockedAt ? "outline" : "destructive"}
                action={alternarBloqueio.bind(null, u.id)}
                confirmText={u.blockedAt ? "Desbloquear este usuário?" : "Bloquear este usuário? Ele será desconectado e não conseguirá entrar."}
              >
                {u.blockedAt ? "Desbloquear" : "Bloquear"}
              </ConfirmActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Conta">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 rounded-lg border border-border bg-folha p-5 text-sm">
            <dt className="text-muted-foreground">Papel</dt>
            <dd className="space-y-2">
              <span>{papel}</span>
              {podeGerir && atribuiveis.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {atribuiveis
                    .filter((p) => p !== papel)
                    .map((p) => (
                      <ConfirmActionButton
                        key={p}
                        size="sm"
                        variant="outline"
                        action={alterarPapel.bind(null, u.id, p)}
                        confirmText={`Mudar o papel de ${u.email} para "${p}"?`}
                      >
                        Tornar {p}
                      </ConfirmActionButton>
                    ))}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">E-mail confirmado</dt>
            <dd>{u.emailVerified ? "Sim" : "Não"}</dd>
            <dt className="text-muted-foreground">OAB</dt>
            <dd>{u.oabNumber ? `${u.oabNumber}/${u.oabUf ?? ""}` : "—"}</dd>
            <dt className="text-muted-foreground">Cadastro</dt>
            <dd>{formatDateTime(u.createdAt)}</dd>
          </dl>
        </Section>

        <Section title="Assinatura e uso">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 rounded-lg border border-border bg-folha p-5 text-sm">
            <dt className="text-muted-foreground">Plano</dt>
            <dd>{sub ? `${PLANS[sub.plan].nome}, ${sub.cycle}, ${formatBRL(sub.valueCents)}` : "Sem assinatura"}</dd>
            {sub && (
              <>
                <dt className="text-muted-foreground">Situação</dt>
                <dd>{sub.status}{sub.refundedAt ? " (reembolsada)" : ""}</dd>
                <dt className="text-muted-foreground">Período pago até</dt>
                <dd>{sub.currentPeriodEnd ? formatDateTime(sub.currentPeriodEnd) : "—"}</dd>
                <dt className="text-muted-foreground">ID no Asaas</dt>
                <dd className="font-mono text-xs">{sub.providerSubscriptionId ?? "—"}</dd>
              </>
            )}
            {(Object.keys(uso) as Recurso[]).map((r) => (
              <div key={r} className="contents">
                <dt className="text-muted-foreground">{RECURSO_LABEL[r]}</dt>
                <dd>{uso[r]} neste mês</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <Section title="Tarefas recentes (sem o conteúdo)">
        <Tabela cabecalho={["Quando", "Tipo", "Título", "Situação"]} vazio={tarefas.length + pesquisas.length === 0}>
          {[
            ...tarefas.map((t) => ({ id: t.id, quando: t.createdAt, tipo: t.kind === "analise" ? "Auditoria" : "Minuta", titulo: t.title, status: t.status, erro: t.error })),
            ...pesquisas.map((p) => ({ id: p.id, quando: p.createdAt, tipo: "Pesquisa", titulo: "—", status: p.status, erro: p.error })),
          ]
            .sort((a, b) => b.quando.getTime() - a.quando.getTime())
            .map((t) => (
              <tr key={t.id}>
                <Celula className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.quando)}</Celula>
                <Celula>{t.tipo}</Celula>
                <Celula>{t.titulo}</Celula>
                <Celula className={t.status === "erro" ? "text-carimbo" : undefined}>{t.erro ? `erro: ${t.erro}` : t.status}</Celula>
              </tr>
            ))}
        </Tabela>
      </Section>

      {acessos.length > 0 && (
        <Section title="Registros de acesso">
          <Tabela cabecalho={["Quando", "Evento", "IP", "Navegador"]}>
            {acessos.map((a) => (
              <tr key={a.id}>
                <Celula className="whitespace-nowrap">{formatDateTime(a.createdAt)}</Celula>
                <Celula>{a.evento}</Celula>
                <Celula className="font-mono text-xs">{a.ip ?? "—"}</Celula>
                <Celula className="max-w-xs truncate text-muted-foreground">{a.userAgent ?? "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        </Section>
      )}
    </div>
  );
}

export default async function UsuarioPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("suporte");
  return (
    <Suspense fallback={<Skeleton className="h-[30rem] w-full" />}>
      <Usuario params={params} />
    </Suspense>
  );
}
