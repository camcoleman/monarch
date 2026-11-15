import { defineChain } from "viem";

export { monarchAbi } from "./abi";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const FAUCET_URL = "https://faucet.monad.xyz";

export const PAPER_START_BALANCE = 10_000;
export const TRADE_MAX_LEVERAGE = 10;
export const BATTLE_COLLATERAL = 1_000;
/** Mech Bay level 5 allows 6x. */
export const ARENA_MAX_LEVERAGE = 6;

export const STARTING_GOLD = 200;
export const GOLD_PER_WIN = 100;
export const TROPHIES_PER_WIN = 25;
export const TROPHIES_PER_LOSS = 10;
export const LOOT_PCT = 10;
export const STARTING_LAND = 4;
export const MAX_LAND = 25;

export const MAX_BUILDING_LEVEL = 5;
export const EXTRACTOR_BONUS_PER_LEVEL = 20;
export const VAULT_BONUS_PER_LEVEL = 5;
export const EXTRACTOR_RATE_PER_LEVEL = 2; // gold per minute
export const EXTRACTOR_CAP_PER_LEVEL = 150;

export const goldPerWin = (extractorLevel: number) =>
  GOLD_PER_WIN + EXTRACTOR_BONUS_PER_LEVEL * Math.max(0, extractorLevel - 1);
export const trophiesPerWin = (vaultLevel: number) =>
  TROPHIES_PER_WIN + VAULT_BONUS_PER_LEVEL * Math.max(0, vaultLevel - 1);
export const maxLeverage = (mechBayLevel: number) => Math.max(1, mechBayLevel + 1);
export const extractorRate = (level: number) => EXTRACTOR_RATE_PER_LEVEL * level;
export const extractorCap = (level: number) => EXTRACTOR_CAP_PER_LEVEL * level;

/** Index is the on-chain building ID. Upgrade cost to level N is baseCost * N. */
export const BUILDINGS = [
  {
    id: 0,
    key: "commandcenter",
    name: "Command Center",
    baseCost: 100,
    effect: (lv: number) => `Max building level ${lv}`,
    description: "The heart of your base. No other building can be upgraded past its level.",
  },
  {
    id: 1,
    key: "extractor",
    name: "Gold Extractor",
    baseCost: 60,
    effect: (lv: number) => `${extractorRate(lv)} gold/min · +${goldPerWin(lv) - GOLD_PER_WIN} gold per win`,
    description: "Mines gold over time (tap to collect) and boosts every victory's reward.",
  },
  {
    id: 2,
    key: "mechbay",
    name: "Mech Bay",
    baseCost: 50,
    effect: (lv: number) => `Up to ${maxLeverage(lv)}x leverage in battle`,
    description: "Builds your war machines. Higher levels unlock more battle leverage.",
  },
  {
    id: 3,
    key: "trophyvault",
    name: "Trophy Vault",
    baseCost: 80,
    effect: (lv: number) => `${trophiesPerWin(lv)} trophies per win`,
    description: "Stores your glory. Each level adds trophies to every victory.",
  },
] as const;

export type BuildingInfo = (typeof BUILDINGS)[number];

export const upgradeCost = (buildingId: number, currentLevel: number) =>
  BUILDINGS[buildingId].baseCost * (currentLevel + 1);

export const LEAGUES = [
  { name: "Bronze", min: 0, color: "#d97706" },
  { name: "Silver", min: 100, color: "#cbd5e1" },
  { name: "Gold", min: 250, color: "#fbbf24" },
  { name: "Crystal", min: 500, color: "#a78bfa" },
  { name: "Titan", min: 1000, color: "#22d3ee" },
  { name: "Monarch", min: 2000, color: "#f472b6" },
] as const;

export type League = (typeof LEAGUES)[number];

export function leagueFor(trophies: number): { league: League; next: League | null } {
  let i = 0;
  while (i + 1 < LEAGUES.length && trophies >= LEAGUES[i + 1].min) i++;
  return { league: LEAGUES[i], next: LEAGUES[i + 1] ?? null };
}

export type Side = "long" | "short";

