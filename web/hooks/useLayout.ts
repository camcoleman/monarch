"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_LAND } from "@monarch/shared";
import { GRID, type Layout } from "@/components/base/World";

/** Building positions are cosmetic, so they live in this browser rather than on-chain. */
const key = (address: string) => `monarch:layout:v3:${address.toLowerCase()}`;

const onGrid = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < GRID.size;

function load(address: string): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(key(address)) ?? "null") as Layout | null;
    if (!raw || typeof raw !== "object") return {};
    const out: Layout = {};
    for (let p = 0; p < MAX_LAND; p++) {
      const t = raw[p];
      if (t && onGrid(t.i) && onGrid(t.j)) out[p] = { i: t.i, j: t.j };
    }
    return out;
  } catch {
    return {};
  }
}

export function useLayout(address: string) {
  const [layout, setLayout] = useState<Layout>({});
  useEffect(() => setLayout(load(address)), [address]);

  const move = useCallback(
    (changes: Layout) =>
      setLayout((prev) => {
        const next = { ...prev, ...changes };
        localStorage.setItem(key(address), JSON.stringify(next));
        return next;
      }),
    [address]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(key(address));
    setLayout({});
  }, [address]);

  return { layout, move, reset };
}
