"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/useMonarch";
import { usd } from "@/lib/format";
import { useLatestPrice } from "@/lib/priceStore";

const LINKS = [
  { href: "/trade", label: "Trade" },
  { href: "/map", label: "Conquest" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Nav() {
  const pathname = usePathname();
  const price = useLatestPrice();
  const { player } = useMe();

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-[0.2em] text-gold">
          MONARCH
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 transition ${
                pathname.startsWith(l.href) ? "bg-edge text-gold" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="hidden font-mono text-zinc-400 sm:inline">
            BTC <span className="text-zinc-100">{price ? usd(price) : "..."}</span>
          </span>
          {player && (
            <span className="hidden gap-3 md:flex">
              <span title="Trophies">🏆 {player.trophies}</span>
              <span title="Gold">🪙 {player.gold}</span>
              <span title="States">🏰 {player.statesOwned}</span>
            </span>
          )}
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
        </div>
      </div>
    </header>
  );
}
