"use client";

import { ChevronLeft, Radio, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FAUCET_URL, isAsset, unlockedAssets } from "@monarch/shared";
import { useHistory, usePlayers, useRecentBattles, type BattleRecord } from "@/hooks/useMonarch";
import { useLiveBattles, useMarket } from "@/hooks/useLiveBattles";
import { useNow } from "@/hooks/useNow";
import { SESSION_FUNDING, useSession } from "@/hooks/useSession";
import { friendlyError } from "@/lib/errors";
import { countdown, pct, price as fmtPrice, shortAddr } from "@/lib/format";
import { useLatestPrice, useSelectedAsset } from "@/lib/priceStore";
import { AssetCoin, ClashModal, GoldCoin } from "./ui";

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
    <ClashModal title="Battle Log" onClose={onClose} wide>
      {records.length === 0 ? (
        <p className="py-8 text-center text-muted">{isLoading ? "Loading from Monad..." : "No battles yet. Hit Attack!"}</p>
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
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  won ? "border-up/50 bg-[#e3f5c8]" : "border-down/40 bg-[#f8d9cf]"
                }`}
              >
                <span className={`w-20 font-display text-base ${won ? "text-up" : "text-down"}`}>{won ? "Victory" : "Defeat"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    vs{" "}
                    <Link href={`/kingdom/${rival}`} className="font-extrabold hover:underline">
                      {nameOf(rival)}
                    </Link>
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {pct(myBps / 100)} vs {pct(theirBps / 100)} · {ago(r.timestamp)}
                  </p>
                </div>
                <span className={`flex items-center gap-1 font-display ${won ? "text-up" : "text-down"}`}>
                  {won ? "+" : "-"}
                  {r.loot} <GoldCoin size={16} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ClashModal>
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
        className="pointer-events-auto absolute left-3 top-1/2 z-[150] flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border-[3px] border-[#1d1206] bg-[linear-gradient(90deg,#8b5a2b,#b07c45)] px-2 py-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.3),0_3px_0_#1d1206] transition hover:brightness-110 sm:left-4"
        aria-label="Open live feed"
      >
        <Radio size={18} strokeWidth={3} className="text-white drop-shadow-[0_1px_0_#1d1206]" />
        <span className="clash-text font-display text-xs tracking-wider [writing-mode:vertical-rl]">LIVE</span>
        {running.length > 0 && (
          <span className="rounded-full border-2 border-[#1d1206] bg-down px-1.5 font-display text-[11px] text-white">{running.length}</span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-[250]" onClick={() => setOpen(false)}>
          <aside
            className="slide-in-left panel absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col overflow-hidden rounded-l-none rounded-r-3xl border-l-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wood-header flex items-center justify-between px-4 py-3">
              <h2 className="clash-text flex items-center gap-2 font-display text-xl">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full border border-[#1d1206] bg-down" /> Live Battles
              </h2>
              <button onClick={() => setOpen(false)} className="btn-red h-8 w-8 rounded-lg p-0" aria-label="Close">
                <ChevronLeft size={20} strokeWidth={4} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {live.length === 0 && <p className="text-sm text-muted">No battles right now.</p>}
              {live.map((b) => (
                <Link key={b.id} href={`/battle/${b.id}`} className="well block p-3 transition hover:brightness-105">
                  <div className="mb-1 flex items-center justify-between font-display text-xs">
                    <span className={b.phase === "live" ? "text-down" : "text-muted"}>
                      {b.phase === "lobby" ? "Open invite" : b.phase === "picking" ? "Choosing sides" : b.phase === "live" ? "● Live" : "Ended"}
                    </span>
                    {b.phase === "live" && b.endsAt && <span className="font-mono">{countdown(b.endsAt - now)}</span>}
                  </div>
                  {[b.creator, b.opponent].map((p, i) =>
                    p ? (
                      <div key={p.address} className="flex justify-between text-sm">
                        <span className={b.winner === p.address ? "font-extrabold text-[#b07800]" : ""}>
                          {b.winner === p.address && "👑 "}
                          {p.name}
                        </span>
                        <span className={`font-mono font-bold ${(b.returns[p.address] ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                          {b.returns[p.address] !== undefined ? pct(b.returns[p.address], 2) : "-"}
                        </span>
                      </div>
                    ) : (
                      <p key={i} className="text-sm text-muted">
                        Waiting for opponent...
                      </p>
                    )
                  )}
                  <p className="mt-1 text-right font-display text-xs text-sky">Watch →</p>
                </Link>
              ))}
              <div>
                <h3 className="mb-2 font-display text-base">On-chain results</h3>
                <ul className="space-y-1.5 text-sm">
                  {records.map((r: BattleRecord, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="font-extrabold text-[#b07800]">{nameOf(r.winner)}</span> beat {nameOf(r.loser)}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{ago(r.timestamp)}</span>
                    </li>
                  ))}
                  {records.length === 0 && <li className="text-muted">Nothing settled yet.</li>}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Live price of the coin last picked on the trade page, if this player has unlocked it. */
export function AssetTicker({ townHall }: { townHall: number }) {
  const [selected] = useSelectedAsset();
  const asset = isAsset(selected) && unlockedAssets(townHall).includes(selected) ? selected : "BTC";
  const last = useLatestPrice(asset);
  const market = useMarket(asset);
  const change = last && market?.open24h ? ((last - market.open24h) / market.open24h) * 100 : null;
  return (
    <Link href="/trade" className="hud-pill pointer-events-auto flex items-center gap-2.5 py-1 pl-1 pr-4" title={`Live ${asset}-USD (Coinbase)`}>
      <AssetCoin asset={asset} size={28} />
      <span className="clash-text font-display text-base">{last ? fmtPrice(last) : "..."}</span>
      {change !== null && (
        <span className={`clash-text font-display text-sm ${change >= 0 ? "text-[#9ae03f]" : "text-[#ff7552]"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
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
        className={`pointer-events-auto gap-1 px-3 py-1 text-xs ${session.active ? "btn-gold" : "btn-ghost"}`}
      >
        <Zap size={13} strokeWidth={3} className={session.active ? "fill-white" : ""} /> Fast mode {session.active ? "on" : "off"}
      </button>
      {open && (
        <ClashModal title="Fast Mode" onClose={() => setOpen(false)}>
          <div className="space-y-4 text-sm">
            <p>
              Fast mode creates a temporary game key in this browser and authorizes it on-chain for 7 days. Battles, upgrades and
              gold collection then happen instantly, with no wallet pop-ups.
            </p>
            <p className="text-muted">
              It can only play MONARCH as you; it can&apos;t move your funds. Enabling sends {SESSION_FUNDING} MON to the key for gas.
            </p>
            {session.active && (
              <p className="font-mono text-xs text-muted">
                Key {session.account && shortAddr(session.account.address)} · {session.keyBalance.toFixed(4)} MON for gas
                {!session.canPayGas && (
                  <span className="text-[#b07800]"> (low - transactions use your wallet; turn off and on to refill)</span>
                )}
              </p>
            )}
            {error && (
              <p className="text-down">
                {error}{" "}
                {error.includes("faucet") && (
                  <a className="underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
                    Open faucet
                  </a>
                )}
              </p>
            )}
            <button className={`w-full ${session.active ? "btn-ghost" : "btn-gold"}`} disabled={busy} onClick={toggle}>
              {busy ? "Confirm in wallet..." : session.active ? "Turn off fast mode" : <><Zap size={16} /> Enable fast mode</>}
            </button>
          </div>
        </ClashModal>
      )}
    </>
  );
}
