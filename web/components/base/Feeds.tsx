"use client";

import { ChevronLeft, Radio, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FAUCET_URL } from "@monarch/shared";
import { useHistory, usePlayers, useRecentBattles, type BattleRecord } from "@/hooks/useMonarch";
import { useLiveBattles, useMarket } from "@/hooks/useLiveBattles";
import { useNow } from "@/hooks/useNow";
import { SESSION_FUNDING, useSession } from "@/hooks/useSession";
import { friendlyError } from "@/lib/errors";
import { countdown, pct, shortAddr, usd } from "@/lib/format";
import { useLatestPrice } from "@/lib/priceStore";
import { GoldCoin, HoloModal } from "./ui";

function ago(seconds: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - seconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function useNameOf() {
  const { byAddress } = usePlayers();
  return (a: string) => byAddress.get(a)?.name ?? shortAddr(a);
}

export function BattleLogModal({ address, onClose }: { address: string; onClose: () => void }) {
  const { records, isLoading } = useHistory(address);
  const nameOf = useNameOf();
  return (
    <HoloModal title="Battle log" onClose={onClose} wide>
      {records.length === 0 ? (
        <p className="py-8 text-center text-zinc-400">{isLoading ? "Loading from Monad..." : "No battles yet. Hit Attack!"}</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r, i) => {
            const won = r.winner === address;
            const rival = won ? r.loser : r.winner;
            const myBps = won ? r.winnerBps : r.loserBps;
            const theirBps = won ? r.loserBps : r.winnerBps;
            return (
              <li
                key={i}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  won ? "border-emerald-400/30 bg-emerald-400/5" : "border-red-400/30 bg-red-400/5"
                }`}
              >
                <span className={`w-20 font-display text-sm font-black ${won ? "text-emerald-300" : "text-red-300"}`}>
                  {won ? "VICTORY" : "DEFEAT"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    vs{" "}
                    <Link href={`/kingdom/${rival}`} className="font-semibold hover:text-neon">
                      {nameOf(rival)}
                    </Link>
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    {pct(myBps / 100)} vs {pct(theirBps / 100)} · {ago(r.timestamp)}
                  </p>
                </div>
                <span className={`flex items-center gap-1 font-display text-sm ${won ? "text-amber-200" : "text-red-300"}`}>
                  {won ? "+" : "-"}
                  {r.loot} <GoldCoin size={14} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </HoloModal>
  );
}

/** Slide-out live feed on the left edge, like Clash's chat tab. */
export function LiveFeed() {
  const [open, setOpen] = useState(false);
  const live = useLiveBattles();
  const { records } = useRecentBattles(8);
  const nameOf = useNameOf();
  const now = useNow();
  const running = live.filter((b) => b.phase !== "ended");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="holo pointer-events-auto absolute left-0 top-1/2 z-[150] flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-2xl border-l-0 px-1.5 py-4"
        aria-label="Open live feed"
      >
        <Radio size={18} className="text-red-400" />
        <span className="font-display text-[10px] font-bold tracking-widest [writing-mode:vertical-rl]">LIVE</span>
        {running.length > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{running.length}</span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-[250]" onClick={() => setOpen(false)}>
          <aside
            className="slide-in-left holo absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col rounded-r-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neon/25 px-4 py-3">
              <h2 className="hud-text flex items-center gap-2 font-display font-bold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE BATTLES
              </h2>
              <button onClick={() => setOpen(false)} className="text-cyan-200" aria-label="Close">
                <ChevronLeft />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {live.length === 0 && <p className="text-sm text-zinc-500">No battles right now.</p>}
              {live.map((b) => {
                const a = b.creator;
                const o = b.opponent;
                return (
                  <Link
                    key={b.id}
                    href={`/battle/${b.id}`}
                    className="block rounded-2xl border border-neon/20 bg-slate-950/50 p-3 transition hover:border-neon/60"
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest">
                      <span className={b.phase === "live" ? "text-red-400" : "text-zinc-400"}>
                        {b.phase === "lobby" ? "Open invite" : b.phase === "picking" ? "Choosing sides" : b.phase === "live" ? "● Live" : "Ended"}
                      </span>
                      {b.phase === "live" && b.endsAt && <span className="font-mono text-zinc-300">{countdown(b.endsAt - now)}</span>}
                    </div>
                    {[a, o].map((p, i) =>
                      p ? (
                        <div key={p.address} className="flex justify-between text-sm">
                          <span className={b.winner === p.address ? "font-bold text-gold" : ""}>
                            {b.winner === p.address && "👑 "}
                            {p.name}
                          </span>
                          <span className={`font-mono ${(b.returns[p.address] ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                            {b.returns[p.address] !== undefined ? pct(b.returns[p.address], 2) : "-"}
                          </span>
                        </div>
                      ) : (
                        <p key={i} className="text-sm text-zinc-500">
                          Waiting for opponent...
                        </p>
                      )
                    )}
                    <p className="mt-1 text-right text-[10px] text-neon">Watch →</p>
                  </Link>
                );
              })}
              <div>
                <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-zinc-400">On-chain results</h3>
                <ul className="space-y-1.5 text-sm">
                  {records.map((r: BattleRecord, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="text-gold">{nameOf(r.winner)}</span> beat {nameOf(r.loser)}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">{ago(r.timestamp)}</span>
                    </li>
                  ))}
                  {records.length === 0 && <li className="text-zinc-500">Nothing settled yet.</li>}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function BtcTicker() {
  const price = useLatestPrice();
  const market = useMarket();
  const change = price && market?.open24h ? ((price - market.open24h) / market.open24h) * 100 : null;
  return (
    <Link href="/trade" className="chamfer holo pointer-events-auto flex items-center gap-3 px-4 py-1.5" title="Live BTC-USD (Coinbase)">
      <span className="flex items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-orange-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" /> BTC
      </span>
      <span className="hud-text font-mono text-sm font-bold sm:text-base">{price ? usd(price) : "..."}</span>
      {change !== null && (
        <span className={`font-mono text-xs font-bold ${change >= 0 ? "text-up" : "text-down"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </span>
      )}
      {market && (
        <span className="hidden font-mono text-[10px] text-zinc-400 lg:inline">
          H {usd(market.high24h, 0)} · L {usd(market.low24h, 0)}
        </span>
      )}
    </Link>
  );
}

/** Toggle for session keys: one wallet approval, then no pop-ups for battles and building. */
export function FastModeChip({ address }: { address: string }) {
  const session = useSession(address);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (session.active) await session.end();
      else await session.start();
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`chamfer pointer-events-auto flex items-center gap-1.5 border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest backdrop-blur ${
          session.active ? "border-amber-300/70 bg-amber-300/15 text-amber-200" : "border-zinc-500/50 bg-black/40 text-zinc-300"
        }`}
      >
        <Zap size={12} className={session.active ? "fill-amber-300" : ""} /> Fast mode {session.active ? "on" : "off"}
      </button>
      {open && (
        <HoloModal title="Fast mode" onClose={() => setOpen(false)}>
          <div className="space-y-4 text-sm text-zinc-300">
            <p>
              Fast mode creates a temporary game key in this browser and authorizes it on-chain for 7 days. Battles, upgrades and
              gold collection then happen instantly, with no wallet pop-ups.
            </p>
            <p className="text-zinc-400">
              It can only play MONARCH as you; it can&apos;t move your funds. Enabling sends {SESSION_FUNDING} MON to the key for gas.
            </p>
            {session.active && (
              <p className="font-mono text-xs text-zinc-400">
                Key {session.account && shortAddr(session.account.address)} · {session.keyBalance.toFixed(4)} MON for gas
                {!session.canPayGas && (
                  <span className="text-amber-300"> (low - transactions use your wallet; turn off and on to refill)</span>
                )}
              </p>
            )}
            {error && (
              <p className="text-red-400">
                {error}{" "}
                {error.includes("faucet") && (
                  <a className="underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
                    Open faucet
                  </a>
                )}
              </p>
            )}
            <button className={session.active ? "btn-ghost w-full" : "btn-gold w-full gap-2"} disabled={busy} onClick={toggle}>
              {busy ? "Confirm in wallet..." : session.active ? "Turn off fast mode" : <><Zap size={16} /> Enable fast mode</>}
            </button>
          </div>
        </HoloModal>
      )}
    </>
  );
}
