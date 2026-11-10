/**
 * Curadoria do acervo: inclusão de normas, correção de texto ou dados e
 * conferência com a fonte oficial.
 *
 * Regras que garantem o que é publicado:
 * 1. Toda alteração indica a fonte oficial (gov.br, leg.br, jus.br, mp.br, def.br)
 *    e é conferida automaticamente com ela, artigo por artigo.
 * 2. Inclusões e edições só entram no acervo com a aprovação de um revisor
 *    diferente do autor; com divergência na conferência, o revisor precisa
 *    justificar por escrito.
 * 3. A conferência de uma norma sem mudança de texto é registrada na hora quando
 *    todos os artigos batem com a fonte; se não baterem, também vai para revisão.
 * 4. O texto aprovado ganha uma impressão digital (SHA-256); a verificação de
 *    integridade acusa qualquer mudança feita fora deste fluxo.
 * 5. Cada revisão aprovada guarda a versão anterior: é o histórico da norma.
 */
import "server-only";
import { eq } from "drizzle-orm";
import type { PoolClient } from "pg";
import { db, pool } from "@/db";
import { normasRevisoes } from "@/db/schema";
import { classificarAreas } from "./areas";
import { conferirComFonte, fonteOficialValida, hashDoTexto } from "./conferencia";
import { gravarLote } from "./gravacao";
import { analisarEstrutura, ESFERAS, slug, type Esfera, type NormaPreparada } from "./parser";
import type { Conferencia, DadosNorma } from "./tipos-curadoria";
import { UFS } from "@/lib/format";

export type Ator = { id: string; email: string };
export type Revisao = typeof normasRevisoes.$inferSelect;
type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const TEXTO_MAXIMO = 5_000_000;
const campo = (f: FormData, nome: string, max = 500) => String(f.get(nome) ?? "").trim().slice(0, max);
const opcional = (v: string) => v || null;

/** Lê e valida o formulário de inclusão ou edição. */
export function lerFormularioNorma(f: FormData): Resultado<{ dados: DadosNorma; texto: string; fonte: string; justificativa: string }> {
  const esfera = campo(f, "esfera") as Esfera;
  const uf = campo(f, "uf").toUpperCase();
  const dataTexto = campo(f, "data");
  const anoTexto = campo(f, "ano");
  const texto = String(f.get("texto") ?? "").replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  const fonte = campo(f, "fonte", 2000);
  const justificativa = campo(f, "justificativa", 4000);

  if (!ESFERAS.includes(esfera)) return { ok: false, erro: "Escolha a esfera." };
  if ((esfera === "estadual" || esfera === "municipal") && !UFS.includes(uf as (typeof UFS)[number])) {
    return { ok: false, erro: "Escolha a UF." };
  }
  const municipio = campo(f, "municipio", 120);
  if (esfera === "municipal" && municipio.length < 2) return { ok: false, erro: "Informe o município." };
  const orgao = campo(f, "orgao", 80).toUpperCase();
  if ((esfera === "jurisprudencia" || esfera === "regulador") && orgao.length < 2) {
    return { ok: false, erro: "Informe o tribunal ou órgão." };
  }
  const tipo = campo(f, "tipo", 80);
  if (tipo.length < 3) return { ok: false, erro: "Informe o tipo da norma (ex.: Lei Ordinária)." };
  const tipoSlug = slug(campo(f, "tipoSlug", 80) || tipo);
  const titulo = campo(f, "titulo", 300);
  if (titulo.length < 5) return { ok: false, erro: "Informe o título (ex.: Lei nº 8.078, de 11 de setembro de 1990)." };
  if (dataTexto && !/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) return { ok: false, erro: "Data inválida." };
  const ano = dataTexto ? Number(dataTexto.slice(0, 4)) : anoTexto ? Number(anoTexto) : null;
  if (ano !== null && (!Number.isInteger(ano) || ano < 1500 || ano > 2200)) return { ok: false, erro: "Ano inválido." };
  if (texto.length < 30) return { ok: false, erro: "Cole o texto integral da norma." };
  if (texto.length > TEXTO_MAXIMO) return { ok: false, erro: "O texto passa de 5 milhões de caracteres." };
  if (!fonteOficialValida(fonte)) {
    return { ok: false, erro: "Informe o link da fonte oficial (endereço gov.br, leg.br, jus.br, mp.br ou def.br)." };
  }
  if (justificativa.length < 15) return { ok: false, erro: "Explique em uma frase o que está sendo incluído ou corrigido e por quê." };

  return {
    ok: true,
    dados: {
      esfera,
      uf: esfera === "estadual" || esfera === "municipal" ? uf : null,
      municipio: esfera === "municipal" ? municipio : null,
      orgao: esfera === "jurisprudencia" || esfera === "regulador" ? orgao : null,
      tipo,
      tipoSlug,
      numero: opcional(campo(f, "numero", 40).replace(/\.(?=\d{3}\b)/g, "")),
      ano,
      data: dataTexto || null,
      titulo,
      apelido: opcional(campo(f, "apelido", 200)),
      ementa: opcional(campo(f, "ementa", 2000)),
      situacao: opcional(campo(f, "situacao", 200)),
      revogada: f.get("revogada") === "on",
    },
    texto,
    fonte,
    justificativa,
  };
}

