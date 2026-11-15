"use client";

import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ASSETS,
  DEFAULT_ASSET,
  PAPER_START_BALANCE,
  TRADE_MAX_LEVERAGE,
  assetInfo,
  computeReturnPct,
  unlockedAssets,
  type AssetId,
  type Side,
} from "@monarch/shared";
import { LineChart, type ChartLine } from "@/components/LineChart";
import { AssetCoin } from "@/components/base/ui";
import { useBuildings, useMe } from "@/hooks/useMonarch";
import { useMarket } from "@/hooks/useLiveBattles";
import { price as fmtPrice, pct, signedUsd, usd } from "@/lib/format";
import { useLatestPrice, usePriceHistory, useSelectedAsset } from "@/lib/priceStore";

interface Position {
  asset: AssetId;
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

/** Accounts saved before multi-asset trading have no asset on their positions. */
function loadAccount(raw: string | null): Account {
  if (!raw) return freshAccount();
  const a = JSON.parse(raw) as Account;
  return {
    ...a,
    position: a.position ? { ...a.position, asset: a.position.asset ?? DEFAULT_ASSET } : null,
    history: a.history.map((t) => ({ ...t, asset: t.asset ?? DEFAULT_ASSET })),
  };
}

function positionPnl(p: Position, price: number) {
  return (p.margin * computeReturnPct(p.side, p.leverage, p.entry, price)) / 100;
}

function liquidationPrice(p: Position) {
  return p.side === "long" ? p.entry * (1 - 1 / p.leverage) : p.entry * (1 + 1 / p.leverage);
}

export default function TradePage() {
  const { address, player } = useMe();
  const { levels } = useBuildings(player ? address : undefined);
  const unlocked = unlockedAssets(levels?.[0] ?? 1);
  const [selected, setSelected] = useSelectedAsset();
  const asset = unlocked.includes(selected) ? selected : DEFAULT_ASSET;

  const storageKey = `monarch:paper:${address ?? "guest"}`;
  const history = usePriceHistory(asset);
  const price = history.at(-1)?.p ?? null;
  const market = useMarket(asset);

  const [account, setAccount] = useState<Account>(freshAccount);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [margin, setMargin] = useState(1000);
  const [leverage, setLeverage] = useState(3);

  useEffect(() => {
    setAccount(loadAccount(localStorage.getItem(storageKey)));
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey === storageKey) localStorage.setItem(storageKey, JSON.stringify(account));
  }, [account, loadedKey, storageKey]);

