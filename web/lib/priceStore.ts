"use client";

import { useSyncExternalStore } from "react";
import type { PriceTick } from "@monarch/shared";
import { getSocket } from "./socket";

const MAX_POINTS = 600;

let history: PriceTick[] = [];
let connected = false;
let started = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

function start() {
  if (started) return;
  started = true;
  const socket = getSocket();
  socket.on("price:history", (ticks) => {
    history = ticks.slice(-MAX_POINTS);
    notify();
  });
  socket.on("price", (tick) => {
    history = [...history.slice(-(MAX_POINTS - 1)), tick];
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

/** Shared BTC price stream from the referee server. */
export function usePriceHistory(): PriceTick[] {
  return useSyncExternalStore(subscribe, () => history, () => EMPTY);
}

export function useLatestPrice(): number | null {
  const h = usePriceHistory();
  return h.at(-1)?.p ?? null;
}

export function useServerConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => true);
}
