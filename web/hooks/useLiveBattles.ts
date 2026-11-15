"use client";

import { useSyncExternalStore } from "react";
import type { BattleSummary, MarketStats } from "@monarch/shared";
import { getSocket } from "@/lib/socket";

let battles: BattleSummary[] = [];
let searching = 0;
let market: MarketStats | null = null;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  if (!started) {
    started = true;
    const socket = getSocket();
    socket.on("battles:live", (b) => {
      battles = b;
      notify();
    });
    socket.on("match:queue", (q) => {
      searching = q.searching;
      notify();
    });
    socket.on("market", (m) => {
      market = m;
      notify();
    });
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: BattleSummary[] = [];

/** Battles that are open, running, or just ended on the referee. */
export function useLiveBattles(): BattleSummary[] {
  return useSyncExternalStore(subscribe, () => battles, () => EMPTY);
}

/** Players currently waiting in matchmaking. */
export function useSearchingCount(): number {
  return useSyncExternalStore(subscribe, () => searching, () => 0);
}

/** Rolling 24h BTC-USD stats. */
export function useMarket(): MarketStats | null {
  return useSyncExternalStore(subscribe, () => market, () => null);
}
