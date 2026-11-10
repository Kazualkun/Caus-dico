import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";

export type Papel = "dev" | "admin" | "suporte" | "assinante" | "novo";
export const PAPEIS: Papel[] = ["dev", "admin", "suporte", "assinante", "novo"];

const ARQUIVO_CONTAS = "tests/.auth/contas.json";

/** Credenciais gravadas por `npm run usuario:teste`. */
export function contas(): Record<Papel, { email: string; senha: string }> {
  if (!existsSync(ARQUIVO_CONTAS)) throw new Error("Rode `npm run usuario:teste` antes dos testes para criar as contas.");
  return JSON.parse(readFileSync(ARQUIVO_CONTAS, "utf8"));
}

export const sessao = (papel: Papel) => `tests/.auth/sessoes/${papel}.json`;

/**
 * A IA local (Ollama) está no ar com o modelo configurado? Sem ela, os testes de
 * IA verificam que a falha chega ao usuário como mensagem clara.
 */
export async function iaNoAr() {
  try {
    const r = await fetch(`${process.env.OLLAMA_URL ?? "http://127.0.0.1:11434"}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const { models } = (await r.json()) as { models: { name: string }[] };
    return models.some((m) => m.name === (process.env.OLLAMA_MODEL ?? "qwen3.5:9b"));
  } catch {
    return false;
  }
}

/** Tempo máximo de uma tarefa de IA nos testes: a IA local atende uma por vez. */
export const TEMPO_IA = 15 * 60 * 1000;

let pool: Pool | null = null;
/** Acesso direto ao banco local, só para preparar e limpar cenários. */
export function banco() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}
