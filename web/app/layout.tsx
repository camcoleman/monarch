import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { StatusBanner } from "@/components/StatusBanner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MONARCH - Trade. Conquer. Rule.",
  description: "Competitive BTC paper-trading battles to conquer the United States, on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <Nav />
          <StatusBanner />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
