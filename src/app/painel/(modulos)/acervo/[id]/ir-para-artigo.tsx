"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Salta para um artigo pelo número ("5", "1.037", "4-A"). */
export function IrParaArtigo({ artigos }: { artigos: { referencia: string; ancora: string }[] }) {
  const [erro, setErro] = useState<string | null>(null);

  function ir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const valor = String(new FormData(e.currentTarget).get("artigo") ?? "").replace(/[^\dA-Za-z]/g, "").toUpperCase();
    const alvo = artigos.find((a) => a.referencia.replace(/^ADCT, /, "").replace(/[^\dA-Za-z]/g, "").toUpperCase().replace(/^ART/, "") === valor);
    if (!alvo) return setErro("Artigo não encontrado nesta norma.");
    setErro(null);
    window.location.hash = alvo.ancora;
  }

  return (
    <form onSubmit={ir} className="space-y-1">
      <label htmlFor="artigo" className="text-xs text-muted-foreground">
        Ir para o artigo
      </label>
      <div className="flex gap-1.5">
        <Input id="artigo" name="artigo" inputMode="text" placeholder="Ex.: 51" className="h-8" aria-describedby={erro ? "artigo-erro" : undefined} />
        <Button type="submit" size="sm" variant="outline" className="h-8">
          Ir
        </Button>
      </div>
      {erro && (
        <p id="artigo-erro" className="text-xs text-carimbo" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
