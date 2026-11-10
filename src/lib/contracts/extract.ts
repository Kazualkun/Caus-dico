import "server-only";
import { inflateRawSync } from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export type FormatoArquivo = "pdf" | "docx";

/** Um .docx comum descompacta em poucos MB; acima disto, é arquivo malformado ou feito para travar o servidor. */
const LIMITE_DOCX_DESCOMPACTADO = 80 * 1024 * 1024;
const LIMITE_ENTRADAS_DOCX = 5_000;
const LIMITE_PAGINAS_PDF = 300;

export function formatoDoArquivo(nome: string): FormatoArquivo | null {
  const extensao = nome.split(".").pop()?.toLowerCase();
  return extensao === "pdf" || extensao === "docx" ? extensao : null;
}

/** Problema no arquivo enviado, com mensagem já escrita para o usuário. */
export class ArquivoIlegivelError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ArquivoIlegivelError";
  }
}

const docxInvalido = () => new ArquivoIlegivelError("Este arquivo .docx está corrompido ou não é um documento do Word. Exporte de novo pelo editor ou cole o texto.");

/**
 * Confere o .docx (um ZIP) antes de entregá-lo ao leitor: descompacta cada parte
 * com teto de tamanho, o que barra a "bomba de ZIP" (poucos MB que viram GB).
 */
function conferirDocx(zip: Buffer) {
  let fimDoDiretorio = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      fimDoDiretorio = i;
      break;
    }
  }
  if (fimDoDiretorio < 0) throw docxInvalido();
  const entradas = zip.readUInt16LE(fimDoDiretorio + 10);
  if (entradas > LIMITE_ENTRADAS_DOCX) throw docxInvalido();

  let p = zip.readUInt32LE(fimDoDiretorio + 16);
  let total = 0;
  for (let n = 0; n < entradas; n++) {
    if (p + 46 > zip.length || zip.readUInt32LE(p) !== 0x02014b50) throw docxInvalido();
    const metodo = zip.readUInt16LE(p + 10);
    const compactado = zip.readUInt32LE(p + 20);
    const local = zip.readUInt32LE(p + 42);
    if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw docxInvalido();
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const dados = zip.subarray(inicio, inicio + compactado);

    if (metodo === 0) total += dados.length;
    else if (metodo === 8) {
      try {
        total += inflateRawSync(dados, { maxOutputLength: LIMITE_DOCX_DESCOMPACTADO - total + 1 }).length;
      } catch (e) {
        if (e instanceof RangeError) total = Infinity;
        else throw docxInvalido();
      }
    } else throw docxInvalido();
    if (total > LIMITE_DOCX_DESCOMPACTADO) {
      throw new ArquivoIlegivelError("O conteúdo deste .docx é grande demais para ser lido. Divida o documento ou cole o texto.");
    }
    p += 46 + zip.readUInt16LE(p + 28) + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
  }
}

/** Extrai o texto de um PDF pesquisável ou de um .docx. */
export async function extrairTexto(conteudo: ArrayBuffer, formato: FormatoArquivo) {
  let texto: string;
  if (formato === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(conteudo));
    if (pdf.numPages > LIMITE_PAGINAS_PDF) {
      throw new ArquivoIlegivelError(`Este PDF tem ${pdf.numPages} páginas, acima do limite de ${LIMITE_PAGINAS_PDF}. Envie só a parte que interessa.`);
    }
    const { text } = await extractText(pdf, { mergePages: true });
    texto = text;
  } else {
    const zip = Buffer.from(conteudo);
    conferirDocx(zip);
    const { value } = await mammoth.extractRawText({ buffer: zip });
    texto = value;
  }

  texto = texto.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (formato === "pdf" && texto.length < 200) {
    throw new ArquivoIlegivelError(
      "Este PDF parece ser uma imagem digitalizada, sem texto pesquisável. Envie uma versão com texto (exportada do editor) ou cole o conteúdo.",
    );
  }
  return texto;
}