  const position = account.position;
  const positionPrice = useLatestPrice(position?.asset ?? DEFAULT_ASSET);
  const pnl = position && positionPrice ? positionPnl(position, positionPrice) : 0;
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
    if (position && positionPrice && positionPnl(position, positionPrice) <= -position.margin) close(positionPrice, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionPrice]);

  const open = (side: Side) => {
    if (!price || margin <= 0 || margin > account.balance) return;
    setAccount((a) => ({
      ...a,
      balance: a.balance - margin,
      position: { asset, side, leverage, margin, entry: price, openedAt: Date.now() },
    }));
  };

  const points = useMemo(() => history.map((h) => ({ t: h.t, v: h.p })), [history]);
  const lines: ChartLine[] =
    position && position.asset === asset
      ? [
          { price: position.entry, color: "#e59b07", title: "Entry" },
          { price: liquidationPrice(position), color: "#d6362a", title: "Liq" },
        ]
      : [];
  const change = price && market?.open24h ? ((price - market.open24h) / market.open24h) * 100 : null;
  const info = assetInfo(asset);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <span className="mr-1 font-display text-lg">Coins</span>
        {ASSETS.map((a) => {
          const open = unlocked.includes(a.id);
          return (
            <button
              key={a.id}
              disabled={!open}
              onClick={() => setSelected(a.id)}
              title={open ? a.name : `Unlocks at Town Hall ${a.unlock}`}
              className={`relative flex items-center gap-1.5 rounded-xl border-[3px] py-1 pl-1 pr-3 font-display transition ${
                asset === a.id ? "border-[#1d1206] bg-[#fff3a0] shadow-[0_3px_0_#1d1206]" : "border-[#c9ac6c] bg-[#efdfb8]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <AssetCoin asset={a.id} size={30} locked={!open} />
              {open ? a.id : <span className="flex items-center gap-1 text-sm"><Lock size={13} strokeWidth={3} /> TH {a.unlock}</span>}
            </button>
          );
        })}
        <span className="ml-auto text-xs font-bold text-muted">Upgrade your Town Hall to unlock more coins</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-3">
              <AssetCoin asset={asset} size={48} />
              <div>
                <p className="text-sm font-extrabold text-muted">
                  {info.name} · {asset} / USD
                </p>
                <p className="font-display text-4xl">{price ? fmtPrice(price) : "Waiting for price feed..."}</p>
              </div>
            </div>
            <div className="text-right">
              {change !== null && (
                <p className={`font-display text-lg ${change >= 0 ? "text-up" : "text-down"}`}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% 24h
                </p>
              )}
              <p className="text-xs font-bold text-muted">Paper trading · live Coinbase prices</p>
            </div>
          </div>
          <LineChart points={points} lines={lines} height={380} color={info.color} precision={price && price < 1 ? 5 : 2} />
        </section>

        <aside className="space-y-4">
          <div className="panel space-y-1 p-5">
            <p className="text-sm font-extrabold text-muted">Equity</p>
            <p className="font-display text-4xl">{usd(equity)}</p>
            <p className="text-sm font-bold text-muted">Available: {usd(account.balance)}</p>
          </div>

          {position ? (
            <div className="panel space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 font-display text-lg ${position.side === "long" ? "text-up" : "text-down"}`}>
                  <AssetCoin asset={position.asset} size={26} />
                  {position.side === "long" ? "▲ Long" : "▼ Short"} {position.asset} · {position.leverage}x
                </span>
                <span className="text-sm font-bold text-muted">Margin {usd(position.margin)}</span>
              </div>
              <div className={`font-display text-3xl ${pnl >= 0 ? "text-up" : "text-down"}`}>
                {signedUsd(pnl)}{" "}
                <span className="text-lg">
                  ({pct(positionPrice ? computeReturnPct(position.side, position.leverage, position.entry, positionPrice) : 0)})
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-1 text-sm font-bold text-muted">
                <dt>Entry</dt>
                <dd className="text-right font-mono text-ink">{fmtPrice(position.entry)}</dd>
                <dt>Liquidation</dt>
                <dd className="text-right font-mono text-ink">{fmtPrice(liquidationPrice(position))}</dd>
              </dl>
              <button className="btn-gold w-full text-lg" disabled={!positionPrice} onClick={() => positionPrice && close(positionPrice)}>
                Close position
              </button>
            </div>
          ) : (
            <div className="panel space-y-4 p-5">
              <label className="block space-y-1">
                <span className="text-sm font-extrabold text-muted">Margin (USD)</span>
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
                <span className="flex justify-between text-sm font-extrabold text-muted">
                  Leverage <span className="font-display text-lg text-ink">{leverage}x</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={TRADE_MAX_LEVERAGE}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-[#e59b07]"
                />
              </label>
              <p className="text-xs font-bold text-muted">Position size: {usd(margin * leverage)}</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-green text-lg" disabled={!price || margin <= 0 || margin > account.balance} onClick={() => open("long")}>
                  ▲ Long
                </button>
                <button className="btn-red text-lg" disabled={!price || margin <= 0 || margin > account.balance} onClick={() => open("short")}>
                  ▼ Short
                </button>
              </div>
            </div>
          )}

          <div className="panel p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-lg">Recent trades</h3>
              <button className="text-xs font-bold text-muted hover:text-ink" onClick={() => setAccount(freshAccount())}>
                Reset to {usd(PAPER_START_BALANCE, 0)}
              </button>
            </div>
            {account.history.length === 0 ? (
              <p className="text-sm text-muted">No trades yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {account.history.map((t) => (
                  <li key={t.closedAt} className="flex justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-muted">
                      <AssetCoin asset={t.asset} size={18} />
                      {t.side.toUpperCase()} {t.leverage}x{t.liquidated && <span className="text-down"> · liquidated</span>}
                    </span>
                    <span className={`font-mono font-bold ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{signedUsd(t.pnl)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
