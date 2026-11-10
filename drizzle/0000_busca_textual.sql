-- Busca textual em português que ignora acentos ("clausula" encontra "cláusula").
-- Precisa existir antes das tabelas que usam a configuração em colunas geradas.
-- unaccent e pg_trgm estão disponíveis no PostgreSQL local e no Neon.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (COPY = pg_catalog.portuguese);
    ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
  END IF;
END
$$;
