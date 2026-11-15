import type { Metadata } from "next";
import { Exo_2, Orbitron } from "next/font/google";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { StatusBanner } from "@/components/StatusBanner";
import { Providers } from "./providers";
import "./globals.css";

const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", weight: ["500", "700", "900"] });
const exo = Exo_2({ subsets: ["latin"], variable: "--font-exo" });

export const metadata: Metadata = {
  title: "MONARCH - Trade. Conquer. Rule.",
  description: "Build a futuristic base and win BTC trading battles to expand your territory, on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${exo.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <Nav />
          <StatusBanner />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