type NormaAtual = DadosNorma & {
  id: number; caminho: string; texto: string; hashTexto: string | null; urn: string | null; repoUrl: string;
  gitSha: string; versaoTexto: string | null; indexacao: string | null; fonteUrl: string | null;
};

export async function normaParaCuradoria(id: number): Promise<NormaAtual | null> {
  const { rows } = await pool.query<NormaAtual>(
    `select id, caminho, esfera, uf, municipio, orgao, tipo, tipo_slug as "tipoSlug", numero, ano,
            to_char(data, 'YYYY-MM-DD') as data, titulo, apelido, ementa, situacao, revogada, texto,
            hash_texto as "hashTexto", urn, repo_url as "repoUrl", git_sha as "gitSha", versao_texto as "versaoTexto",
            indexacao, fonte_url as "fonteUrl"
       from normas where id = $1 and removida_em is null`,
    [id],
  );
  return rows[0] ?? null;
}

export const dadosDe = (n: NormaAtual): DadosNorma => ({
  esfera: n.esfera, uf: n.uf, municipio: n.municipio, orgao: n.orgao, tipo: n.tipo, tipoSlug: n.tipoSlug,
  numero: n.numero, ano: n.ano, data: n.data, titulo: n.titulo, apelido: n.apelido, ementa: n.ementa,
  situacao: n.situacao, revogada: n.revogada,
});

/** Violação de unicidade do PostgreSQL (o Drizzle embrulha o erro do driver em `cause`). */
function violaUnicidade(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("code" in e && (e as { code: unknown }).code === "23505") return true;
  return "cause" in e && violaUnicidade((e as { cause: unknown }).cause);
}

/** Propõe a inclusão de uma norma nova. Fica pendente até a aprovação de outro revisor. */
export async function proporInclusao(
  ator: Ator,
  p: { dados: DadosNorma; texto: string; fonte: string; justificativa: string },
): Promise<Resultado<{ id: string }>> {
  const conferencia = await conferirComFonte(p.texto, p.fonte);
  const [r] = await db
    .insert(normasRevisoes)
    .values({
      tipo: "inclusao",
      dados: p.dados,
      texto: p.texto,
      hashTexto: hashDoTexto(p.texto),
      fonteOficial: p.fonte,
      justificativa: p.justificativa,
      conferencia,
      autorId: ator.id,
      autorEmail: ator.email,
    })
    .returning({ id: normasRevisoes.id });
  return { ok: true, id: r.id };
}

/** Propõe a correção do texto ou dos dados de uma norma existente. */
export async function proporEdicao(
  ator: Ator,
  normaId: number,
  p: { dados: DadosNorma; texto: string; fonte: string; justificativa: string },
): Promise<Resultado<{ id: string }>> {
  const atual = await normaParaCuradoria(normaId);
  if (!atual) return { ok: false, erro: "Norma não encontrada." };
  const iguais = atual.texto === p.texto && JSON.stringify(dadosDe(atual)) === JSON.stringify(p.dados) && atual.fonteUrl === p.fonte;
  if (iguais) return { ok: false, erro: "Nada mudou em relação à versão publicada. Para só conferir, use “Conferir com a fonte oficial”." };

  const conferencia = await conferirComFonte(p.texto, p.fonte);
  try {
    const [r] = await db
      .insert(normasRevisoes)
      .values({
        normaId,
        tipo: "edicao",
        dados: p.dados,
        texto: p.texto,
        hashTexto: hashDoTexto(p.texto),
        fonteOficial: p.fonte,
        justificativa: p.justificativa,
        conferencia,
        anterior: { dados: dadosDe(atual), texto: atual.texto, hashTexto: hashDoTexto(atual.texto) },
        autorId: ator.id,
        autorEmail: ator.email,
      })
      .returning({ id: normasRevisoes.id });
    return { ok: true, id: r.id };
  } catch (e) {
    if (violaUnicidade(e)) return { ok: false, erro: "Esta norma já tem uma revisão pendente. Conclua ou cancele aquela antes." };
    throw e;
  }
}

/**
 * Confere o texto publicado de uma norma com a fonte oficial. Se todos os
 * artigos baterem, a conferência é registrada na hora; senão, vai para revisão.
 */
