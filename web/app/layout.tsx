import type { Metadata } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { StatusBanner } from "@/components/StatusBanner";
import { Providers } from "./providers";
import "./globals.css";

const lilita = Lilita_One({ subsets: ["latin"], variable: "--font-lilita", weight: "400" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "MONARCH - Trade. Conquer. Rule.",
  description: "Build your village and win crypto trading battles to expand your territory, on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <body className="font-sans font-semibold antialiased">
        <Providers>
          <Nav />
          <StatusBanner />
          <main className="mx-auto max-w-6xl px-4 pb-10 pt-6">{children}</main>
          <footer className="clash-text pb-6 text-center text-xs">
            Charts by{" "}
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline">
              TradingView Lightweight Charts
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
