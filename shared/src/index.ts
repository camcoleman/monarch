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
/** Default live round length; the server can override it with ROUND_SECONDS. */
export const ROUND_SECONDS = 30;
/** Barracks level 5 allows 6x. */
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

/** Tradable coins. Each Town Hall level unlocks the asset with that `unlock` level. */
export const ASSETS = [
  { id: "BTC", name: "Bitcoin", product: "BTC-USD", color: "#f7931a", unlock: 1, mockStart: 97_000 },
  { id: "ETH", name: "Ethereum", product: "ETH-USD", color: "#627eea", unlock: 2, mockStart: 3_400 },
  { id: "SOL", name: "Solana", product: "SOL-USD", color: "#14c38e", unlock: 3, mockStart: 180 },
  { id: "DOGE", name: "Dogecoin", product: "DOGE-USD", color: "#c2a633", unlock: 4, mockStart: 0.2 },
  { id: "MON", name: "Monad", product: "MON-USD", color: "#836ef9", unlock: 5, mockStart: 0.03 },
] as const;

export type AssetId = (typeof ASSETS)[number]["id"];
export type AssetInfo = (typeof ASSETS)[number];
export type AssetPrices = Partial<Record<AssetId, number>>;

export const ASSET_IDS: AssetId[] = ASSETS.map((a) => a.id);
export const DEFAULT_ASSET: AssetId = "BTC";

export const assetInfo = (id: AssetId): AssetInfo => ASSETS.find((a) => a.id === id) ?? ASSETS[0];
export const isAsset = (x: unknown): x is AssetId => typeof x === "string" && (ASSET_IDS as string[]).includes(x);
export const unlockedAssets = (townHallLevel: number): AssetId[] =>
  ASSETS.filter((a) => a.unlock <= Math.max(1, townHallLevel)).map((a) => a.id);

/** Index is the on-chain building ID. Upgrade cost to level N is baseCost * N. */
export const BUILDINGS = [
  {
    id: 0,
    key: "townhall",
    name: "Town Hall",
    baseCost: 100,
    effect: (lv: number) =>
      `Max building level ${lv} · trade ${unlockedAssets(lv).join(", ")}`,
    description: "The heart of your village. Caps every other building's level, and each level unlocks a new coin to trade.",
  },
  {
    id: 1,
    key: "goldmine",
    name: "Gold Mine",
    baseCost: 60,
    effect: (lv: number) => `${extractorRate(lv)} gold/min · +${goldPerWin(lv) - GOLD_PER_WIN} gold per win`,
    description: "Mines gold over time (tap to collect) and boosts every victory's reward.",
  },
  {
    id: 2,
    key: "barracks",
    name: "Barracks",
    baseCost: 50,
    effect: (lv: number) => `Up to ${maxLeverage(lv)}x leverage in battle`,
    description: "Trains your troops. Higher levels unlock more battle leverage.",
  },
  {
    id: 3,
    key: "trophyhall",
    name: "Trophy Hall",
    baseCost: 80,
    effect: (lv: number) => `${trophiesPerWin(lv)} trophies per win`,
    description: "Shows off your glory. Each level adds trophies to every victory.",
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

/** One referee tick: the latest price of every asset with a live feed. */
export interface PricesTick {
  t: number;
  p: AssetPrices;
}

/** Rolling 24h market stats for one asset. */
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

/** Practice battles are fought against this pseudo-player. */
export const BOT_PLAYER: PlayerRef = { address: "bot", name: "Training Bot" };

export interface Pick {
  asset: AssetId;
  side: Side;
  leverage: number;
}

export type BattlePhase = "lobby" | "picking" | "live" | "ended";

export interface BattleView {
  id: string;
  onchainId: string;
  /** "match" came from Attack matchmaking, "challenge" was a direct invite, "practice" is off-chain vs the bot. */
  mode: "match" | "challenge" | "practice";
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  /** If set, only this address may accept the challenge. */
  requiredOpponent: string | null;
  /** Leverage cap per player, from their Barracks. */
  maxLeverage: Record<string, number>;
  /** Assets each player may trade, from their Town Hall. */
  unlocked: Record<string, AssetId[]>;
  picked: Record<string, boolean>;
  /** Only revealed once the round is live. */
  picks: Record<string, Pick> | null;
  entryPrices: AssetPrices | null;
  lastPrices: AssetPrices | null;
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
  prices: AssetPrices;
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
  pick: (battleId: string, asset: AssetId, side: Side, leverage: number) =>
    `MONARCH: lock in ${side} ${asset} ${leverage}x\nbattle:${battleId}`,
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
  asset: AssetId;
  side: Side;
  leverage: number;
}

export interface PracticePayload {
  /** Connected wallet, if any. Omitted for guests. */
  address?: string;
  /** A guest id from an earlier practice battle, reused so the browser stays "you". */
  guestId?: string;
}

export interface ClientToServerEvents {
  "match:find": (p: FindMatchPayload, ack: (r: Ack<{ battleId: string | null }>) => void) => void;
  "match:cancel": (p: { address: string }, ack: (r: Ack) => void) => void;
  "battle:challenge": (p: ChallengePayload, ack: (r: Ack<{ battleId: string }>) => void) => void;
  "battle:watch": (p: { battleId: string }, ack: (r: Ack<{ battle: BattleView }>) => void) => void;
  "battle:join": (p: JoinBattlePayload, ack: (r: Ack) => void) => void;
  "battle:pick": (p: PickPayload, ack: (r: Ack) => void) => void;
  /** Starts an off-chain practice battle against the bot. No wallet or signature needed. */
  "battle:practice": (p: PracticePayload, ack: (r: Ack<{ battleId: string; playerId: string }>) => void) => void;
}

export interface ServerToClientEvents {
  prices: (tick: PricesTick) => void;
  "price:history": (history: Partial<Record<AssetId, PriceTick[]>>) => void;
  market: (stats: Partial<Record<AssetId, MarketStats>>) => void;
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