export async function conferirNorma(ator: Ator, normaId: number, fonte: string, justificativa: string): Promise<Resultado<{ id: string; automatica: boolean }>> {
  if (!fonteOficialValida(fonte)) return { ok: false, erro: "Informe o link da fonte oficial (gov.br, leg.br, jus.br, mp.br ou def.br)." };
  const atual = await normaParaCuradoria(normaId);
  if (!atual) return { ok: false, erro: "Norma não encontrada." };

  const conferencia = await conferirComFonte(atual.texto, fonte);
  const hash = hashDoTexto(atual.texto);
  const automatica = conferencia.status === "confere";
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ id: string }>(
      `insert into normas_revisoes (norma_id, tipo, status, texto, hash_texto, fonte_oficial, justificativa, conferencia,
                                    autor_id, autor_email, revisada_em, parecer)
       values ($1, 'conferencia', $2, null, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        normaId,
        automatica ? "aprovada" : "pendente",
        hash,
        fonte,
        justificativa || "Conferência do texto publicado com a fonte oficial.",
        conferencia,
        ator.id,
        ator.email,
        automatica ? new Date() : null,
        automatica ? "Conferência automática: todos os artigos idênticos à fonte oficial." : null,
      ],
    );
    if (automatica) {
      await cliente.query(
        "update normas set conferida_em = now(), conferencia = $2, hash_texto = $3 where id = $1",
        [normaId, { ...conferencia, metodo: "automatica" } satisfies Conferencia, hash],
      );
    }
    await cliente.query("commit");
    return { ok: true, id: rows[0].id, automatica };
  } catch (e) {
    await cliente.query("rollback");
    if (violaUnicidade(e)) return { ok: false, erro: "Esta norma já tem uma revisão pendente. Conclua ou cancele aquela antes." };
    throw e;
  } finally {
    cliente.release();
  }
}

export async function obterRevisao(id: string): Promise<Revisao | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [r] = await db.select().from(normasRevisoes).where(eq(normasRevisoes.id, id)).limit(1);
  return r ?? null;
}

/** Aprova e publica. O revisor precisa ser outra pessoa e declarar que conferiu com a fonte. */
export async function aprovarRevisao(
  revisor: Ator,
  id: string,
  p: { conferiu: boolean; parecer: string },
): Promise<Resultado<{ normaId: number }>> {
  if (!p.conferiu) return { ok: false, erro: "Marque que você conferiu o texto com a fonte oficial." };
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<Revisao & { norma_id: number | null }>(
      `select id, norma_id, tipo, status, dados, texto, hash_texto as "hashTexto", fonte_oficial as "fonteOficial",
              conferencia, autor_id as "autorId" from normas_revisoes where id = $1 for update`,
      [id],
    );
    const r = rows[0];
    if (!r) return await desfazer(cliente, "Revisão não encontrada.");
    if (r.status !== "pendente") return await desfazer(cliente, "Esta revisão já foi concluída.");
    if (r.autorId === revisor.id) return await desfazer(cliente, "Quem propôs não pode aprovar: peça a outro administrador ou desenvolvedor.");
    const divergente = r.conferencia?.status !== "confere";
    if (divergente && p.parecer.length < 20) {
      return await desfazer(cliente, "A conferência automática não bateu: explique no parecer por que o texto está correto (mínimo de 20 caracteres).");
    }

    const conferencia: Conferencia = { ...(r.conferencia as Conferencia), metodo: "revisao" };
    const aprovar = async (normaId: number) => {
      await cliente.query(
        `update normas_revisoes set status = 'aprovada', norma_id = $2, revisor_id = $3, revisor_email = $4,
                revisada_em = now(), parecer = $5 where id = $1`,
        [id, normaId, revisor.id, revisor.email, p.parecer || null],
      );
    };

    let normaId: number;
    if (r.tipo === "conferencia") {
      normaId = r.norma_id!;
      const { rows: atual } = await cliente.query<{ hash: string }>(
        "select encode(sha256(convert_to(texto, 'UTF8')), 'hex') as hash from normas where id = $1",
        [normaId],
      );
      if (atual[0]?.hash !== r.hashTexto) {
        return await desfazer(cliente, "O texto da norma mudou depois que a conferência foi pedida. Peça uma nova conferência.");
      }
      await cliente.query("update normas set conferida_em = now(), conferencia = $2, hash_texto = $3 where id = $1", [
        normaId,
        conferencia,
        r.hashTexto,
      ]);
      await aprovar(normaId);
    } else {
      const dados = r.dados!;
      const texto = r.texto!;
      const atual = r.tipo === "edicao" ? await normaParaCuradoria(r.norma_id!) : null;
      if (r.tipo === "edicao" && !atual) return await desfazer(cliente, "A norma desta revisão não existe mais.");
      const caminho = atual?.caminho ?? `curadoria/${dados.esfera}/${dados.tipoSlug}/${dados.ano ?? "sem-ano"}/${slug(dados.titulo)}-${id.slice(0, 8)}`;
      const { dispositivos, sumario } = analisarEstrutura(texto, { prefixoAdct: caminho === "constituicao.md" });
      const preparada: NormaPreparada = {
        caminho,
        ...dados,
        versaoTexto: atual?.versaoTexto ?? "incluída pela curadoria",
        urn: atual?.urn ?? null,
        fonteUrl: r.fonteOficial,
        repoUrl: atual?.repoUrl ?? r.fonteOficial,
        areas: classificarAreas({ ...dados, indexacao: atual?.indexacao ?? null }),
        texto,
        sumario,
        gitSha: atual?.gitSha ?? `curadoria:${r.hashTexto!.slice(0, 12)}`,
        dispositivos,
      };
      // gravarLote abre a própria transação: a desta função é fechada antes, e o resto roda dentro da dela.
      await cliente.query("commit");
      normaId = 0;
      await gravarLote(cliente, [preparada], async (ids) => {
        normaId = Number(ids.get(caminho));
        await cliente.query(
          `update normas set curada = true, fonte = case when $4 then 'curadoria' else fonte end,
                  hash_texto = $2, conferida_em = now(), conferencia = $3, origem_mudou_em = null
            where id = $1`,
          [normaId, r.hashTexto, conferencia, r.tipo === "inclusao"],
        );
        // Confirma que ninguém aprovou a mesma revisão no intervalo.
        const { rowCount } = await cliente.query("select 1 from normas_revisoes where id = $1 and status = 'pendente' for update", [id]);
        if (!rowCount) throw new Error("REVISAO_CONCLUIDA");
        await aprovar(normaId);
      });
      return { ok: true, normaId };
    }
    await cliente.query("commit");
    return { ok: true, normaId };
  } catch (e) {
    await cliente.query("rollback").catch(() => undefined);
    if (e instanceof Error && e.message === "REVISAO_CONCLUIDA") return { ok: false, erro: "Esta revisão já foi concluída." };
    throw e;
  } finally {
    cliente.release();
  }
}

async function desfazer(cliente: PoolClient, erro: string): Promise<{ ok: false; erro: string }> {
  await cliente.query("rollback");
  return { ok: false, erro };
}

export async function rejeitarRevisao(revisor: Ator, id: string, motivo: string): Promise<Resultado> {
  if (motivo.length < 10) return { ok: false, erro: "Escreva o motivo da rejeição." };
  const { rows } = await pool.query<{ autor_id: string | null }>(
    "select autor_id from normas_revisoes where id = $1 and status = 'pendente'",
    [id],
  );
  if (!rows[0]) return { ok: false, erro: "Revisão não encontrada ou já concluída." };
  if (rows[0].autor_id === revisor.id) return { ok: false, erro: "Para desistir da própria proposta, use “Cancelar”." };
  await pool.query(
    `update normas_revisoes set status = 'rejeitada', revisor_id = $2, revisor_email = $3, revisada_em = now(), parecer = $4
      where id = $1 and status = 'pendente'`,
    [id, revisor.id, revisor.email, motivo],
  );
  return { ok: true };
}

export async function cancelarRevisao(autor: Ator, id: string): Promise<Resultado> {
  const { rowCount } = await pool.query(
    "update normas_revisoes set status = 'cancelada', revisada_em = now() where id = $1 and status = 'pendente' and autor_id = $2",
    [id, autor.id],
  );
  return rowCount ? { ok: true } : { ok: false, erro: "Só quem propôs pode cancelar uma revisão pendente." };
}

/** Normas conferidas cujo texto mudou fora da curadoria (a impressão digital não bate). */
export async function verificarIntegridade() {
  const { rows } = await pool.query<{ id: number; titulo: string; conferida_em: Date }>(
    `select id, titulo, conferida_em from normas
      where conferida_em is not null and hash_texto is not null
        and hash_texto <> encode(sha256(convert_to(texto, 'UTF8')), 'hex')
      order by conferida_em desc limit 100`,
  );
  return rows;
}

/** A curadoria revisou a mudança no repositório e manteve a versão curada. */
export async function dispensarAlertaOrigem(normaId: number) {
  await pool.query(
    "update normas set git_sha = coalesce(origem_sha, git_sha), origem_mudou_em = null where id = $1 and curada",
    [normaId],
  );
}

/** Verifica a integridade e guarda o resultado (mostrado na curadoria). */
export async function registrarVerificacaoIntegridade() {
  const violadas = await verificarIntegridade();
  await pool.query(
    `insert into acervo_estado (chave, valor, atualizado_em) values ('integridade', $1, now())
     on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`,
    [JSON.stringify({ verificadaEm: new Date().toISOString(), violadas })],
  );
  return violadas;
}
