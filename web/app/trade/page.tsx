"use client";

import { useEffect, useMemo, useState } from "react";
import { PAPER_START_BALANCE, TRADE_MAX_LEVERAGE, computeReturnPct, type Side } from "@monarch/shared";
import { LineChart, type ChartLine } from "@/components/LineChart";
import { useMe } from "@/hooks/useMonarch";
import { pct, signedUsd, usd } from "@/lib/format";
import { usePriceHistory } from "@/lib/priceStore";

interface Position {
  side: Side;
  leverage: number;
  margin: number;
  entry: number;
  openedAt: number;
}

interface ClosedTrade extends Position {
  exit: number;
  pnl: number;
  closedAt: number;
  liquidated: boolean;
}

interface Account {
  balance: number;
  position: Position | null;
  history: ClosedTrade[];
}

const freshAccount = (): Account => ({ balance: PAPER_START_BALANCE, position: null, history: [] });

function positionPnl(p: Position, price: number) {
  return (p.margin * computeReturnPct(p.side, p.leverage, p.entry, price)) / 100;
}

function liquidationPrice(p: Position) {
  return p.side === "long" ? p.entry * (1 - 1 / p.leverage) : p.entry * (1 + 1 / p.leverage);
}

export default function TradePage() {
  const { address } = useMe();
  const storageKey = `monarch:paper:${address ?? "guest"}`;
  const history = usePriceHistory();
  const price = history.at(-1)?.p ?? null;

  const [account, setAccount] = useState<Account>(freshAccount);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [margin, setMargin] = useState(1000);
  const [leverage, setLeverage] = useState(3);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setAccount(saved ? (JSON.parse(saved) as Account) : freshAccount());
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey === storageKey) localStorage.setItem(storageKey, JSON.stringify(account));
  }, [account, loadedKey, storageKey]);

  const position = account.position;
  const pnl = position && price ? positionPnl(position, price) : 0;
  const equity = account.balance + (position ? position.margin + pnl : 0);

  const close = (exit: number, liquidated = false) =>
    setAccount((a) => {
      if (!a.position) return a;
      const realized = Math.max(-a.position.margin, positionPnl(a.position, exit));
      const trade: ClosedTrade = { ...a.position, exit, pnl: realized, closedAt: Date.now(), liquidated };
      return {
        balance: a.balance + a.position.margin + realized,
        position: null,
        history: [trade, ...a.history].slice(0, 20),
      };
    });

  useEffect(() => {
    if (position && price && positionPnl(position, price) <= -position.margin) close(price, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  const open = (side: Side) => {
    if (!price || margin <= 0 || margin > account.balance) return;
    setAccount((a) => ({
      ...a,
      balance: a.balance - margin,
      position: { side, leverage, margin, entry: price, openedAt: Date.now() },
    }));
  };

  const points = useMemo(() => history.map((h) => ({ t: h.t, v: h.p })), [history]);
  const lines: ChartLine[] = position
    ? [
        { price: position.entry, color: "#f5b301", title: "Entry" },
        { price: liquidationPrice(position), color: "#ef4444", title: "Liq" },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="panel p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-400">BTC / USD</p>
            <p className="font-mono text-3xl">{price ? usd(price) : "Waiting for price feed..."}</p>
          </div>
          <p className="text-xs text-zinc-500">Paper trading · live Coinbase prices</p>
        </div>
        <LineChart points={points} lines={lines} height={380} />
      </section>

      <aside className="space-y-4">
        <div className="panel space-y-1 p-5">
          <p className="text-sm text-zinc-400">Equity</p>
          <p className="font-mono text-3xl">{usd(equity)}</p>
          <p className="text-sm text-zinc-500">Available: {usd(account.balance)}</p>
        </div>

        {position ? (
          <div className="panel space-y-3 p-5">
            <div className="flex items-center justify-between">
              <span className={`font-bold uppercase ${position.side === "long" ? "text-up" : "text-down"}`}>
                {position.side} · {position.leverage}x
              </span>
              <span className="text-sm text-zinc-400">Margin {usd(position.margin)}</span>
            </div>
            <div className={`font-mono text-3xl ${pnl >= 0 ? "text-up" : "text-down"}`}>
              {signedUsd(pnl)}{" "}
              <span className="text-lg">({pct(price ? computeReturnPct(position.side, position.leverage, position.entry, price) : 0)})</span>
            </div>
            <dl className="grid grid-cols-2 gap-1 text-sm text-zinc-400">
              <dt>Entry</dt>
              <dd className="text-right font-mono text-zinc-200">{usd(position.entry)}</dd>
              <dt>Liquidation</dt>
              <dd className="text-right font-mono text-zinc-200">{usd(liquidationPrice(position))}</dd>
            </dl>
            <button className="btn-gold w-full" disabled={!price} onClick={() => price && close(price)}>
              Close position
            </button>
          </div>
        ) : (
          <div className="panel space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-sm text-zinc-400">Margin (USD)</span>
              <input
                type="number"
                className="input w-full font-mono"
                min={1}
                max={account.balance}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between text-sm text-zinc-400">
                Leverage <span className="font-mono text-gold">{leverage}x</span>
              </span>
              <input
                type="range"
                min={1}
                max={TRADE_MAX_LEVERAGE}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-[#f5b301]"
              />
            </label>
            <p className="text-xs text-zinc-500">Position size: {usd(margin * leverage)}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn bg-up text-ink hover:brightness-110"
                disabled={!price || margin <= 0 || margin > account.balance}
                onClick={() => open("long")}
              >
                Long
              </button>
              <button
                className="btn bg-down text-white hover:brightness-110"
                disabled={!price || margin <= 0 || margin > account.balance}
                onClick={() => open("short")}
              >
                Short
              </button>
            </div>
          </div>
        )}

        <div className="panel p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Recent trades</h3>
            <button className="text-xs text-zinc-500 hover:text-gold" onClick={() => setAccount(freshAccount())}>
              Reset to {usd(PAPER_START_BALANCE, 0)}
            </button>
          </div>
          {account.history.length === 0 ? (
            <p className="text-sm text-zinc-500">No trades yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {account.history.map((t) => (
                <li key={t.closedAt} className="flex justify-between">
                  <span className="text-zinc-400">
                    {t.side.toUpperCase()} {t.leverage}x{t.liquidated && <span className="text-down"> · liquidated</span>}
                  </span>
                  <span className={`font-mono ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{signedUsd(t.pnl)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
