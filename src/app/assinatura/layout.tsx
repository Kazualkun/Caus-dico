import { Wordmark } from "@/components/brand";
import { RodapeCompacto } from "@/components/site-chrome";

export default function AssinaturaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-folha">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
      {/* Checkout: identificação do fornecedor visível antes de pagar (Decreto 7.962/2013, art. 2º). */}
      <RodapeCompacto className="mx-auto w-full max-w-4xl border-t border-border px-4 py-6 sm:px-6" />
    </>
  );
}
