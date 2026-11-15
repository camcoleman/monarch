import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { isAddress, keccak256, toHex, type Hex } from "viem";
import {
  ARENA_MAX_LEVERAGE,
  SIGNATURE_TTL_MS,
  computeReturnPct,
  signedMessage,
  type Ack,
  type BattlePhase,
  type BattleSummary,
  type BattleView,
  type ChallengePayload,
  type ClientToServerEvents,
  type FindMatchPayload,
  type JoinBattlePayload,
  type Pick,
  type PickPayload,
  type PlayerRef,
  type PriceTick,
  type ServerToClientEvents,
} from "@monarch/shared";
import { errMessage, type Chain } from "./chain";
import type { Config } from "./config";
import type { PriceFeed } from "./priceFeed";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const BAD_SIGNATURE = "Signature didn't match this player";
const NOT_REGISTERED = "Register your base on-chain first";
const ENDED_TTL_MS = 30 * 60_000;
const FEED_ENDED_MS = 3 * 60_000;
const LOBBY_TTL_MS = 5 * 60_000;
const FEED_THROTTLE_MS = 2_000;

interface Battle {
  id: string;
  onchainId: Hex;
  mode: BattleView["mode"];
  phase: BattlePhase;
  creator: PlayerRef;
  opponent: PlayerRef | null;
  requiredOpponent: string | null;
  maxLeverage: Record<string, number>;
  picks: Record<string, Pick | null>;
  entryPrice: number | null;
  lastPrice: number | null;
  pickEndsAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  returns: Record<string, number>;
  winner: string | null;
  txHash: string | null;
  settleError: string | null;
  timer?: NodeJS.Timeout;
}

interface QueueEntry {
  player: PlayerRef;
  socketId: string;
}

const room = (id: string) => `battle:${id}`;
const fail = (error: string) => ({ ok: false as const, error });
const fresh = (timestamp: number) => Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= SIGNATURE_TTL_MS;

function playerRef(address: string, name: string | undefined): PlayerRef {
  return { address, name: name?.trim().slice(0, 24) || `${address.slice(0, 6)}...${address.slice(-4)}` };
}

export class BattleManager {
  private readonly battles = new Map<string, Battle>();
  private readonly queue = new Map<string, QueueEntry>();
  private lastFeedAt = 0;

  constructor(
    private readonly io: IO,
    private readonly feed: PriceFeed,
    private readonly chain: Chain,
    private readonly config: Config
  ) {}

  /** Joins the matchmaking queue, or pairs with whoever is waiting. Returns the battle id once paired. */
  async findMatch(socket: ClientSocket, p: FindMatchPayload): Promise<Ack<{ battleId: string | null }>> {
    const auth = await this.authenticate(p.address, signedMessage.findMatch(p.timestamp), p.signature, p.timestamp);
    if ("error" in auth) return fail(auth.error);
    const me = auth.player;

    const current = this.activeBattleOf(me.address);
    if (current) return { ok: true, battleId: current.id };

    const rival = [...this.queue.values()].find((q) => q.player.address !== me.address);
    if (!rival) {
      this.queue.set(me.address, { player: me, socketId: socket.id });
      console.log(`[match] ${me.name} searching (${this.queue.size} in queue)`);
      this.broadcastQueue();
      return { ok: true, battleId: null };
    }

    this.queue.delete(rival.player.address);
    this.queue.delete(me.address);
    const battle = this.newBattle("match", rival.player, null);
    battle.opponent = me;
    await this.startPicking(battle);
    this.io.to(rival.socketId).emit("match:found", { battleId: battle.id });
    console.log(`[match] paired ${rival.player.name} vs ${me.name} in ${battle.id}`);
    this.broadcastQueue();
    return { ok: true, battleId: battle.id };
  }

  cancelMatch(address: string): Ack {
    if (this.queue.delete(address.toLowerCase())) this.broadcastQueue();
    return { ok: true };
  }

  dropSocket(socketId: string) {
    let changed = false;
    for (const [addr, q] of this.queue) {
      if (q.socketId === socketId) changed = this.queue.delete(addr) || changed;
    }
    if (changed) this.broadcastQueue();
  }

