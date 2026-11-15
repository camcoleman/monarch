"use client";

import { useSyncExternalStore } from "react";
import { getSocket } from "./socket";

const GUEST_KEY = "monarch:guest";

function readGuest(): string | null {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(GUEST_KEY);
}

/** Starts an off-chain practice battle against the bot. Guests get an id kept for this tab. */
export async function startPractice(address?: string): Promise<string> {
  const res = await getSocket()
    .timeout(10_000)
    .emitWithAck("battle:practice", { address, guestId: address ? undefined : readGuest() ?? undefined });
  if (!res.ok) throw new Error(res.error);
  if (!address) window.sessionStorage.setItem(GUEST_KEY, res.playerId);
  return res.battleId;
}

/** This tab's guest id from an earlier practice battle, if any. */
export function useGuestId(): string | null {
  return useSyncExternalStore(
    () => () => {},
    readGuest,
    () => null
  );
}
