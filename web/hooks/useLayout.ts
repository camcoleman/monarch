"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LAYOUT, type Cell, type Layout } from "@/components/base/World";

/** Building positions are cosmetic, so they live in this browser rather than on-chain. */
const key = (address: string) => `monarch:layout:v2:${address.toLowerCase()}`;
/** Largest top-left cell for the smallest building footprint (3x3) on the 30x30 build grid. */
const MAX_CELL = 27;

function load(address: string): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(key(address)) ?? "null") as Layout | null;
    if (!raw || typeof raw !== "object") return DEFAULT_LAYOUT;
    const out: Layout = { ...DEFAULT_LAYOUT };
    for (const id of Object.keys(DEFAULT_LAYOUT).map(Number)) {
      const c = raw[id];
      const inField = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_CELL;
      if (c && inField(c.ci) && inField(c.cj)) out[id] = { ci: c.ci, cj: c.cj };
    }
    return out;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useLayout(address: string) {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  useEffect(() => setLayout(load(address)), [address]);

  const move = useCallback(
    (id: number, cell: Cell) =>
      setLayout((prev) => {
        const next = { ...prev, [id]: cell };
        localStorage.setItem(key(address), JSON.stringify(next));
        return next;
      }),
    [address]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(key(address));
    setLayout(DEFAULT_LAYOUT);
  }, [address]);

  return { layout, move, reset };
}
