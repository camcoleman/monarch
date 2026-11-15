"use client";

import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { monadTestnet, monarchAbi } from "@monarch/shared";
import { MONARCH_ADDRESS } from "@/lib/config";

export interface PlayerData {
  address: string;
  name: string;
  trophies: number;
  gold: number;
  wins: number;
  losses: number;
  statesOwned: number;
}

const base = { address: MONARCH_ADDRESS, abi: monarchAbi, chainId: monadTestnet.id } as const;

export function usePlayer(address?: string) {
  const query = useReadContract({
    ...base,
    functionName: "players",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(MONARCH_ADDRESS && address), refetchInterval: 10_000 },
  });
  const player = useMemo<PlayerData | null>(() => {
    if (!query.data || !address) return null;
    const [name, trophies, gold, wins, losses, statesOwned, exists] = query.data;
    return exists ? { address: address.toLowerCase(), name, trophies, gold, wins, losses, statesOwned } : null;
  }, [query.data, address]);
  return { player, isLoading: query.isLoading, refetch: query.refetch };
}

export function useMe() {
  const { address, isConnected } = useAccount();
  const { player, isLoading, refetch } = usePlayer(address);
  return { address: address?.toLowerCase(), isConnected, player, isLoading, refetch };
}

/** Owner address (lowercase) per state ID, null when neutral. */
export function useStateOwners() {
  const query = useReadContract({
    ...base,
    functionName: "getStates",
    query: { enabled: Boolean(MONARCH_ADDRESS), refetchInterval: 5_000 },
  });
  const owners = useMemo(
    () =>
      (query.data ?? []).map((a) => (/^0x0+$/.test(a) ? null : a.toLowerCase())) as (string | null)[],
    [query.data]
  );
  return { owners, isLoading: query.isLoading };
}

export function usePlayers() {
  const query = useReadContract({
    ...base,
    functionName: "getPlayers",
    query: { enabled: Boolean(MONARCH_ADDRESS), refetchInterval: 10_000 },
  });
  const players = useMemo<PlayerData[]>(() => {
    if (!query.data) return [];
    const [addrs, data] = query.data;
    return addrs.map((a, i) => ({
      address: a.toLowerCase(),
      name: data[i].name,
      trophies: data[i].trophies,
      gold: data[i].gold,
      wins: data[i].wins,
      losses: data[i].losses,
      statesOwned: data[i].statesOwned,
    }));
  }, [query.data]);
  const byAddress = useMemo(() => new Map(players.map((p) => [p.address, p])), [players]);
  return { players, byAddress, isLoading: query.isLoading };
}
