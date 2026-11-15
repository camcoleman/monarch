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

/** Index in this array is the on-chain state ID. `fips` matches us-atlas feature IDs. */
export const STATES = [
  { id: 0, code: "CA", name: "California", fips: "06" },
  { id: 1, code: "OR", name: "Oregon", fips: "41" },
  { id: 2, code: "WA", name: "Washington", fips: "53" },
  { id: 3, code: "TX", name: "Texas", fips: "48" },
  { id: 4, code: "FL", name: "Florida", fips: "12" },
  { id: 5, code: "NY", name: "New York", fips: "36" },
  { id: 6, code: "CO", name: "Colorado", fips: "08" },
  { id: 7, code: "IL", name: "Illinois", fips: "17" },
] as const;

export type StateInfo = (typeof STATES)[number];

export const PAPER_START_BALANCE = 10_000;
export const TRADE_MAX_LEVERAGE = 10;
export const BATTLE_COLLATERAL = 1_000;
export const ARENA_MAX_LEVERAGE = 5;
export const TROPHIES_PER_WIN = 25;
export const GOLD_PER_WIN = 100;

export const STARTING_GOLD = 200;
export const MAX_BUILDING_LEVEL = 5;
export const MINE_BONUS_PER_LEVEL = 20;

/** Index is the on-chain building ID. Upgrade cost to level N is baseCost * N. */
export const BUILDINGS = [
  {
    id: 0,
    key: "townhall",
    name: "Town Hall",
    baseCost: 100,
    description: "The heart of your kingdom. Other buildings can't be upgraded past its level.",
  },
  {
    id: 1,
    key: "goldmine",
    name: "Gold Mine",
    baseCost: 60,
    description: `Each level above 1 adds +${MINE_BONUS_PER_LEVEL} gold to every battle victory.`,
  },
  {
    id: 2,
    key: "barracks",
    name: "Barracks",
    baseCost: 50,
    description: "Where your traders train. A symbol of military might.",
  },
  {
    id: 3,
    key: "trophyhall",
    name: "Trophy Hall",
    baseCost: 80,
    description: "Displays your conquests and trophies for all rivals to see.",
  },
] as const;

export type BuildingInfo = (typeof BUILDINGS)[number];

export const upgradeCost = (buildingId: number, currentLevel: number) =>
  BUILDINGS[buildingId].baseCost * (currentLevel + 1);

export const goldPerWin = (mineLevel: number) => GOLD_PER_WIN + MINE_BONUS_PER_LEVEL * Math.max(0, mineLevel - 1);

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
  stateId: number;
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  /** Current ruler of the state when the battle was created, if any. */
  defender: string | null;
  /** If set, only this address may accept the challenge. */
  requiredOpponent: string | null;
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

export interface BattleSummary {
  id: string;
  stateId: number;
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  requiredOpponent: string | null;
}

export interface BattleTick {
  battleId: string;
  price: number;
  t: number;
  returns: Record<string, number>;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** How long a signed create request stays valid. */
export const SIGNATURE_TTL_MS = 5 * 60_000;

/** Messages players sign with their wallet so the referee knows each action is really theirs. */
export const signedMessage = {
  create: (stateId: number, timestamp: number) =>
    `MONARCH: declare war on ${STATES[stateId]?.name ?? stateId}\nstate:${stateId}\nat:${timestamp}`,
  join: (battleId: string) => `MONARCH: accept battle\nbattle:${battleId}`,
  pick: (battleId: string, side: Side, leverage: number) =>
    `MONARCH: lock in ${side} ${leverage}x\nbattle:${battleId}`,
};

export interface CreateBattlePayload {
  stateId: number;
  address: string;
  name: string;
  timestamp: number;
  signature: string;
}

export interface JoinBattlePayload {
  battleId: string;
  address: string;
  name: string;
  signature: string;
}

export interface PickPayload {
  battleId: string;
  address: string;
  side: Side;
  leverage: number;
  signature: string;
}

export interface ClientToServerEvents {
  "battle:create": (p: CreateBattlePayload, ack: (r: Ack<{ battleId: string }>) => void) => void;
  "battle:watch": (p: { battleId: string }, ack: (r: Ack<{ battle: BattleView }>) => void) => void;
  "battle:join": (p: JoinBattlePayload, ack: (r: Ack) => void) => void;
  "battle:pick": (p: PickPayload, ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  price: (tick: PriceTick) => void;
  "price:history": (ticks: PriceTick[]) => void;
  "battle:state": (battle: BattleView) => void;
  "battle:tick": (tick: BattleTick) => void;
  "battles:open": (battles: BattleSummary[]) => void;
  /** A settlement landed on-chain; clients should refetch contract reads. */
  "chain:updated": () => void;
}
