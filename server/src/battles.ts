import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { isAddress, keccak256, toHex, type Hex } from "viem";
import {
  ARENA_MAX_LEVERAGE,
  STATES,
  computeReturnPct,
  type Ack,
  type BattlePhase,
  type BattleSummary,
  type BattleView,
  type ClientToServerEvents,
  type Pick,
  type PlayerRef,
  type PriceTick,
  type ServerToClientEvents,
  type Side,
} from "@monarch/shared";
import { errMessage, type Chain } from "./chain";
import type { Config } from "./config";
import type { PriceFeed } from "./priceFeed";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ENDED_TTL_MS = 30 * 60_000;
const LOBBY_TTL_MS = 5 * 60_000;

interface Battle {
  id: string;
  onchainId: Hex;
  stateId: number;
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  defender: string | null;
  requiredOpponent: string | null;
  picks: Record<string, Pick | null>;
  entryPrice: number | null;
  lastPrice: number | null;
  pickEndsAt: number | null;
  endsAt: number | null;
  returns: Record<string, number>;
  winner: string | null;
  txHash: string | null;
  settleError: string | null;
  timer?: NodeJS.Timeout;
}

const room = (id: string) => `battle:${id}`;
const fail = (error: string) => ({ ok: false as const, error });

function player(address: string, name: string): PlayerRef {
  const clean = name.trim().slice(0, 24);
  return { address: address.toLowerCase(), name: clean || `${address.slice(0, 6)}...${address.slice(-4)}` };
}

export class BattleManager {
  private readonly battles = new Map<string, Battle>();

  constructor(
    private readonly io: IO,
    private readonly feed: PriceFeed,
    private readonly chain: Chain,
    private readonly config: Config
  ) {}

  async create(p: { stateId: number; address: string; name: string }): Promise<Ack<{ battleId: string }>> {
    if (!STATES[p.stateId]) return fail("Unknown state");
    if (!isAddress(p.address)) return fail("Invalid address");
    const address = p.address.toLowerCase();

    const active = this.activeBattleFor(p.stateId);
    if (active?.phase === "lobby" && active.creator.address === address) return { ok: true, battleId: active.id };
    if (active) return fail(`${STATES[p.stateId].name} is already under siege`);
    const name = await this.chain.getPlayerName(address);
    if (name === null) return fail("Register your kingdom on-chain first");

    const owner = await this.chain.getStateOwner(p.stateId);
    const id = randomBytes(5).toString("hex");
    const battle: Battle = {
      id,
      onchainId: keccak256(toHex(id)),
      stateId: p.stateId,
      phase: "lobby",
      creator: player(address, name ?? p.name),
      opponent: null,
      defender: owner,
      requiredOpponent: owner && owner !== address ? owner : null,
      picks: { [address]: null },
      entryPrice: null,
      lastPrice: null,
      pickEndsAt: null,
      endsAt: null,
      returns: {},
      winner: null,
      txHash: null,
      settleError: null,
    };
    this.battles.set(id, battle);
    battle.timer = setTimeout(() => {
      if (battle.phase !== "lobby") return;
      this.battles.delete(id);
      console.log(`[battle ${id}] lobby expired`);
      this.broadcastOpen();
    }, LOBBY_TTL_MS);
    console.log(`[battle ${id}] created for ${STATES[p.stateId].code} by ${battle.creator.name}`);
    this.broadcastOpen();
    return { ok: true, battleId: id };
  }

  watch(socket: ClientSocket, battleId: string): Ack<{ battle: BattleView }> {
    const battle = this.battles.get(battleId);
    if (!battle) return fail("Battle not found");
    socket.join(room(battleId));
    return { ok: true, battle: this.view(battle) };
  }

  async join(p: { battleId: string; address: string; name: string }): Promise<Ack> {
    const battle = this.battles.get(p.battleId);
    if (!battle) return fail("Battle not found");
    if (battle.phase !== "lobby") return fail("Battle already started");
    if (!isAddress(p.address)) return fail("Invalid address");
    const address = p.address.toLowerCase();
    if (address === battle.creator.address) return fail("You can't battle yourself");
    if (battle.requiredOpponent && battle.requiredOpponent !== address) {
      return fail("Only the current ruler of this state can accept this challenge");
    }
    const name = await this.chain.getPlayerName(address);
    if (name === null) return fail("Register your kingdom on-chain first");

    const owner = await this.chain.getStateOwner(battle.stateId);
    if (owner && owner !== address && owner !== battle.creator.address) {
      return fail("The state changed hands; its new ruler must be in the battle");
    }
    if (battle.phase !== "lobby") return fail("Battle already started");

    clearTimeout(battle.timer);
    battle.defender = owner;
    battle.opponent = player(address, name ?? p.name);
    battle.picks[address] = null;
    battle.phase = "picking";
    battle.pickEndsAt = Date.now() + this.config.pickSeconds * 1000;
    battle.timer = setTimeout(() => this.startLive(battle), this.config.pickSeconds * 1000);
    console.log(`[battle ${battle.id}] ${battle.opponent.name} accepted`);
    this.emitState(battle);
    this.broadcastOpen();
    return { ok: true };
  }

