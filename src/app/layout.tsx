import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { Providers } from "./providers";
import { storeConfig } from "@/lib/store-config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
});

const TITLE = "Gata Fit — Moda Fitness, Praia & Pijamas";
const DESCRIPTION =
  "Moda feminina premium: fitness, moda praia e pijamas. Peças que valorizam o seu corpo, com caimento perfeito. Frete para todo o Brasil, pagamento via Pix, cartão e boleto.";

export const metadata: Metadata = {
  metadataBase: new URL(storeConfig.url),
  title: {
    default: TITLE,
    template: "%s | Gata Fit",
  },
  description: DESCRIPTION,
  applicationName: "Gata Fit",
  openGraph: {
    type: "website",
    siteName: "Gata Fit",
    title: TITLE,
    description: DESCRIPTION,
    locale: "pt_BR",
    url: storeConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema aplicado no SSR pela leitura do cookie — sem script inline (evita
  // o aviso do React sobre <script> e o flash de tema errado).
  const isDark = (await cookies()).get("theme")?.value === "dark";

  return (
    // As variáveis de fonte ficam no <html> (:root) para que o Tailwind
    // (--font-serif/--font-sans, definidos em @theme no :root) consiga
    // resolvê-las. Se ficarem no <body>, o serif não carrega em lugar nenhum.
    <html
      lang="pt-BR"
      className={`${inter.variable} ${cormorant.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
