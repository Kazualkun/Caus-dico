import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const ROTAS_PROTEGIDAS = ["/painel", "/assinatura", "/admin"];
const ROTAS_DE_ENTRADA = ["/entrar", "/cadastro"];
const COOKIES_DE_SESSAO = ["session_token", "session_data", "dont_remember"].flatMap((nome) => [
  `causidico.${nome}`,
  `__Secure-causidico.${nome}`,
]);

/**
 * Redirecionamento otimista: só confere se há cookie de sessão. A validação
 * da sessão, do papel e da assinatura acontece no servidor, perto dos dados.
 */
export function proxy(request: NextRequest) {
  const logado = Boolean(getSessionCookie(request, { cookiePrefix: "causidico" }));
  const { pathname, search, searchParams } = request.nextUrl;

  if (!logado && ROTAS_PROTEGIDAS.some((rota) => pathname.startsWith(rota))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // O servidor recusou o cookie (sessão expirada, encerrada ou conta bloqueada): apaga o
  // cookie. Com sessão válida, o login e o cadastro mostram a conta conectada (JaConectado).
  if (logado && ROTAS_DE_ENTRADA.includes(pathname) && searchParams.get("sessao") === "expirada") {
    const resposta = NextResponse.next();
    for (const nome of COOKIES_DE_SESSAO) {
      resposta.cookies.set(nome, "", { path: "/", maxAge: 0, secure: nome.startsWith("__Secure-") });
    }
    return resposta;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, a API de autenticação, webhooks e cron.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
