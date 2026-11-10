import { Suspense } from "react";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, pool } from "@/db";
import { emailsSaida } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/form-bits";
import { PageHeader, Section } from "@/components/app/page-parts";
import { Celula, SeloEstado, Tabela } from "@/components/admin/visual";
import { requirePapel } from "@/lib/auth";
import { medirLatencia } from "@/lib/admin/consultas";
import { CONTEXTO_TOKENS, MODEL } from "@/lib/ai/ollama";
import { espelhoExiste, espacoLivre, pastaDoEspelho } from "@/lib/acervo/espelho";
import { PARSER_VERSAO } from "@/lib/acervo/parser";
import { formatDateTime } from "@/lib/format";
import { dadosFaltantes } from "@/lib/legal";
import { executarRetencao, limparCacheDoAcervo } from "./actions";

export const metadata: Metadata = { title: "Sistema" };

/** Só se mostra SE a variável existe — nunca o valor. */
const VARIAVEIS: { nome: string; para: string; obrigatoria: boolean }[] = [
  { nome: "DATABASE_URL", para: "Banco de dados (local ou Neon)", obrigatoria: true },
  { nome: "BETTER_AUTH_SECRET", para: "Assinatura dos cookies de sessão", obrigatoria: true },
  { nome: "BETTER_AUTH_URL", para: "Endereço público usado nos links de e-mail", obrigatoria: true },
  { nome: "OLLAMA_URL", para: "Servidor da IA local (padrão http://127.0.0.1:11434)", obrigatoria: false },
  { nome: "OLLAMA_MODEL", para: "Modelo da IA local (padrão qwen3.5:9b)", obrigatoria: false },
  { nome: "OLLAMA_NUM_CTX", para: "Contexto da IA em tokens; define o tamanho máximo do contrato (padrão 32768)", obrigatoria: false },
  { nome: "ASAAS_API_KEY", para: "Cobrança das assinaturas", obrigatoria: true },
  { nome: "ASAAS_WEBHOOK_TOKEN", para: "Autenticação do webhook do Asaas", obrigatoria: true },
  { nome: "CRON_SECRET", para: "Rotina diária (/api/cron/diario)", obrigatoria: true },
  { nome: "RESEND_API_KEY", para: "Envio real de e-mails", obrigatoria: false },
  { nome: "EMAIL_REMETENTE", para: "Remetente dos e-mails enviados pela Resend", obrigatoria: false },
];

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

