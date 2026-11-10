CREATE TABLE "contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"assunto" text NOT NULL,
	"mensagem" text NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"resposta" text,
	"respondida_em" timestamp with time zone,
	"respondida_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normas_revisoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"norma_id" bigint,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"dados" jsonb,
	"texto" text,
	"hash_texto" text,
	"fonte_oficial" text NOT NULL,
	"justificativa" text NOT NULL,
	"conferencia" jsonb,
	"anterior" jsonb,
	"autor_id" uuid,
	"autor_email" text NOT NULL,
	"revisor_id" uuid,
	"revisor_email" text,
	"revisada_em" timestamp with time zone,
	"parecer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"assinatura_id" uuid,
	"user_id" uuid,
	"status" text NOT NULL,
	"forma" text,
	"valor_cents" integer NOT NULL,
	"valor_liquido_cents" integer,
	"vencimento" date,
	"pago_em" timestamp with time zone,
	"estornado_em" timestamp with time zone,
	"fatura_url" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "curada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "hash_texto" text;--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "conferida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "conferencia" jsonb;--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "origem_sha" text;--> statement-breakpoint
ALTER TABLE "normas" ADD COLUMN "origem_mudou_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_respondida_por_users_id_fk" FOREIGN KEY ("respondida_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normas_revisoes" ADD CONSTRAINT "normas_revisoes_norma_id_normas_id_fk" FOREIGN KEY ("norma_id") REFERENCES "public"."normas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normas_revisoes" ADD CONSTRAINT "normas_revisoes_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normas_revisoes" ADD CONSTRAINT "normas_revisoes_revisor_id_users_id_fk" FOREIGN KEY ("revisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinatura_id_subscriptions_id_fk" FOREIGN KEY ("assinatura_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contatos_status_created_at_index" ON "contatos" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "normas_revisoes_status_created_at_index" ON "normas_revisoes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "normas_revisoes_norma_id_created_at_index" ON "normas_revisoes" USING btree ("norma_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "normas_revisoes_pendente_unica" ON "normas_revisoes" USING btree ("norma_id") WHERE status = 'pendente' and norma_id is not null;--> statement-breakpoint
CREATE INDEX "pagamentos_pago_em_index" ON "pagamentos" USING btree ("pago_em");--> statement-breakpoint
CREATE INDEX "pagamentos_user_id_index" ON "pagamentos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pagamentos_status_index" ON "pagamentos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "normas_curadas_idx" ON "normas" USING btree ("id") WHERE curada;--> statement-breakpoint
CREATE INDEX "normas_conferidas_idx" ON "normas" USING btree ("conferida_em") WHERE conferida_em is not null;