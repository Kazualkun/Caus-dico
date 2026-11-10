import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GARANTIAS, RESSALVA_DOU } from "@/components/acervo/compromisso";
import { ContractSpecimen } from "@/components/marketing/contract-specimen";
import { PricingTable } from "@/components/marketing/pricing-table";
import { calcularHonorarios, INPUTS_PADRAO } from "@/lib/pricing/engine";
import { formatBRL, formatPercent } from "@/lib/format";

export default function LandingPage() {
  // Exemplo real do motor de precificação, calculado com as premissas padrão.
  const exemplo = calcularHonorarios(INPUTS_PADRAO);

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:pt-20 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="font-serif text-4xl leading-[1.08] font-semibold tracking-tight text-grafite sm:text-5xl lg:text-[3.4rem]">
              Cada cláusula frágil, grifada e fundamentada.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              O Causídico audita contratos, calcula honorários e pesquisa teses a partir do texto da lei e mostra de onde veio
              cada fundamento.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-[0.95rem]">
                <Link href="/cadastro">Começar agora</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[0.95rem]">
                <Link href="/planos">Ver planos</Link>
              </Button>
            </div>
          </div>
          <ContractSpecimen />
        </section>

        <div id="modulos" className="border-y border-border bg-folha">
          <section aria-labelledby="titulo-contratos" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-20">
            <div className="max-w-md space-y-4">
              <h2 id="titulo-contratos" className="font-serif text-3xl font-semibold tracking-tight">
                Auditoria de contratos
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                Envie o PDF ou o Word e diga qual parte você representa. O parecer chega com nota de risco, o trecho exato de
                cada problema grifado no texto e o que corrigir em cada cláusula, com o fundamento.
              </p>
              <p className="leading-relaxed text-muted-foreground">
                A IA aponta e fundamenta; quem redige as cláusulas é você.
              </p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              <li className="bg-papel p-5">
                <p className="text-sm font-medium">Analista de contratos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Procura brechas, ambiguidades, remissões erradas e cláusulas que faltam para esse tipo de contrato.
                </p>
              </li>
              <li className="bg-papel p-5">
                <p className="text-sm font-medium">Pesquisador de conformidade</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confere cada cláusula contra o CDC, o Código Civil, a Lei do Inquilinato, a CLT e a LGPD.
                </p>
              </li>
              <li className="bg-papel p-5 sm:col-span-2">
                <p className="text-sm font-medium">Estrategista</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recebe os dois relatórios, descarta o que não se sustenta no texto, ordena por gravidade e indica o que
                  corrigir em cada cláusula sob a perspectiva do seu cliente.
                </p>
              </li>
            </ol>
          </section>

          <section aria-labelledby="titulo-honorarios" className="border-t border-border">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-20">
              <div className="max-w-md space-y-4">
                <h2 id="titulo-honorarios" className="font-serif text-3xl font-semibold tracking-tight">
                  Honorários que fecham a conta
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  Parta dos custos do seu escritório, das horas estimadas, do valor da causa e do risco. A calculadora mostra o
                  mínimo aceitável, já com impostos e eventual repasse por indicação, o médio e o ideal, compara com a tabela da
                  OAB da sua seccional e gera a proposta em PDF para enviar ao cliente.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Em dúvida sobre complexidade e risco? Descreva o caso ou envie o arquivo: a IA sugere os dois, com a
                  justificativa, e nada do que você enviou fica guardado.
                </p>
              </div>
              <div className="folha p-6 sm:p-7">
                <p className="text-sm text-muted-foreground">
                  Ação cível de {formatBRL(INPUTS_PADRAO.valorCausaCents, { semCentavos: true })}, {INPUTS_PADRAO.horasEstimadas}{" "}
                  horas estimadas, complexidade e risco médios
                </p>
                <dl className="mt-5 grid grid-cols-3 border-y border-border">
                  {[
                    ["Mínimo", exemplo.minimoCents],
                    ["Médio", exemplo.medioCents],
                    ["Ideal", exemplo.idealCents],
                  ].map(([rotulo, valor], i) => (
                    <div key={rotulo} className={i > 0 ? "border-l border-border py-4 pl-4" : "py-4"}>
                      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
                      <dd className="font-serif text-xl font-semibold sm:text-2xl">
                        {formatBRL(Number(valor), { semCentavos: true })}
                      </dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-4 space-y-1.5 text-sm">
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Êxito (quota litis)</span>
                    <span>{formatPercent(exemplo.formatos.exito.percentual ?? 0)} do proveito</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Misto</span>
                    <span>
                      {formatBRL(exemplo.formatos.misto.valorFixoCents ?? 0, { semCentavos: true })} +{" "}
                      {formatPercent(exemplo.formatos.misto.percentual ?? 0)}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Por hora</span>
                    <span>{formatBRL(exemplo.valorHoraEfetivoCents, { semCentavos: true })}/h</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section aria-labelledby="titulo-pesquisa" className="border-t border-border">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-20">
              <div className="max-w-md space-y-4">
                <h2 id="titulo-pesquisa" className="font-serif text-3xl font-semibold tracking-tight">
                  Pesquisa jurídica com endereço
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  Escreva a dúvida como escreveria a um colega. A nota de pesquisa traz a tese, os artigos de lei, as correntes
                  doutrinárias, a tendência dos tribunais e a peça recomendada, com requisitos e prazo. A redação da peça
                  fica com você.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Artigos, súmulas e temas citados vêm do acervo, com link para a fonte oficial. O que não estiver no acervo
                  aparece marcado para você conferir, e a IA é instruída a não citar números de processo fora do acervo.
                </p>
              </div>
              <div className="folha space-y-4 p-6 sm:p-7">
                <p className="texto-juridico text-[1.05rem] text-grafite">
                  &ldquo;Contrato bancário assinado eletronicamente, sem testemunhas, vale como título executivo?&rdquo;
                </p>
                <div className="border-l-2 border-tinta pl-4">
                  <p className="text-sm font-medium">Resposta direta</p>
                  <p className="texto-juridico text-sm">
                    Em regra, sim: o CPC admite qualquer modalidade de assinatura eletrônica prevista em lei e dispensa as
                    testemunhas quando a integridade é conferida por provedor de assinatura.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-[3px] border border-tinta/25 bg-accent px-1.5 py-0.5 text-xs text-tinta">
                    Código de Processo Civil, art. 784
                  </span>
                  <span className="rounded-[3px] border border-tinta/25 bg-accent px-1.5 py-0.5 text-xs text-tinta">
                    Lei de Assinaturas Eletrônicas, art. 4º
                  </span>
                  <span className="rounded-[3px] border border-tinta/25 bg-accent px-1.5 py-0.5 text-xs text-tinta">
                    ICP-Brasil (MP 2.200-2), art. 10
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="titulo-legislacao" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:pt-20">
          <div className="max-w-2xl space-y-4">
            <h2 id="titulo-legislacao" className="font-serif text-3xl font-semibold tracking-tight">
              Legislação com procedência
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Leis federais praticamente completas, boa parte das leis estaduais, súmulas e temas dos tribunais e uma
              parte ainda pequena da legislação municipal, atualizados a partir das fontes oficiais. Você sempre sabe de onde veio o texto e quando ele foi
              conferido.
            </p>
          </div>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIAS.map((g) => (
              <li key={g.titulo} className="space-y-2 bg-folha p-5">
                <g.icone className="size-5 text-tinta" aria-hidden />
                <p className="font-medium">{g.titulo}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{g.texto}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{RESSALVA_DOU}</p>
        </section>

        <section id="planos" aria-labelledby="titulo-planos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="titulo-planos" className="mb-8 font-serif text-3xl font-semibold tracking-tight">
            Planos
          </h2>
          <PricingTable />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
