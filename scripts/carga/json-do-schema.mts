/** JSON válido para um JSON Schema (o mesmo que o Causídico manda no campo `format`). Usado pelo emulador de GPU. */


export type Schema = Record<string, unknown>;
export const TEXTO = "Conteúdo gerado pelo emulador de carga, sem valor jurídico.";

export function gerar(s: Schema, raiz: Schema = s): unknown {
  if (typeof s.$ref === "string") return gerar(resolver(s.$ref, raiz), raiz);
  if ("const" in s) return s.const;
  if (Array.isArray(s.enum)) return s.enum[0];
  for (const chave of ["anyOf", "oneOf"] as const) {
    const opcoes = s[chave] as Schema[] | undefined;
    if (opcoes?.length) return gerar(opcoes.find((o) => o.type !== "null") ?? opcoes[0], raiz);
  }
  if (Array.isArray(s.allOf)) return Object.assign({}, ...(s.allOf as Schema[]).map((x) => gerar(x, raiz)));
  const tipo = Array.isArray(s.type) ? (s.type as string[]).find((t) => t !== "null") : (s.type as string | undefined);
  switch (tipo) {
    case "object": {
      const props = (s.properties ?? {}) as Record<string, Schema>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, gerar(v, raiz)]));
    }
    case "array": {
      const min = Number(s.minItems ?? 1);
      const max = Number(s.maxItems ?? Math.max(min, 2));
      const n = Math.max(min, Math.min(max, 2));
      return Array.from({ length: n }, () => gerar((s.items ?? {}) as Schema, raiz));
    }
    case "string": {
      const min = Number(s.minLength ?? 0);
      const max = Number(s.maxLength ?? 400);
      let t = TEXTO;
      while (t.length < min) t += ` ${TEXTO}`;
      return t.slice(0, max);
    }
    case "integer":
    case "number": {
      const min = typeof s.minimum === "number" ? s.minimum : typeof s.exclusiveMinimum === "number" ? s.exclusiveMinimum + 1 : 0;
      const max = typeof s.maximum === "number" ? s.maximum : typeof s.exclusiveMaximum === "number" ? s.exclusiveMaximum - 1 : min + 100;
      const v = (min + max) / 2;
      return tipo === "integer" ? Math.round(v) : v;
    }
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return TEXTO;
  }
}

function resolver(ref: string, raiz: Schema): Schema {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], raiz) as Schema;
}