async function Banco() {
  await requirePapel("desenvolvedor");
  const [[{ rows: info }, { rows: tabelas }, { rows: extensoes }], latencia] = await medirLatencia(() => Promise.all([
    pool.query<{ versao: string; tamanho: string; conexoes: number }>(
      `select current_setting('server_version') as versao, pg_size_pretty(pg_database_size(current_database())) as tamanho,
              (select count(*)::int from pg_stat_activity where datname = current_database()) as conexoes`,
    ),
    pool.query<{ tabela: string; tamanho: string; linhas: number }>(
      `select relname as tabela, pg_size_pretty(pg_total_relation_size(relid)) as tamanho, n_live_tup::int as linhas
         from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 8`,
    ),
    pool.query<{ extname: string; extversion: string }>("select extname, extversion from pg_extension order by extname"),
  ]));
  const i = info[0];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 rounded-lg border border-border bg-folha p-5 text-sm">
        <dt className="text-muted-foreground">PostgreSQL</dt>
        <dd>{i.versao}</dd>
        <dt className="text-muted-foreground">Tamanho do banco</dt>
        <dd>{i.tamanho}</dd>
        <dt className="text-muted-foreground">Conexões abertas</dt>
        <dd>{i.conexoes}</dd>
        <dt className="text-muted-foreground">Latência das consultas</dt>
        <dd>{latencia} ms</dd>
        <dt className="text-muted-foreground">Extensões</dt>
        <dd>{extensoes.map((e) => `${e.extname} ${e.extversion}`).join(", ")}</dd>
      </dl>
      <Tabela cabecalho={["Maiores tabelas", "Tamanho (com índices)", "Linhas (aprox.)"]}>
        {tabelas.map((t) => (
          <tr key={t.tabela}>
            <Celula className="font-mono text-xs">{t.tabela}</Celula>
            <Celula>{t.tamanho}</Celula>
            <Celula>{t.linhas.toLocaleString("pt-BR")}</Celula>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}

async function Ambiente() {
  await requirePapel("desenvolvedor");
  const espelho = espelhoExiste();
  const faltam = dadosFaltantes();
  return (
    <div className="space-y-4">
      <Tabela cabecalho={["Variável", "Para quê", "Situação"]}>
        {VARIAVEIS.map((v) => (
          <tr key={v.nome}>
            <Celula className="font-mono text-xs">{v.nome}</Celula>
            <Celula className="text-muted-foreground">{v.para}</Celula>
            <Celula>
              <SeloEstado estado={process.env[v.nome] ? "ok" : v.obrigatoria ? "erro" : "atencao"}>
                {process.env[v.nome] ? "Configurada" : v.obrigatoria ? "Ausente" : "Opcional, ausente"}
              </SeloEstado>
            </Celula>
          </tr>
        ))}
      </Tabela>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 rounded-lg border border-border bg-folha p-5 text-sm">
        <dt className="text-muted-foreground">Node.js</dt>
        <dd>{process.version}</dd>
        <dt className="text-muted-foreground">Modelo de IA</dt>
        <dd>{MODEL}, local (Ollama), contexto de {CONTEXTO_TOKENS.toLocaleString("pt-BR")} tokens</dd>
        <dt className="text-muted-foreground">Asaas</dt>
        <dd>{process.env.ASAAS_ENV === "producao" ? "Produção" : "Sandbox"}</dd>
        <dt className="text-muted-foreground">Espelho do acervo</dt>
        <dd>{espelho ? `${pastaDoEspelho()} (parser v${PARSER_VERSAO})` : "Não existe neste servidor"}</dd>
        <dt className="text-muted-foreground">Disco livre</dt>
        <dd>{gb(espacoLivre())}</dd>
        <dt className="text-muted-foreground">Dados da empresa</dt>
        <dd>
          {faltam.length ? (
            <SeloEstado estado="atencao">Preencher antes do lançamento: {faltam.join(", ")}</SeloEstado>
          ) : (
            <SeloEstado estado="ok">Completos</SeloEstado>
          )}
        </dd>
      </dl>
    </div>
  );
}

async function CaixaDeSaida() {
  await requirePapel("desenvolvedor");
  const emails = await db.select().from(emailsSaida).orderBy(desc(emailsSaida.createdAt)).limit(20);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Sem RESEND_API_KEY, os e-mails (confirmação de conta, redefinição de senha, LGPD) ficam aqui em vez de serem enviados. São
        apagados após 7 dias.
      </p>
      <Tabela cabecalho={["Quando", "Para", "Assunto", "Conteúdo"]} vazio={emails.length === 0}>
        {emails.map((e) => (
          <tr key={e.id}>
            <Celula className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Celula>
            <Celula>{e.para}</Celula>
            <Celula>{e.assunto}{e.erro ? <span className="block text-xs text-carimbo">{e.erro}</span> : null}</Celula>
            <Celula className="max-w-md text-xs break-all whitespace-pre-wrap text-muted-foreground">{e.texto || `(enviado via ${e.via})`}</Celula>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}

export default async function SistemaPage() {
  // Antes de qualquer saída: a página renderiza em paralelo com o layout (veja admin/layout.tsx).
  await requirePapel("desenvolvedor");
  return (
    <div className="space-y-10">
      <PageHeader
        title="Sistema"
        description="Saúde do banco, configuração do ambiente e manutenção. Visível apenas para quem desenvolve."
        actions={
          <>
            <ActionButton variant="outline" action={limparCacheDoAcervo}>
              Recalcular panorama do acervo
            </ActionButton>
            <ActionButton variant="outline" action={executarRetencao}>
              Aplicar política de retenção
            </ActionButton>
          </>
        }
      />
      <Section title="Banco de dados">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Banco />
        </Suspense>
      </Section>
      <Section title="Ambiente">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Ambiente />
        </Suspense>
      </Section>
      <Section title="Caixa de saída de e-mails">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CaixaDeSaida />
        </Suspense>
      </Section>
    </div>
  );
}
