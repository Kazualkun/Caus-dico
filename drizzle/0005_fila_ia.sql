CREATE TABLE "tarefas_ia" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"tipo" text NOT NULL,
	"referencia_id" uuid NOT NULL,
	"status" text DEFAULT 'na_fila' NOT NULL,
	"prioridade" smallint DEFAULT 0 NOT NULL,
	"tentativas" smallint DEFAULT 0 NOT NULL,
	"erro" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_em" timestamp with time zone,
	"concluida_em" timestamp with time zone,
	"batimento_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tarefas_ia" ADD CONSTRAINT "tarefas_ia_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefas_ia_status_prioridade_criada_em_index" ON "tarefas_ia" USING btree ("status","prioridade","criada_em");--> statement-breakpoint
CREATE INDEX "tarefas_ia_user_id_tipo_criada_em_index" ON "tarefas_ia" USING btree ("user_id","tipo","criada_em");--> statement-breakpoint
CREATE INDEX "tarefas_ia_tipo_referencia_id_index" ON "tarefas_ia" USING btree ("tipo","referencia_id");--> statement-breakpoint
-- Histórico: o consumo do mês passa a ser contado aqui. Tarefas que estavam em
-- andamento (a fila antiga ficava na memória do processo) voltam para a fila.
INSERT INTO "tarefas_ia" ("user_id", "tipo", "referencia_id", "status", "criada_em", "concluida_em")
SELECT "user_id", 'auditoria', "id",
       CASE "status" WHEN 'concluido' THEN 'concluida' WHEN 'erro' THEN 'erro' ELSE 'na_fila' END,
       "created_at", CASE WHEN "status" = 'processando' THEN NULL ELSE "updated_at" END
  FROM "contracts" WHERE "kind" = 'analise';--> statement-breakpoint
INSERT INTO "tarefas_ia" ("user_id", "tipo", "referencia_id", "status", "criada_em", "concluida_em")
SELECT "user_id", 'pesquisa', "id",
       CASE "status" WHEN 'concluido' THEN 'concluida' WHEN 'erro' THEN 'erro' ELSE 'na_fila' END,
       "created_at", CASE WHEN "status" = 'processando' THEN NULL ELSE "updated_at" END
  FROM "search_history";--> statement-breakpoint
INSERT INTO "tarefas_ia" ("user_id", "tipo", "referencia_id", "status", "criada_em", "concluida_em")
SELECT "user_id", 'peca', "id",
       CASE "status" WHEN 'concluido' THEN 'concluida' WHEN 'erro' THEN 'erro' ELSE 'na_fila' END,
       "created_at", CASE WHEN "status" = 'processando' THEN NULL ELSE "updated_at" END
  FROM "recomendacoes_peca";--> statement-breakpoint
INSERT INTO "tarefas_ia" ("user_id", "tipo", "referencia_id", "status", "prioridade", "criada_em", "concluida_em")
SELECT "user_id", 'triagem', "id",
       CASE "status" WHEN 'concluido' THEN 'concluida' WHEN 'erro' THEN 'erro' ELSE 'na_fila' END, 1,
       "created_at", CASE WHEN "status" = 'processando' THEN NULL ELSE "updated_at" END
  FROM "triagens";
