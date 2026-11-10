import Link from "next/link";
import { ActionButton, ConfirmActionButton } from "@/components/form-bits";
import { AREAS, COMPLEXIDADES, RISCOS } from "@/lib/pricing/engine";
import { ASSUNTOS_TRIAGEM } from "@/lib/triagem";
import { formatDateTime } from "@/lib/format";
import type { TriagemRow } from "@/lib/types";
import { excluirTriagem, marcarTriagemVista } from "./actions";

/** Respostas da triagem e a sugestão da IA, como o advogado vê no CRM. */
export function ResumoTriagem({ t, comLinkCliente }: { t: TriagemRow; comLinkCliente?: boolean }) {
  const r = t.respostas;
  const a = t.analise;
  return (
    <article className="space-y-3 rounded-lg border border-border bg-folha p-5 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {comLinkCliente && t.clienteId ? (
              <Link href={`/painel/clientes/${t.clienteId}`} className="text-tinta underline underline-offset-2">
                {r.nome}
              </Link>
            ) : (
              r.nome
            )}
            {!t.vistaEm && <span className="ml-2 rounded-full bg-tinta px-2 py-0.5 text-xs text-white">nova</span>}
          </p>
          <p className="text-muted-foreground">
            {[r.telefone, r.email, [r.cidade, r.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")} · recebida em{" "}
            {formatDateTime(t.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {!t.vistaEm && (
            <ActionButton size="sm" variant="outline" action={marcarTriagemVista.bind(null, t.id)} pendingText="…">
              Marcar como vista
            </ActionButton>
          )}
          <ConfirmActionButton
            size="sm"
            variant="ghost"
            action={excluirTriagem.bind(null, t.id, t.clienteId)}
            confirmText="Excluir esta triagem? As respostas do cliente serão apagadas."
          >
            Excluir
          </ConfirmActionButton>
        </div>
      </header>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Assunto</dt>
        <dd>{ASSUNTOS_TRIAGEM.find((x) => x.id === r.assunto)?.nome}</dd>
        <dt className="text-muted-foreground">Relato</dt>
        <dd className="whitespace-pre-wrap">{r.relato}</dd>
        {r.quando && (
          <>
            <dt className="text-muted-foreground">Quando</dt>
            <dd>{r.quando}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Documentos</dt>
        <dd>{{ sim: "Tem", nao: "Não tem", nao_sei: "Não sabe" }[r.temDocumentos]}</dd>
        {r.objetivo && (
          <>
            <dt className="text-muted-foreground">Espera</dt>
            <dd>{r.objetivo}</dd>
          </>
        )}
      </dl>
      <div className="rounded-md bg-accent/50 p-3">
        {t.status === "processando" && <p className="text-muted-foreground">A IA está analisando o caso…</p>}
        {t.status === "erro" && <p className="text-atencao">A análise automática não foi concluída: {t.error}</p>}
        {a && (
          <div className="space-y-1.5">
            <p>
              <span className="font-medium">Sugestão da IA:</span> {AREAS.find((x) => x.id === a.area)?.nome}, complexidade{" "}
              {COMPLEXIDADES[a.complexidade].nome.toLowerCase()}, risco {RISCOS[a.risco].nome.toLowerCase()}.
            </p>
            <p className="text-muted-foreground">{a.justificativa_complexidade}</p>
            {a.informacoes_faltantes.length > 0 && (
              <p className="text-muted-foreground">
                Falta saber: {a.informacoes_faltantes.map((s) => s.replace(/[.;]\s*$/, "")).join("; ")}.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
