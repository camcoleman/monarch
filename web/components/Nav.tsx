"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoldCoin, LandIcon } from "@/components/base/ui";
import { useMe } from "@/hooks/useMonarch";
import { usd } from "@/lib/format";
import { useLatestPrice } from "@/lib/priceStore";

const LINKS = [
  { href: "/", label: "Base" },
  { href: "/trade", label: "Train" },
  { href: "/leaderboard", label: "Ranks" },
];

export function Nav() {
  const pathname = usePathname();
  const price = useLatestPrice();
  const { player } = useMe();

  return (
    <header className="sticky top-0 z-20 border-b border-neon/20 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="hud-text font-display text-xl font-black tracking-[0.25em]">
          MONARCH
        </Link>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-widest transition ${
                (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href))
                  ? "bg-neon/10 text-neon"
                  : "text-zinc-400 hover:text-zinc-100"
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
            <span className="hidden items-center gap-3 md:flex">
              <span title="Trophies">🏆 {player.trophies}</span>
              <span title="Gold" className="inline-flex items-center gap-1">
                <GoldCoin size={16} /> {player.gold}
              </span>
              <span title="Territory" className="inline-flex items-center gap-1">
                <LandIcon size={16} /> {player.land}
              </span>
            </span>
          )}
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
          />
        </div>
      </div>
    </header>
  );
}
