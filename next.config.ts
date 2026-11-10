import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas. A CSP fica restrita a diretivas que
 * não exigem nonce: uma política de scripts com nonce tornaria todas as páginas dinâmicas.
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Atrás do Nginx (servidor próprio), a resposta sai em partes (streaming) em vez de esperar a página inteira.
  { key: "X-Accel-Buffering", value: "no" },
  // HSTS só em produção: em http://localhost o navegador ignoraria, mas não há por que enviar.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },
  partialPrefetching: true,
  // Bibliotecas de PDF/DOCX e o driver do PostgreSQL rodam fora do bundle do servidor.
  serverExternalPackages: ["@react-pdf/renderer", "unpdf", "mammoth", "pg"],
  experimental: {
    // Contratos em PDF/DOCX de até 20 MB (+ folga do multipart).
    serverActions: { bodySizeLimit: "21mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
