CREATE TYPE "public"."billing_cycle" AS ENUM('mensal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('processando', 'concluido', 'erro');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('basico', 'profissional', 'escritorio');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pendente', 'ativa', 'inadimplente', 'cancelada');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'usuario',
	"oab_number" text,
	"oab_uf" text,
	"office_name" text,
	"cpf_cnpj" text,
	"phone" text,
	"blocked_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aceites_termos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"documento" text NOT NULL,
	"versao" text NOT NULL,
	"ip" text,
	"aceito_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acervo_estado" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acervo_publicacoes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fonte" text NOT NULL,
	"urn" text NOT NULL,
	"tipo" text NOT NULL,
	"numero" text,
	"ano" smallint,
	"data" date,
	"titulo" text NOT NULL,
	"ementa" text,
	"link" text,
	"norma_id" bigint,
	"detectada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"incorporada_em" timestamp with time zone,
	CONSTRAINT "acervo_publicacoes_urn_unique" UNIQUE("urn")
);
--> statement-breakpoint
CREATE TABLE "acervo_sincronizacoes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"estrategia" text NOT NULL,
	"status" text DEFAULT 'executando' NOT NULL,
	"commit_de" text,
	"commit_ate" text,
	"processadas" integer DEFAULT 0 NOT NULL,
	"inseridas" integer DEFAULT 0 NOT NULL,
	"atualizadas" integer DEFAULT 0 NOT NULL,
	"removidas" integer DEFAULT 0 NOT NULL,
	"inalteradas" integer DEFAULT 0 NOT NULL,
	"erros" integer DEFAULT 0 NOT NULL,
	"mensagem" text,
	"amostra_erros" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disparada_por" text,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"recurso" text NOT NULL,
	"referencia_id" text,
	"modelo" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"duracao_ms" integer NOT NULL,
	"sucesso" boolean NOT NULL,
	"erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ator_id" uuid,
	"ator_email" text,
	"acao" text NOT NULL,
	"alvo_tipo" text,
	"alvo_id" text,
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"template_id" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analysis" jsonb,
	"risk_score" smallint,
	"status" "job_status" DEFAULT 'processando' NOT NULL,
	"progress" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositivos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"norma_id" bigint NOT NULL,
	"ordem" integer NOT NULL,
	"referencia" text NOT NULL,
	"contexto" text,
	"ancora" text NOT NULL,
	"inicio" integer NOT NULL,
	"fim" integer NOT NULL,
	"tsv" "tsvector" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails_saida" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"para" text NOT NULL,
	"assunto" text NOT NULL,
	"texto" text NOT NULL,
	"via" text NOT NULL,
	"erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lgpd_solicitacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text,
	"status" text DEFAULT 'aberta' NOT NULL,
	"resposta" text,
	"prazo_em" timestamp with time zone NOT NULL,
	"respondida_em" timestamp with time zone,
	"respondida_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"caminho" text NOT NULL,
	"fonte" text DEFAULT 'ctresb/leis' NOT NULL,
	"esfera" text NOT NULL,
	"uf" text,
	"municipio" text,
	"orgao" text,
	"tipo" text NOT NULL,
	"tipo_slug" text NOT NULL,
	"numero" text,
	"ano" smallint,
	"data" date,
	"titulo" text NOT NULL,
	"apelido" text,
	"ementa" text,
	"situacao" text,
	"revogada" boolean DEFAULT false NOT NULL,
	"versao_texto" text,
	"urn" text,
	"fonte_url" text,
	"repo_url" text NOT NULL,
	"areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"nomes_populares" text[] DEFAULT '{}'::text[] NOT NULL,
	"indexacao" text,
	"enriquecida_em" timestamp with time zone,
	"texto" text NOT NULL,
	"tamanho" integer NOT NULL,
	"sumario" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explicacao" text,
	"explicacao_em" timestamp with time zone,
	"git_sha" text NOT NULL,
	"removida_em" timestamp with time zone,
	"ingerida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('public.pt_unaccent', coalesce(apelido, '') || ' ' || titulo), 'A') || setweight(to_tsvector('public.pt_unaccent', coalesce(ementa, '')), 'B') || setweight(to_tsvector('public.pt_unaccent', coalesce(indexacao, '')), 'C')) STORED NOT NULL,
	CONSTRAINT "normas_caminho_unique" UNIQUE("caminho")
);
--> statement-breakpoint
CREATE TABLE "oab_fee_references" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uf" text NOT NULL,
	"area" text NOT NULL,
	"servico" text NOT NULL,
	"valor_minimo_cents" bigint,
	"percentual_minimo" numeric(5, 2),
	"observacao" text,
	"fonte_url" text,
	"vigencia" text,
	"ilustrativo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "oab_fee_references_uf_area_servico_unique" UNIQUE("uf","area","servico")
);
--> statement-breakpoint
CREATE TABLE "pricing_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"case_title" text NOT NULL,
	"area" text NOT NULL,
	"uf" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"billing_format" text NOT NULL,
	"proposed_value_cents" bigint,
	"proposal_letter" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registros_acesso" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ip" text,
	"user_agent" text,
	"evento" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"area" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"status" "job_status" DEFAULT 'processando' NOT NULL,
	"progress" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"plan" "plan_tier" NOT NULL,
	"cycle" "billing_cycle" NOT NULL,
	"status" "subscription_status" DEFAULT 'pendente' NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"billing_type" text,
	"value_cents" integer NOT NULL,
	"current_period_end" timestamp with time zone,
	"first_payment_at" timestamp with time zone,
	"last_payment_at" timestamp with time zone,
	"last_payment_id" text,
	"last_invoice_url" text,
	"canceled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_providerSubscriptionId_unique" UNIQUE("provider_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aceites_termos" ADD CONSTRAINT "aceites_termos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acervo_publicacoes" ADD CONSTRAINT "acervo_publicacoes_norma_id_normas_id_fk" FOREIGN KEY ("norma_id") REFERENCES "public"."normas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_ator_id_users_id_fk" FOREIGN KEY ("ator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_norma_id_normas_id_fk" FOREIGN KEY ("norma_id") REFERENCES "public"."normas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lgpd_solicitacoes" ADD CONSTRAINT "lgpd_solicitacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lgpd_solicitacoes" ADD CONSTRAINT "lgpd_solicitacoes_respondida_por_users_id_fk" FOREIGN KEY ("respondida_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_proposals" ADD CONSTRAINT "pricing_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "acervo_publicacoes_tipo_numero_ano_index" ON "acervo_publicacoes" USING btree ("tipo","numero","ano");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_index" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_recurso_created_at_index" ON "ai_usage" USING btree ("recurso","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_acao_index" ON "audit_log" USING btree ("acao");--> statement-breakpoint
CREATE INDEX "contracts_user_id_created_at_index" ON "contracts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "dispositivos_tsv_idx" ON "dispositivos" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "dispositivos_norma_id_ordem_index" ON "dispositivos" USING btree ("norma_id","ordem");--> statement-breakpoint
CREATE INDEX "lgpd_solicitacoes_status_prazo_em_index" ON "lgpd_solicitacoes" USING btree ("status","prazo_em");--> statement-breakpoint
CREATE INDEX "normas_tsv_idx" ON "normas" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "normas_areas_idx" ON "normas" USING gin ("areas");--> statement-breakpoint
CREATE INDEX "normas_filtro_idx" ON "normas" USING btree ("esfera","uf","tipo_slug","ano");--> statement-breakpoint
CREATE INDEX "normas_numero_idx" ON "normas" USING btree ("numero","ano");--> statement-breakpoint
CREATE INDEX "pricing_proposals_user_id_created_at_index" ON "pricing_proposals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "registros_acesso_created_at_index" ON "registros_acesso" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "registros_acesso_user_id_index" ON "registros_acesso" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_history_user_id_created_at_index" ON "search_history" USING btree ("user_id","created_at");