  /** Opens a lobby that `target` (or anyone, if null) can accept via the invite link. */
  async challenge(p: ChallengePayload): Promise<Ack<{ battleId: string }>> {
    const auth = await this.authenticate(p.address, signedMessage.challenge(p.target, p.timestamp), p.signature, p.timestamp);
    if ("error" in auth) return fail(auth.error);
    const me = auth.player;

    let target: string | null = null;
    if (p.target) {
      if (!isAddress(p.target)) return fail("Invalid opponent address");
      target = p.target.toLowerCase();
      if (target === me.address) return fail("You can't battle yourself");
      if ((await this.chain.getPlayerName(target)) === null) return fail("That player hasn't registered a base");
    }

    const current = this.activeBattleOf(me.address);
    if (current?.phase === "lobby" && current.requiredOpponent === target) return { ok: true, battleId: current.id };
    if (current) return fail("Finish your current battle first");
    this.queue.delete(me.address);

    const battle = this.newBattle("challenge", me, target);
    battle.timer = setTimeout(() => {
      if (battle.phase !== "lobby") return;
      this.battles.delete(battle.id);
      console.log(`[battle ${battle.id}] lobby expired`);
      this.broadcastLive();
    }, LOBBY_TTL_MS);
    console.log(`[battle ${battle.id}] challenge by ${me.name}${target ? ` to ${target}` : ""}`);
    this.broadcastLive();
    return { ok: true, battleId: battle.id };
  }

  watch(socket: ClientSocket, battleId: string): Ack<{ battle: BattleView }> {
    const battle = this.battles.get(battleId);
    if (!battle) return fail("Battle not found");
    socket.join(room(battleId));
    return { ok: true, battle: this.view(battle) };
  }

  async join(p: JoinBattlePayload): Promise<Ack> {
    const battle = this.battles.get(p.battleId);
    if (!battle) return fail("Battle not found");
    if (battle.phase !== "lobby") return fail("Battle already started");
    if (!isAddress(p.address)) return fail("Invalid address");
    const address = p.address.toLowerCase();
    if (address === battle.creator.address) return fail("You can't battle yourself");
    if (battle.requiredOpponent && battle.requiredOpponent !== address) {
      return fail("This challenge was sent to someone else");
    }
    if (!(await this.chain.verify(address, signedMessage.join(battle.id), p.signature))) return fail(BAD_SIGNATURE);
    const name = await this.chain.getPlayerName(address);
    if (name === null) return fail(NOT_REGISTERED);
    if (battle.phase !== "lobby") return fail("Battle already started");
    const other = this.activeBattleOf(address);
    if (other && other !== battle) return fail("Finish your current battle first");

    clearTimeout(battle.timer);
    this.queue.delete(address);
    battle.opponent = playerRef(address, name);
    await this.startPicking(battle);
    console.log(`[battle ${battle.id}] ${battle.opponent.name} accepted`);
    return { ok: true };
  }

  async pick(p: PickPayload): Promise<Ack> {
    const battle = this.battles.get(p.battleId);
    if (!battle) return fail("Battle not found");
    if (battle.phase !== "picking") return fail("Picks are closed");
    const address = p.address.toLowerCase();
    if (!(address in battle.picks)) return fail("You are not in this battle");
    if (p.side !== "long" && p.side !== "short") return fail("Invalid side");
    const cap = battle.maxLeverage[address] ?? 1;
    if (!Number.isInteger(p.leverage) || p.leverage < 1 || p.leverage > cap) {
      return fail(`Your Mech Bay allows 1-${cap}x leverage`);
    }
    if (!(await this.chain.verify(address, signedMessage.pick(battle.id, p.side, p.leverage), p.signature))) {
      return fail(BAD_SIGNATURE);
    }
    if (battle.phase !== "picking") return fail("Picks are closed");

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
    let anyLive = false;
    for (const battle of this.battles.values()) {
      if (battle.phase !== "live") continue;
      anyLive = true;
      this.updateReturns(battle, tick.p);
      this.io.to(room(battle.id)).emit("battle:tick", {
        battleId: battle.id,
        price: tick.p,
        t: tick.t,
        returns: battle.returns,
      });
    }
    if (anyLive && Date.now() - this.lastFeedAt > FEED_THROTTLE_MS) this.broadcastLive();
  }

