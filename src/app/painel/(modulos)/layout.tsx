import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/page-parts";
import { requireSubscriber } from "@/lib/auth";

/** Os módulos exigem assinatura ativa; "Minha conta" fica fora deste grupo. */
async function AssinanteGate({ children }: { children: React.ReactNode }) {
  await requireSubscriber();
  return children;
}

export default function ModulosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssinanteGate>{children}</AssinanteGate>
    </Suspense>
  );
}