/** Leveraged return in percent, floored at -100 (liquidation). */
export function computeReturnPct(side: Side, leverage: number, entry: number, price: number): number {
  const dir = side === "long" ? 1 : -1;
  const pct = ((dir * leverage * (price - entry)) / entry) * 100;
  return Math.max(-100, pct);
}

export interface PriceTick {
  p: number;
  t: number;
}

/** Rolling 24h BTC-USD market stats. */
export interface MarketStats {
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface PlayerRef {
  address: string;
  name: string;
}

export interface Pick {
  side: Side;
  leverage: number;
}

export type BattlePhase = "lobby" | "picking" | "live" | "ended";

export interface BattleView {
  id: string;
  onchainId: string;
  /** "match" came from Attack matchmaking; "challenge" was a direct invite. */
  mode: "match" | "challenge";
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  /** If set, only this address may accept the challenge. */
  requiredOpponent: string | null;
  /** Leverage cap per player, from their Mech Bay. */
  maxLeverage: Record<string, number>;
  picked: Record<string, boolean>;
  /** Only revealed once the round is live. */
  picks: Record<string, Pick> | null;
  entryPrice: number | null;
  lastPrice: number | null;
  pickEndsAt: number | null;
  endsAt: number | null;
  returns: Record<string, number>;
  winner: string | null;
  txHash: string | null;
  settleError: string | null;
}

/** Compact battle info for the live feed. */
export interface BattleSummary {
  id: string;
  mode: BattleView["mode"];
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  requiredOpponent: string | null;
  endsAt: number | null;
  returns: Record<string, number>;
  winner: string | null;
}

export interface BattleTick {
  battleId: string;
  price: number;
  t: number;
  returns: Record<string, number>;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** How long a signed timestamped request stays valid. */
export const SIGNATURE_TTL_MS = 5 * 60_000;

/**
 * Messages players sign so the referee knows each action is really theirs.
 * They can be signed by the wallet itself or by its on-chain session key.
 */
export const signedMessage = {
  findMatch: (timestamp: number) => `MONARCH: find a match\nat:${timestamp}`,
  challenge: (target: string | null, timestamp: number) =>
    `MONARCH: issue a challenge\nto:${target ? target.toLowerCase() : "anyone"}\nat:${timestamp}`,
  join: (battleId: string) => `MONARCH: accept battle\nbattle:${battleId}`,
  pick: (battleId: string, side: Side, leverage: number) =>
    `MONARCH: lock in ${side} ${leverage}x\nbattle:${battleId}`,
};

interface Signed {
  address: string;
  signature: string;
}

export interface FindMatchPayload extends Signed {
  timestamp: number;
}

export interface ChallengePayload extends Signed {
  /** Opponent address, or null for an open invite link. */
  target: string | null;
  timestamp: number;
}

export interface JoinBattlePayload extends Signed {
  battleId: string;
}

export interface PickPayload extends Signed {
  battleId: string;
  side: Side;
  leverage: number;
}

export interface ClientToServerEvents {
  "match:find": (p: FindMatchPayload, ack: (r: Ack<{ battleId: string | null }>) => void) => void;
  "match:cancel": (p: { address: string }, ack: (r: Ack) => void) => void;
  "battle:challenge": (p: ChallengePayload, ack: (r: Ack<{ battleId: string }>) => void) => void;
  "battle:watch": (p: { battleId: string }, ack: (r: Ack<{ battle: BattleView }>) => void) => void;
  "battle:join": (p: JoinBattlePayload, ack: (r: Ack) => void) => void;
  "battle:pick": (p: PickPayload, ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  price: (tick: PriceTick) => void;
  "price:history": (ticks: PriceTick[]) => void;
  market: (stats: MarketStats) => void;
  "battle:state": (battle: BattleView) => void;
  "battle:tick": (tick: BattleTick) => void;
  /** Every battle that is open, in progress, or recently ended. */
  "battles:live": (battles: BattleSummary[]) => void;
  /** Matchmaking paired this socket's player into a battle. */
  "match:found": (p: { battleId: string }) => void;
  "match:queue": (p: { searching: number }) => void;
  /** A settlement landed on-chain; clients should refetch contract reads. */
  "chain:updated": () => void;
}
