import Link from "next/link";
import { RegisterCard } from "@/components/RegisterCard";

const FEATURES = [
  {
    href: "/trade",
    title: "Paper Trading",
    body: "Practice with $10,000 of virtual USD. Go long or short on BTC with up to 10x leverage using live prices.",
  },
  {
    href: "/map",
    title: "1v1 Trading Battles",
    body: "Challenge a rival to a 90-second BTC battle. Same entry price, one decision, highest return wins.",
  },
  {
    href: "/leaderboard",
    title: "Territory Conquest",
    body: "Winners capture states on a shared US map. Every victory is settled on Monad Testnet.",
  },
];

const STEPS = [
  "Connect your wallet on Monad Testnet and register a name.",
  "Practice trading BTC with $10,000 in paper funds.",
  "Pick a state on the conquest map and declare war.",
  "Share the battle link with a rival.",
  "Choose long or short and leverage, then survive 90 seconds of real BTC moves.",
  "Win to earn 25 trophies, 100 gold, and the state - recorded on-chain.",
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 pt-6 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <p className="text-sm uppercase tracking-[0.3em] text-royal">Built on Monad</p>
          <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
            Trade. <span className="text-gold">Conquer.</span> Rule.
          </h1>
          <p className="max-w-xl text-lg text-zinc-400">
            MONARCH is a competitive crypto paper-trading game. Battle rivals using real BTC price moves and capture
            territory across the United States.
          </p>
          <div className="flex gap-3">
            <Link href="/map" className="btn-gold">
              Start conquering
            </Link>
            <Link href="/trade" className="btn-ghost">
              Practice trading
            </Link>
          </div>
        </div>
        <RegisterCard />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.href} className="panel p-5 transition hover:border-gold/50">
            <h3 className="font-display text-xl text-gold">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-2xl">How it works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-zinc-300">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
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
