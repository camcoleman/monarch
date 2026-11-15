"use client";

import { useSyncExternalStore } from "react";
import type { BattleSummary } from "@monarch/shared";
import { getSocket } from "@/lib/socket";

let battles: BattleSummary[] = [];
let started = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  if (!started) {
    started = true;
    getSocket().on("battles:open", (b) => {
      battles = b;
      listeners.forEach((l) => l());
    });
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: BattleSummary[] = [];

export function useOpenBattles(): BattleSummary[] {
  return useSyncExternalStore(subscribe, () => battles, () => EMPTY);
}
