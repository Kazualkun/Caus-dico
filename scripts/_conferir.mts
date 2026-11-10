process.loadEnvFile(".env.local");
const { compararComFonte, htmlParaTexto, conferirComFonte } = await import("@/lib/acervo/conferencia");
const { pool } = await import("@/db");
const html = `<html><head><meta charset="windows-1252"><style>p{}</style></head><body>
<p><b>Art. 1<sup>o</sup></b> Esta Lei estabelece normas de prote&ccedil;&atilde;o.</p>
<p><strike>Art. 2&ordm; Texto antigo revogado.</strike></p>
<p>Art. 2&ordm; Consumidor &eacute; toda pessoa f&iacute;sica. <a href="x">(Reda&ccedil;&atilde;o dada pela Lei n&ordm; 9.999, de 2020)</a></p>
<p>Par&aacute;grafo &uacute;nico. Equipara-se a consumidor a coletividade.</p>
<p>Art. 3&ordm;-A Artigo novo que falta no texto.</p>
<p>${"Lorem ipsum dolor sit amet. ".repeat(10)}</p></body></html>`;
const fonte = htmlParaTexto(html);
console.log(fonte);
const nosso = "# Lei X\n\n**Art. 1º** Esta Lei estabelece normas de proteção.\n\n**Art. 2º** Consumidor é toda pessoa física.\n\nParágrafo único. Equipara-se a consumidor a coletividade.\n";
console.log(compararComFonte(nosso, fonte, "https://exemplo.gov.br"));
const errado = nosso.replace("pessoa física", "pessoa jurídica");
console.log(compararComFonte(errado, fonte, "https://exemplo.gov.br").divergentes);
const antigo = "**Art. 1º** Esta Lei estabelece normas de proteção.\n\n**Art. 2º** Texto antigo revogado.\n";
console.log("antigo:", compararComFonte(antigo, fonte, "x").divergentes);

const { rows } = await pool.query(`select id, titulo, fonte_url, texto from normas where fonte_url like 'https://www2.camara.leg.br/%' and removida_em is null and tamanho between 3000 and 20000 order by ano desc nulls last limit 3`);
for (const n of rows) {
  const t0 = Date.now();
  const c = await conferirComFonte(n.texto, n.fonte_url);
  console.log(n.id, n.titulo, n.fonte_url, `${Date.now() - t0}ms`, c.status, `${c.conferidos}/${c.artigos}`, "div:", c.divergentes.slice(0, 5), "falt:", c.faltando.slice(0, 5), c.detalhe);
}
await pool.end();
