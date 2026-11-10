/**
 * Espécime de auditoria: uma cláusula real de contrato de prestação de
 * serviços ao consumidor, grifada como o produto grifa, com a nota na margem.
 */
export function ContractSpecimen() {
  return (
    <figure
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-start"
      aria-label="Exemplo de cláusula auditada"
    >
      <div className="folha px-6 pt-7 pb-8 sm:px-8 sm:pt-8">
        <p className="mb-5 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Contrato de prestação de serviços educacionais</span>
          <span>fls. 4</span>
        </p>
        <div className="texto-juridico space-y-4 text-[0.95rem] text-grafite">
          <p className="font-semibold">CLÁUSULA 7ª – DA RESCISÃO</p>
          <p>
            7.1. O presente contrato poderá ser rescindido por qualquer das partes, observadas as condições desta cláusula.
          </p>
          <p>
            7.2. Em caso de rescisão antecipada por iniciativa do CONTRATANTE,{" "}
            <mark className="grifo grifo-animado">
              este pagará multa equivalente a 100% (cem por cento) das mensalidades vincendas, além da perda dos valores já
              pagos
            </mark>
            <sup className="ml-0.5 font-sans text-[0.65rem] font-semibold text-tinta">1</sup>.
          </p>
          <p>
            7.3. A CONTRATADA poderá rescindir este contrato mediante{" "}
            <mark className="grifo grifo-suave grifo-animado grifo-animado-2">aviso prévio razoável</mark>
            <sup className="ml-0.5 font-sans text-[0.65rem] font-semibold text-tinta">2</sup>, sem ônus para as partes.
          </p>
        </div>
      </div>

      {/* Notas na margem, alinhadas à altura da cláusula 7.2 */}
      <figcaption className="space-y-3 sm:mt-32">
        <div className="rounded-md border border-carimbo/30 bg-folha p-3.5 shadow-[0_8px_24px_-14px_rgb(32_35_43/0.35)]">
          <p className="mb-1 flex items-center gap-2 text-xs">
            <span className="grid size-4 place-items-center rounded-full bg-tinta text-[0.6rem] font-semibold text-white">1</span>
            <span className="font-medium text-carimbo">Abusividade, severidade alta</span>
          </p>
          <p className="text-sm leading-snug">
            Multa integral sobre as parcelas futuras é excessivamente onerosa ao consumidor.
          </p>
          <p className="mt-2 text-xs text-tinta">CDC, art. 51, IV e § 1º, III</p>
        </div>
        <div className="rounded-md border border-border bg-folha p-3.5 shadow-[0_8px_24px_-14px_rgb(32_35_43/0.35)]">
          <p className="mb-1 flex items-center gap-2 text-xs">
            <span className="grid size-4 place-items-center rounded-full bg-tinta text-[0.6rem] font-semibold text-white">2</span>
            <span className="font-medium text-atencao">Ambiguidade, severidade média</span>
          </p>
          <p className="text-sm leading-snug">&ldquo;Razoável&rdquo; não é prazo. Sugestão: aviso com 30 dias de antecedência.</p>
        </div>
      </figcaption>
    </figure>
  );
}
