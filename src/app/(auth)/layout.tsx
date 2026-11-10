import { Wordmark } from "@/components/brand";
import { RodapeCompacto } from "@/components/site-chrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="conteudo" className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Wordmark className="mb-8" />
        <div className="folha w-full max-w-md px-6 py-8 sm:px-8">{children}</div>
      </main>
      <RodapeCompacto className="mx-auto w-full max-w-md px-4 pb-8" />
    </>
  );
}
