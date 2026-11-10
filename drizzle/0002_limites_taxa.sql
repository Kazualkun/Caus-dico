CREATE TABLE "limites_taxa" (
	"chave" text PRIMARY KEY NOT NULL,
	"contagem" integer DEFAULT 0 NOT NULL,
	"inicio_janela" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "limites_taxa_inicio_janela_index" ON "limites_taxa" USING btree ("inicio_janela");