import { FileCheck2Icon, FingerprintIcon, LandmarkIcon, UsersRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * O que o Causídico garante sobre o texto da lei — e só o que dá para comprovar.
 * Cada frase corresponde a um mecanismo do sistema (src/lib/acervo/curadoria.ts):
 * fonte oficial por norma, conferência automática, aprovação por um segundo
 * revisor, impressão digital verificada na rotina diária e prevalência do
 * Diário Oficial (o texto compilado tem caráter informativo).
 */
export const GARANTIAS = [
  {
    icone: LandmarkIcon,
    titulo: "Fonte oficial em cada norma",
    texto: "Toda norma traz o link da publicação oficial, a data da última atualização e se o texto já foi conferido com a fonte.",
  },
  {
    icone: FileCheck2Icon,
    titulo: "Conferência artigo por artigo",
    texto: "Inclusões e correções são comparadas automaticamente com a fonte oficial, artigo por artigo, ignorando o texto revogado.",
  },
  {
    icone: UsersRoundIcon,
    titulo: "Dupla revisão",
    texto: "Nenhuma alteração da equipe é publicada sem a aprovação de um segundo revisor, e cada versão fica no histórico.",
  },
  {
    icone: FingerprintIcon,
    titulo: "Integridade verificada todo dia",
    texto: "O texto conferido recebe uma impressão digital (SHA-256), checada diariamente: mudança fora desse processo é detectada.",
  },
] as const;

export const RESSALVA_DOU =
  "O texto do acervo tem caráter informativo e não substitui a publicação oficial: em caso de divergência, vale o Diário Oficial.";

const numero = new Intl.NumberFormat("pt-BR");

/** Quadro do compromisso com o texto da lei (acervo e pesquisa). */
export function CompromissoAcervo({
  conferidas,
  total,
  className,
}: {
  conferidas?: number;
  total?: number;
  className?: string;
}) {
  return (
    <section aria-labelledby="titulo-compromisso" className={cn("space-y-4 rounded-lg border border-border bg-folha p-5", className)}>
      <div className="space-y-1">
        <h2 id="titulo-compromisso" className="text-base font-semibold">
          Nosso compromisso com o texto da lei
        </h2>
        {conferidas !== undefined && total !== undefined && (
          <p className="text-sm text-muted-foreground">
            {numero.format(conferidas)} de {numero.format(total)} normas já conferidas individualmente com a fonte oficial. As demais vêm
            compiladas das fontes oficiais e mostram o link para conferência.
          </p>
        )}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GARANTIAS.map((g) => (
          <li key={g.titulo} className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <g.icone className="size-4 shrink-0 text-tinta" aria-hidden />
              {g.titulo}
            </p>
            <p className="text-sm text-muted-foreground">{g.texto}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{RESSALVA_DOU}</p>
    </section>
  );
}
