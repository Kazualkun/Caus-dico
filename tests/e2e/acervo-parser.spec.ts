import { expect, test } from "@playwright/test";
import { analisarEstrutura } from "../../src/lib/acervo/parser";

/*
 * Rótulo e âncora de cada artigo. A âncora é o endereço do link direto para o
 * artigo e é o que a conferência de citações procura no acervo.
 */
test.describe("rótulos de artigo no acervo", () => {
  const casos: [string, string, string][] = [
    ["Art. 11. O Prêmio será conferido.", "Art. 11", "art-11"],
    ["Art. 1.636. O pai ou a mãe que contrai novas núpcias", "Art. 1.636", "art-1-636"],
    ["Artigo 11 - O Plano Estadual de Recursos Hídricos", "Art. 11", "art-11"],
    ["Art. 12 - A empresa deverá", "Art. 12", "art-12"],
    ["Art. 30. A Coordenadoria", "Art. 30", "art-30"],
    ["Art. 1o Esta lei entra em vigor.", "Art. 1º", "art-1"],
    ["ART. 1O Esta lei entra em vigor.", "Art. 1º", "art-1"],
    ["Artigo 1.° Fica criado", "Art. 1º", "art-1"],
    ["Art. 1 º Fica", "Art. 1º", "art-1"],
    ["Art. 9º O prazo é de dez dias.", "Art. 9º", "art-9"],
    ["Art. 5º-A O disposto", "Art. 5º-A", "art-5-a"],
    ["Art. 2o-A Ordinal com letra", "Art. 2º-A", "art-2-a"],
    ["Art. 7º-B. Acrescido", "Art. 7º-B", "art-7-b"],
    ["**Art. 11.** O Prêmio", "Art. 11", "art-11"],
  ];
  for (const [texto, referencia, ancora] of casos) {
    test(texto, () => {
      const [d] = analisarEstrutura(texto).dispositivos;
      expect({ referencia: d.referencia, ancora: d.ancora }).toEqual({ referencia, ancora });
    });
  }
});
