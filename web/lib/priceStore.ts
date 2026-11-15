"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ASSET, isAsset, type AssetId, type AssetPrices, type PriceTick } from "@monarch/shared";
import { getSocket } from "./socket";

const MAX_POINTS = 600;

let history: Partial<Record<AssetId, PriceTick[]>> = {};
let latest: AssetPrices = {};
let connected = false;
let started = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

function start() {
  if (started) return;
  started = true;
  const socket = getSocket();
  socket.on("price:history", (h) => {
    history = {};
    latest = {};
    for (const [asset, ticks] of Object.entries(h)) {
      if (!isAsset(asset) || !ticks?.length) continue;
      history[asset] = ticks.slice(-MAX_POINTS);
      latest[asset] = ticks.at(-1)!.p;
    }
    notify();
  });
  socket.on("prices", (tick) => {
    const next = { ...history };
    for (const [asset, p] of Object.entries(tick.p)) {
      if (!isAsset(asset) || p === undefined) continue;
      next[asset] = [...(history[asset] ?? []).slice(-(MAX_POINTS - 1)), { p, t: tick.t }];
    }
    history = next;
    latest = { ...latest, ...tick.p };
    notify();
  });
  socket.on("connect", () => {
    connected = true;
    notify();
  });
  socket.on("disconnect", () => {
    connected = false;
    notify();
  });
  connected = socket.connected;
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: PriceTick[] = [];
const NO_PRICES: AssetPrices = {};

/** Shared price stream from the referee server for one asset. */
export function usePriceHistory(asset: AssetId = DEFAULT_ASSET): PriceTick[] {
  return useSyncExternalStore(subscribe, () => history[asset] ?? EMPTY, () => EMPTY);
}

export function useLatestPrice(asset: AssetId = DEFAULT_ASSET): number | null {
  return useSyncExternalStore(subscribe, () => latest[asset] ?? null, () => null);
}

export function useLatestPrices(): AssetPrices {
  return useSyncExternalStore(subscribe, () => latest, () => NO_PRICES);
}

export function useServerConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => true);
}

const ASSET_KEY = "monarch:asset";
const assetListeners = new Set<() => void>();

function readAsset(): AssetId {
  const v = typeof window === "undefined" ? null : window.localStorage.getItem(ASSET_KEY);
  return isAsset(v) ? v : DEFAULT_ASSET;
}

/** The coin last chosen on the trade page, shared with the HUD ticker. */
export function useSelectedAsset(): [AssetId, (a: AssetId) => void] {
  const asset = useSyncExternalStore(
    (l) => {
      assetListeners.add(l);
      return () => assetListeners.delete(l);
    },
    readAsset,
    () => DEFAULT_ASSET
  );
  const set = (a: AssetId) => {
    window.localStorage.setItem(ASSET_KEY, a);
    assetListeners.forEach((l) => l());
  };
  return [asset, set];
}
