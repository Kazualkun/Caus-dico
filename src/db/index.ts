import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/*
 * Conexão única com o PostgreSQL: local (npm run db:iniciar) ou Neon — basta
 * trocar DATABASE_URL. No Neon, use a URL com pooling (host "-pooler").
 * Em desenvolvimento o pool fica em globalThis para sobreviver ao HMR.
 */
const global = globalThis as unknown as { causidicoPool?: Pool };

export const pool =
  global.causidicoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") global.causidicoPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type Db = typeof db;