  pick(p: { battleId: string; address: string; side: Side; leverage: number }): Ack {
    const battle = this.battles.get(p.battleId);
    if (!battle) return fail("Battle not found");
    if (battle.phase !== "picking") return fail("Picks are closed");
    const address = p.address.toLowerCase();
    if (!(address in battle.picks)) return fail("You are not in this battle");
    if (p.side !== "long" && p.side !== "short") return fail("Invalid side");
    if (!Number.isInteger(p.leverage) || p.leverage < 1 || p.leverage > ARENA_MAX_LEVERAGE) {
      return fail(`Leverage must be 1-${ARENA_MAX_LEVERAGE}x`);
    }

    battle.picks[address] = { side: p.side, leverage: p.leverage };
    if (Object.values(battle.picks).every(Boolean)) {
      clearTimeout(battle.timer);
      this.startLive(battle);
    } else {
      this.emitState(battle);
    }
    return { ok: true };
  }

  onPrice(tick: PriceTick) {
    for (const battle of this.battles.values()) {
      if (battle.phase !== "live") continue;
      this.updateReturns(battle, tick.p);
      this.io.to(room(battle.id)).emit("battle:tick", {
        battleId: battle.id,
        price: tick.p,
        t: tick.t,
        returns: battle.returns,
      });
    }
  }

  openSummaries(): BattleSummary[] {
    return [...this.battles.values()]
      .filter((b) => b.phase !== "ended")
      .map((b) => ({
        id: b.id,
        stateId: b.stateId,
        phase: b.phase,
        creator: b.creator,
        opponent: b.opponent,
        requiredOpponent: b.requiredOpponent,
      }));
  }

  private startLive(battle: Battle) {
    if (battle.phase !== "picking") return;
    const latest = this.feed.latest;
    if (!latest) {
      battle.timer = setTimeout(() => this.startLive(battle), 1000);
      return;
    }
    for (const addr of Object.keys(battle.picks)) {
      battle.picks[addr] ??= { side: "long", leverage: 1 };
    }
    battle.phase = "live";
    battle.entryPrice = latest.p;
    battle.lastPrice = latest.p;
    battle.endsAt = Date.now() + this.config.roundSeconds * 1000;
    this.updateReturns(battle, latest.p);
    battle.timer = setTimeout(() => this.finish(battle), this.config.roundSeconds * 1000);
    console.log(`[battle ${battle.id}] live at $${latest.p}`);
    this.emitState(battle);
    this.broadcastOpen();
  }

  private finish(battle: Battle) {
    if (battle.phase !== "live" || !battle.opponent) return;
    const latest = this.feed.latest;
    if (latest) this.updateReturns(battle, latest.p);

    const a = battle.creator.address;
    const b = battle.opponent.address;
    const ra = battle.returns[a] ?? 0;
    const rb = battle.returns[b] ?? 0;
    let winner: string;
    if (ra !== rb) winner = ra > rb ? a : b;
    else winner = battle.defender === a || battle.defender === b ? battle.defender : a;
    const loser = winner === a ? b : a;

    battle.phase = "ended";
    battle.winner = winner;
    console.log(`[battle ${battle.id}] winner ${winner} (${ra.toFixed(3)}% vs ${rb.toFixed(3)}%)`);
    this.emitState(battle);
    this.broadcastOpen();
    setTimeout(() => this.battles.delete(battle.id), ENDED_TTL_MS);

    this.chain
      .settle({
        onchainId: battle.onchainId,
        stateId: battle.stateId,
        winner,
        loser,
        winnerBps: Math.round((battle.returns[winner] ?? 0) * 100),
        loserBps: Math.round((battle.returns[loser] ?? 0) * 100),
      })
      .then((hash) => {
        battle.txHash = hash;
        console.log(`[battle ${battle.id}] settled ${hash}`);
        this.io.emit("chain:updated");
      })
      .catch((err) => {
        battle.settleError = errMessage(err);
        console.error(`[battle ${battle.id}] settlement failed:`, battle.settleError);
      })
      .finally(() => this.emitState(battle));
  }

  private updateReturns(battle: Battle, price: number) {
    if (battle.entryPrice === null) return;
    battle.lastPrice = price;
    for (const [addr, pick] of Object.entries(battle.picks)) {
      if (pick) battle.returns[addr] = computeReturnPct(pick.side, pick.leverage, battle.entryPrice, price);
    }
  }

  private activeBattleFor(stateId: number) {
    return [...this.battles.values()].find((b) => b.stateId === stateId && b.phase !== "ended");
  }

  private view(b: Battle): BattleView {
    const revealed = b.phase === "live" || b.phase === "ended";
    return {
      id: b.id,
      onchainId: b.onchainId,
      stateId: b.stateId,
      phase: b.phase,
      creator: b.creator,
      opponent: b.opponent,
      defender: b.defender,
      requiredOpponent: b.requiredOpponent,
      picked: Object.fromEntries(Object.entries(b.picks).map(([k, v]) => [k, Boolean(v)])),
      picks: revealed ? (b.picks as Record<string, Pick>) : null,
      entryPrice: b.entryPrice,
      lastPrice: b.lastPrice,
      pickEndsAt: b.pickEndsAt,
      endsAt: b.endsAt,
      returns: b.returns,
      winner: b.winner,
      txHash: b.txHash,
      settleError: b.settleError,
    };
  }

  private emitState(battle: Battle) {
    this.io.to(room(battle.id)).emit("battle:state", this.view(battle));
  }

  private broadcastOpen() {
    this.io.emit("battles:open", this.openSummaries());
  }
}
