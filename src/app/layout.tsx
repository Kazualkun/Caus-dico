import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Literata: quando a lei fala (documentos, pareceres, títulos).
// Schibsted Grotesk: quando a ferramenta fala (interface).
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Causídico — honorários, contratos e pesquisa jurídica", template: "%s | Causídico" },
  description:
    "Precifique honorários, audite contratos e pesquise teses com fundamento no texto da lei. Para advogados e escritórios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${literata.variable} ${schibsted.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-tinta focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Pular para o conteúdo
        </a>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
