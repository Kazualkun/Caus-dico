CREATE TYPE "public"."cliente_status" AS ENUM('lead', 'negociacao', 'cliente', 'encerrado', 'perdido');--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"documento" text,
	"cidade" text,
	"uf" text,
	"origem" text DEFAULT 'outro' NOT NULL,
	"indicado_por" text,
	"status" "cliente_status" DEFAULT 'lead' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dias_sem_expediente" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"descricao" text NOT NULL,
	"tipo" text DEFAULT 'sem_expediente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dias_sem_expediente_userId_data_unique" UNIQUE("user_id","data")
);
--> statement-breakpoint
CREATE TABLE "prazos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"processo_id" uuid,
	"descricao" text NOT NULL,
	"vencimento" date NOT NULL,
	"parametros" jsonb NOT NULL,
	"cumprido_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cliente_id" uuid,
	"titulo" text NOT NULL,
	"numero" text,
	"ramo" text NOT NULL,
	"orgao" text,
	"situacao" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recomendacoes_peca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cliente_id" uuid,
	"titulo" text NOT NULL,
	"params" jsonb NOT NULL,
	"result" jsonb,
	"status" "job_status" DEFAULT 'processando' NOT NULL,
	"progress" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triagem_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "triagem_links_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "triagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cliente_id" uuid,
	"respostas" jsonb NOT NULL,
	"analise" jsonb,
	"status" "job_status" DEFAULT 'processando' NOT NULL,
	"error" text,
	"vista_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "pricing_proposals" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "pricing_proposals" ADD COLUMN "situacao" text DEFAULT 'rascunho' NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_proposals" ADD COLUMN "situacao_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dias_sem_expediente" ADD CONSTRAINT "dias_sem_expediente_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos" ADD CONSTRAINT "processos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos" ADD CONSTRAINT "processos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recomendacoes_peca" ADD CONSTRAINT "recomendacoes_peca_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recomendacoes_peca" ADD CONSTRAINT "recomendacoes_peca_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triagem_links" ADD CONSTRAINT "triagem_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triagens" ADD CONSTRAINT "triagens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triagens" ADD CONSTRAINT "triagens_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_user_id_status_updated_at_index" ON "clientes" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "prazos_user_id_vencimento_index" ON "prazos" USING btree ("user_id","vencimento");--> statement-breakpoint
CREATE INDEX "processos_user_id_situacao_index" ON "processos" USING btree ("user_id","situacao");--> statement-breakpoint
CREATE INDEX "recomendacoes_peca_user_id_created_at_index" ON "recomendacoes_peca" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "triagens_user_id_created_at_index" ON "triagens" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_proposals" ADD CONSTRAINT "pricing_proposals_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;