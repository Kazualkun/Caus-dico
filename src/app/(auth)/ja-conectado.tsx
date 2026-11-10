import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { caminhoSeguro } from "@/lib/navigation";
import { sair } from "./actions";

/**
 * Quem já está conectado e abre o login ou o cadastro vê com qual conta está e
 * escolhe entre continuar ou sair para usar outra. Antes o proxy mandava essa
 * pessoa ao painel, e uma conta sem assinatura ficava presa entre /entrar e /planos.
 */
export async function JaConectado({
  searchParams,
  voltarPara,
  rotuloSair,
  children,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  voltarPara: "/entrar" | "/cadastro";
  rotuloSair: string;
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) return children;

  const { next } = await searchParams;
  const continuar = caminhoSeguro(next) ?? "/painel";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Você já está conectado como <strong className="text-grafite">{viewer.email}</strong>.
      </p>
      <Button asChild className="h-10 w-full">
        <Link href={continuar}>Continuar com esta conta</Link>
      </Button>
      <form action={sair}>
        <input type="hidden" name="destino" value={next ? `${voltarPara}?next=${encodeURIComponent(continuar)}` : voltarPara} />
        <Button type="submit" variant="outline" className="h-10 w-full">
          {rotuloSair}
        </Button>
      </form>
    </div>
  );
}
