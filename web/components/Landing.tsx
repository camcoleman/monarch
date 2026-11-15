"use client";

import { Bot, ChartCandlestick, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSETS, ROUND_SECONDS } from "@monarch/shared";
import { RegisterCard } from "@/components/RegisterCard";
import { AssetCoin } from "@/components/base/ui";
import { useMe } from "@/hooks/useMonarch";
import { friendlyError } from "@/lib/errors";
import { startPractice } from "@/lib/practice";

const FEATURES = [
  {
    img: "/village/goldmine.png",
    title: "Build",
    body: "Mine gold and upgrade your Town Hall, Gold Mine, Barracks and Trophy Hall - every upgrade is on-chain.",
  },
  {
    img: "/village/barracks.png",
    title: "Attack",
    body: `Get matched with a rival for a ${ROUND_SECONDS}-second trading battle. Pick a coin, go long or short, highest return wins.`,
  },
  {
    img: "/village/castle.png",
    title: "Conquer",
    body: "Victories claim new territory, loot 10% of your rival's gold, and push you up the leagues.",
  },
];

const STEPS = [
  "Connect a wallet on Monad Testnet and build your village.",
  "Collect gold from your Gold Mine and upgrade your buildings.",
  "Each Town Hall level unlocks a new coin: BTC, then ETH, SOL, DOGE and MON.",
  "Hit Attack - matchmaking finds you an opponent.",
  "Pick a coin, long or short, and leverage (your Barracks sets the max).",
  `Survive ${ROUND_SECONDS} seconds of live prices. Winners take land, gold and trophies on Monad.`,
];

export function Landing() {
  const router = useRouter();
  const me = useMe();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demo = async () => {
    setStarting(true);
    setError(null);
    try {
      router.push(`/battle/${await startPractice(me.address)}`);
    } catch (err) {
      setError(friendlyError(err));
      setStarting(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 pt-4 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <p className="clash-text font-display text-lg text-[#ffd84a]">Built on Monad</p>
          <h1 className="clash-text font-display text-6xl leading-none md:text-7xl">
            Trade. <span className="text-[#ffd84a]">Conquer.</span> Rule.
          </h1>
          <p className="clash-text max-w-xl font-display text-xl leading-snug">
            Build your village, beat rivals with your market calls, and expand your territory on-chain.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-red px-6 py-3 text-2xl" disabled={starting} onClick={demo}>
              <Bot size={26} strokeWidth={3} /> {starting ? "Starting..." : "Try a demo battle"}
            </button>
            <Link href="/trade" className="btn-blue px-5 py-3 text-xl">
              <ChartCandlestick size={22} strokeWidth={3} /> Practice trading
            </Link>
            <Link href="/leaderboard" className="btn-ghost px-5 py-3 text-xl">
              <Trophy size={22} strokeWidth={3} /> Rankings
            </Link>
          </div>
          <p className="clash-text font-display text-sm">The demo battle is free: no wallet needed, you vs the Training Bot on live prices.</p>
          {error && <p className="panel inline-block px-3 py-1 text-sm font-bold text-down">{error}</p>}
          <div className="flex items-center gap-2">
            {ASSETS.map((a) => (
              <AssetCoin key={a.id} asset={a.id} size={38} />
            ))}
          </div>
        </div>
        <div className="relative">
          <img
            src="/village/townhall.png"
            alt=""
            className="mx-auto -mb-6 w-56 drop-shadow-[0_14px_10px_rgb(0_0_0/0.45)] md:w-64"
          />
          <RegisterCard />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel flex items-center gap-4 p-4">
            <img src={f.img} alt="" className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_5px_4px_rgb(0_0_0/0.35)]" />
            <div>
              <h3 className="font-display text-2xl">{f.title}</h3>
              <p className="mt-1 text-sm">{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="panel overflow-hidden">
        <div className="wood-header px-6 py-3">
          <h2 className="clash-text font-display text-2xl">How it works</h2>
        </div>
        <ol className="grid gap-3 p-6 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#1d1206] bg-[linear-gradient(180deg,#bfeaff,#3aa2ec)] font-display text-lg text-white"
                style={{ textShadow: "0 2px 0 #1d1206" }}
              >
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
