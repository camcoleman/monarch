"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoldCoin, LandIcon, TrophyIcon } from "@/components/base/ui";
import { useMe } from "@/hooks/useMonarch";
import { price as fmtPrice } from "@/lib/format";
import { useLatestPrice } from "@/lib/priceStore";

const LINKS = [
  { href: "/", label: "Village" },
  { href: "/trade", label: "Train" },
  { href: "/leaderboard", label: "Ranks" },
];

export function Nav() {
  const pathname = usePathname();
  const price = useLatestPrice("BTC");
  const { player } = useMe();

  return (
    <header className="wood-header sticky top-0 z-20 border-b-[3px] border-[#1d1206] shadow-[0_3px_0_rgb(29_18_6/0.4)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <Link href="/" className="clash-text font-display text-3xl tracking-wide">
          MONARCH
        </Link>
        <nav className="order-last -mx-1 flex w-full gap-2 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1 text-base ${
                (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)) ? "btn-gold" : "btn-ghost"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="clash-text hidden font-display text-base sm:inline">BTC {price ? fmtPrice(price) : "..."}</span>
          {player && (
            <span className="hidden items-center gap-3 md:flex">
              <span title="Trophies" className="hud-pill flex items-center gap-1 px-2 py-0.5">
                <TrophyIcon size={18} /> <span className="clash-text font-display">{player.trophies}</span>
              </span>
              <span title="Gold" className="hud-pill flex items-center gap-1 px-2 py-0.5">
                <GoldCoin size={16} /> <span className="clash-text font-display">{player.gold}</span>
              </span>
              <span title="Territory" className="hud-pill flex items-center gap-1 px-2 py-0.5">
                <LandIcon size={18} /> <span className="clash-text font-display">{player.land}</span>
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
