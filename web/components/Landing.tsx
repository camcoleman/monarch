import Link from "next/link";
import { RegisterCard } from "@/components/RegisterCard";

const FEATURES = [
  {
    href: "/trade",
    title: "Train",
    body: "Practice with $10,000 of virtual USD. Go long or short on BTC with up to 10x leverage on live prices.",
  },
  {
    href: "/leaderboard",
    title: "Attack",
    body: "Hit Attack to get matched with a rival for a 90-second BTC battle. Same entry, one call, highest return wins.",
  },
  {
    href: "/leaderboard",
    title: "Expand",
    body: "Victories claim new territory for your base, loot 10% of your rival's gold, and climb you up the leagues.",
  },
];

const STEPS = [
  "Connect a wallet on Monad Testnet and claim your base.",
  "Collect gold from your Extractor and upgrade your buildings.",
  "Hit Attack - matchmaking finds you an opponent.",
  "Pick long or short and leverage (your Mech Bay sets the max).",
  "Survive 90 seconds of live BTC moves. Highest return wins.",
  "Winners gain territory, gold and trophies - all settled on Monad.",
];

export function Landing() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 pt-6 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <p className="font-display text-xs uppercase tracking-[0.4em] text-neon">Built on Monad</p>
          <h1 className="font-display text-5xl font-black leading-tight md:text-6xl">
            Trade. <span className="text-gold drop-shadow-[0_0_20px_rgb(251_191_36/0.5)]">Conquer.</span> Rule.
          </h1>
          <p className="max-w-xl text-lg text-zinc-400">
            MONARCH is a futuristic base-builder powered by real BTC trading battles. Build your base, beat rivals with
            your market calls, and expand your territory on-chain.
          </p>
          <div className="flex gap-3">
            <Link href="/trade" className="btn-neon">
              Practice trading
            </Link>
            <Link href="/leaderboard" className="btn-ghost">
              See rankings
            </Link>
          </div>
        </div>
        <RegisterCard />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.href} className="panel p-5 transition hover:border-neon/60">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-neon">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider">How it works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-zinc-300">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neon/40 bg-neon/10 font-display text-sm font-bold text-neon">
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
