"use client";

import { useMemo } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { extractorCap, extractorRate, monadTestnet, monarchAbi } from "@monarch/shared";
import { MONARCH_ADDRESS } from "@/lib/config";

export interface PlayerData {
  address: string;
  name: string;
  trophies: number;
  gold: number;
  wins: number;
  losses: number;
  land: number;
  /** Unix seconds of the last Gold Mine collection. */
  lastCollect: number;
}

export interface BattleRecord {
  winner: string;
  loser: string;
  winnerBps: number;
  loserBps: number;
  timestamp: number;
  loot: number;
}

const base = { address: MONARCH_ADDRESS, abi: monarchAbi, chainId: monadTestnet.id } as const;
const enabled = Boolean(MONARCH_ADDRESS);

export function usePlayer(address?: string) {
  const query = useReadContract({
    ...base,
    functionName: "players",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: enabled && Boolean(address), refetchInterval: 10_000 },
  });
  const player = useMemo<PlayerData | null>(() => {
    if (!query.data || !address) return null;
    const [name, trophies, gold, wins, losses, land, lastCollect, exists] = query.data;
    return exists
      ? { address: address.toLowerCase(), name, trophies, gold, wins, losses, land, lastCollect: Number(lastCollect) }
      : null;
  }, [query.data, address]);
  return { player, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

/** Building levels indexed by building ID (Town Hall, Gold Mine, Barracks, Trophy Hall). */
export function useBuildings(address?: string) {
  const query = useReadContract({
    ...base,
    functionName: "getBuildings",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: enabled && Boolean(address), refetchInterval: 10_000 },
  });
  const levels = useMemo(() => (query.data ? [...query.data] : null), [query.data]);
  return { levels, refetch: query.refetch };
}

/** Uncollected Gold Mine gold, ticking up locally between chain reads. */
export function pendingGold(player: PlayerData | null, extractorLevel: number, nowMs: number) {
  if (!player) return 0;
  const minutes = Math.max(0, nowMs / 1000 - player.lastCollect) / 60;
  return Math.min(extractorCap(extractorLevel), Math.floor(minutes * extractorRate(extractorLevel)));
}

export function useMe() {
  const { address, isConnected } = useAccount();
  const { player, isLoading, isError, refetch } = usePlayer(address);
  return { address: address?.toLowerCase(), isConnected, player, isLoading, isError, refetch };
}

export function useMonBalance(address?: string) {
  const q = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: monadTestnet.id,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  return { value: q.data ? Number(q.data.value) / 1e18 : null, refetch: q.refetch };
}

function toRecords(data: readonly { winner: string; loser: string; winnerBps: number; loserBps: number; timestamp: bigint; loot: number }[] | undefined) {
  return (data ?? []).map<BattleRecord>((r) => ({
    winner: r.winner.toLowerCase(),
    loser: r.loser.toLowerCase(),
    winnerBps: r.winnerBps,
    loserBps: r.loserBps,
    timestamp: Number(r.timestamp),
    loot: r.loot,
  }));
}

export function useHistory(address?: string, limit = 25) {
  const query = useReadContract({
    ...base,
    functionName: "getHistory",
    args: address ? [address as `0x${string}`, BigInt(limit)] : undefined,
    query: { enabled: enabled && Boolean(address), refetchInterval: 10_000 },
  });
  const records = useMemo(() => toRecords(query.data), [query.data]);
  return { records, isLoading: query.isLoading };
}

export function useRecentBattles(limit = 10) {
  const query = useReadContract({
    ...base,
    functionName: "getRecentBattles",
    args: [BigInt(limit)],
    query: { enabled, refetchInterval: 8_000 },
  });
  const records = useMemo(() => toRecords(query.data), [query.data]);
  return { records };
}

export function usePlayers() {
  const query = useReadContract({
    ...base,
    functionName: "getPlayers",
    query: { enabled, refetchInterval: 10_000 },
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
      land: data[i].land,
      lastCollect: Number(data[i].lastCollect),
    }));
  }, [query.data]);
  const byAddress = useMemo(() => new Map(players.map((p) => [p.address, p])), [players]);
  return { players, byAddress, isLoading: query.isLoading };
}