  liveSummaries(): BattleSummary[] {
    const now = Date.now();
    return [...this.battles.values()]
      .filter((b) => b.phase !== "ended" || (b.endedAt !== null && now - b.endedAt < FEED_ENDED_MS))
      .map((b) => ({
        id: b.id,
        mode: b.mode,
        phase: b.phase,
        creator: b.creator,
        opponent: b.opponent,
        requiredOpponent: b.requiredOpponent,
        endsAt: b.endsAt,
        returns: b.returns,
        winner: b.winner,
      }));
  }

  queueSize() {
    return this.queue.size;
  }

  private async authenticate(
    rawAddress: string,
    message: string,
    signature: string,
    timestamp: number
  ): Promise<{ player: PlayerRef } | { error: string }> {
    if (!isAddress(rawAddress)) return { error: "Invalid address" };
    if (!fresh(timestamp)) return { error: "Signature expired - try again" };
    const address = rawAddress.toLowerCase();
    if (!(await this.chain.verify(address, message, signature))) return { error: BAD_SIGNATURE };
    const name = await this.chain.getPlayerName(address);
    if (name === null) return { error: NOT_REGISTERED };
    return { player: playerRef(address, name) };
  }

  private newBattle(mode: Battle["mode"], creator: PlayerRef, requiredOpponent: string | null): Battle {
    const id = randomBytes(5).toString("hex");
    const battle: Battle = {
      id,
      onchainId: keccak256(toHex(id)),
      mode,
      phase: "lobby",
      creator,
      opponent: null,
      requiredOpponent,
      maxLeverage: {},
      picks: { [creator.address]: null },
      entryPrice: null,
      lastPrice: null,
      pickEndsAt: null,
      endsAt: null,
      endedAt: null,
      returns: {},
      winner: null,
      txHash: null,
      settleError: null,
    };
    this.battles.set(id, battle);
    return battle;
  }

  private async startPicking(battle: Battle) {
    if (!battle.opponent) return;
    const players = [battle.creator.address, battle.opponent.address];
    const caps = await Promise.all(
      players.map((a) => this.chain.getMaxLeverage(a).catch(() => 1))
    );
    players.forEach((a, i) => {
      battle.maxLeverage[a] = Math.min(ARENA_MAX_LEVERAGE, caps[i]);
      battle.picks[a] = null;
    });
    battle.phase = "picking";
    battle.pickEndsAt = Date.now() + this.config.pickSeconds * 1000;
    battle.timer = setTimeout(() => this.startLive(battle), this.config.pickSeconds * 1000);
    this.emitState(battle);
    this.broadcastLive();
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
    this.broadcastLive();
  }

  private finish(battle: Battle) {
    if (battle.phase !== "live" || !battle.opponent) return;
    const latest = this.feed.latest;
    if (latest) this.updateReturns(battle, latest.p);

    const a = battle.creator.address;
    const b = battle.opponent.address;
    const ra = battle.returns[a] ?? 0;
    const rb = battle.returns[b] ?? 0;
    // Ties go to whoever accepted the battle: the challenger set the terms.
    const winner = ra === rb ? b : ra > rb ? a : b;
    const loser = winner === a ? b : a;

    battle.phase = "ended";
    battle.endedAt = Date.now();
    battle.winner = winner;
    console.log(`[battle ${battle.id}] winner ${winner} (${ra.toFixed(3)}% vs ${rb.toFixed(3)}%)`);
    this.emitState(battle);
    this.broadcastLive();
    setTimeout(() => this.battles.delete(battle.id), ENDED_TTL_MS);

    this.chain
      .settle({
        onchainId: battle.onchainId,
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

  private activeBattleOf(address: string) {
    return [...this.battles.values()].find(
      (b) => b.phase !== "ended" && (b.creator.address === address || b.opponent?.address === address)
    );
  }

  private view(b: Battle): BattleView {
    const revealed = b.phase === "live" || b.phase === "ended";
    return {
      id: b.id,
      onchainId: b.onchainId,
      mode: b.mode,
      phase: b.phase,
      creator: b.creator,
      opponent: b.opponent,
      requiredOpponent: b.requiredOpponent,
      maxLeverage: b.maxLeverage,
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

  private broadcastLive() {
    this.lastFeedAt = Date.now();
    this.io.emit("battles:live", this.liveSummaries());
  }

  private broadcastQueue() {
    this.io.emit("match:queue", { searching: this.queue.size });
  }
}
