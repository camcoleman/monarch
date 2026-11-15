"use client";

import { Bot, Lock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ASSETS,
  BATTLE_COLLATERAL,
  BOT_PLAYER,
  DEFAULT_ASSET,
  LOOT_PCT,
  ROUND_SECONDS,
  goldPerWin,
  signedMessage,
  trophiesPerWin,
  type AssetId,
  type BattleTick,
  type BattleView,
  type PlayerRef,
  type Side,
} from "@monarch/shared";
import { Celebration } from "@/components/Celebration";
import { LineChart, type ChartPoint } from "@/components/LineChart";
import { RegisterCard } from "@/components/RegisterCard";
import { AssetCoin, GoldCoin, LandIcon, TrophyIcon } from "@/components/base/ui";
import { useBuildings, useHistory, useMe } from "@/hooks/useMonarch";
import { useGameActions } from "@/hooks/useSession";
import { useNow } from "@/hooks/useNow";
import { MONARCH_ADDRESS, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { countdown, pct, price as fmtPrice, shortAddr, usd } from "@/lib/format";
import { startPractice, useGuestId } from "@/lib/practice";
import { getSocket } from "@/lib/socket";

/** Price history per coin since the round went live. */
type Series = Record<string, ChartPoint[]>;

const pricePrecision = (p: number) => (p >= 1000 ? 2 : p >= 1 ? 3 : 5);

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const guestId = useGuestId();
  const now = useNow();
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [series, setSeries] = useState<Series>({});

  useEffect(() => {
    const socket = getSocket();
    const watch = async () => {
      try {
        const res = await socket.timeout(10_000).emitWithAck("battle:watch", { battleId: id });
        if (res.ok) setBattle(res.battle);
        else setLoadError(res.error);
      } catch {
        setLoadError("Referee server did not respond");
      }
    };
    const onState = (b: BattleView) => {
      if (b.id !== id) return;
      setBattle(b);
      if (b.phase === "live" && b.entryPrices) {
        const entry = b.entryPrices;
        setSeries((s) =>
          Object.keys(s).length
            ? s
            : Object.fromEntries(Object.entries(entry).map(([asset, p]) => [asset, [{ t: Date.now(), v: p! }]]))
        );
      }
    };
    const onTick = (t: BattleTick) => {
      if (t.battleId !== id) return;
      setBattle((b) => (b ? { ...b, returns: t.returns, lastPrices: { ...b.lastPrices, ...t.prices } } : b));
      setSeries((s) => {
        const next: Series = { ...s };
        for (const [asset, p] of Object.entries(t.prices)) if (p !== undefined) next[asset] = [...(s[asset] ?? []), { t: t.t, v: p }];
        return next;
      });
    };

    watch();
    socket.io.on("reconnect", watch);
    socket.on("battle:state", onState);
    socket.on("battle:tick", onTick);
    return () => {
      socket.io.off("reconnect", watch);
      socket.off("battle:state", onState);
      socket.off("battle:tick", onTick);
    };
  }, [id]);

  if (loadError) {
    return (
      <div className="panel mx-auto max-w-md space-y-4 p-6 text-center">
        <p className="font-display text-xl">{loadError}</p>
        <Link href="/" className="btn-green">
          Return home
        </Link>
      </div>
    );
  }
  if (!battle) return <p className="clash-text pt-16 text-center font-display text-2xl">Loading battle...</p>;

  const inBattle = (a: string | null | undefined) => !!a && (a === battle.creator.address || a === battle.opponent?.address);
  const myAddr = [me.address, guestId].find(inBattle) ?? null;
  const isCreator = myAddr === battle.creator.address;
  const isOpponent = !!myAddr && myAddr === battle.opponent?.address;
  const bottom: PlayerRef = isOpponent ? battle.opponent! : battle.creator;
  const top: PlayerRef | null = isOpponent ? battle.creator : battle.opponent;
  const practice = battle.mode === "practice";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="text-center">
        <p className="clash-text font-display text-base text-[#ffd84a]">
          {practice ? "Practice battle · no rewards" : battle.mode === "match" ? "Matchmade battle" : "Challenge"}
        </p>
        <h1 className="clash-text font-display text-3xl sm:text-5xl">
          {battle.creator.name} <span className="text-[#ff7552]">vs</span> {battle.opponent?.name ?? "???"}
        </h1>
      </div>

      {battle.phase === "lobby" && <Lobby battle={battle} isCreator={isCreator} />}
      {battle.phase === "picking" && <PickPanel battle={battle} myAddr={myAddr} now={now} />}
      {(battle.phase === "live" || battle.phase === "ended") && top && (
        <>
          <Scoreboard battle={battle} left={bottom} right={top} now={now} myAddr={myAddr} />
          {battle.phase === "ended" && <Result battle={battle} myAddr={myAddr} />}
          <div className="grid gap-4 md:grid-cols-2">
            <PlayerPanel battle={battle} player={bottom} series={series} label={myAddr ? "You" : "Creator"} />
            <PlayerPanel battle={battle} player={top} series={series} label={myAddr ? "Opponent" : "Challenger"} />
          </div>
        </>
      )}
    </div>
  );
}

function Lobby({ battle, isCreator }: { battle: BattleView; isCreator: boolean }) {
  const me = useMe();
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const { sign } = useGameActions();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setLink(window.location.href), []);

  const canAct = Boolean(me.address && (me.player || !MONARCH_ADDRESS));
  const notForMe = battle.requiredOpponent && me.address && battle.requiredOpponent !== me.address;

  const accept = async () => {
    if (!me.address) return;
    setJoining(true);
    setError(null);
    try {
      let signature: string;
      try {
        signature = await sign(signedMessage.join(battle.id));
      } catch (err) {
        setError(friendlyError(err));
        return;
      }
      const res = await getSocket()
        .timeout(10_000)
        .emitWithAck("battle:join", { battleId: battle.id, address: me.address, signature });
      if (!res.ok) setError(res.error);
    } catch {
      setError("Referee server did not respond");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
      {isCreator ? (
        <>
          <p className="font-display text-2xl">Waiting for a challenger...</p>
          <p className="text-sm text-muted">
            {battle.requiredOpponent
              ? "They'll see an Accept button in their village, or you can send them this link."
              : "Share this link with a rival. Anyone with a village can accept."}
            {" "}The Accept button only shows for the other player&apos;s wallet, not yours.
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} className="input flex-1 font-mono text-xs" />
            <button
              className="btn-blue"
              onClick={() => {
                navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-lg">
            <b>{battle.creator.name}</b> challenges you to a {ROUND_SECONDS}-second trading battle.
          </p>
          <p className="text-sm text-muted">
            Each side gets {usd(BATTLE_COLLATERAL, 0)} of battle collateral, trades any coin their Town Hall has unlocked, with leverage
            up to their Barracks&apos; limit. Highest return wins land, gold and trophies.
          </p>
          {!canAct ? (
            <>
              <p className="font-display text-lg">Connect a wallet with a village to accept.</p>
              <RegisterCard compact />
            </>
          ) : notForMe ? (
            <p className="text-sm text-muted">This challenge was sent to another commander.</p>
          ) : (
            <button className="btn-red w-full text-xl" disabled={joining} onClick={accept}>
              {joining ? "Joining..." : "Accept challenge"}
            </button>
          )}
        </>
      )}
      {error && <p className="text-sm font-bold text-down">{error}</p>}
    </div>
  );
}

function PickPanel({ battle, myAddr, now }: { battle: BattleView; myAddr: string | null; now: number }) {
  const unlocked = (myAddr && battle.unlocked[myAddr]) || [DEFAULT_ASSET];
  const maxLev = (myAddr && battle.maxLeverage[myAddr]) || 1;
  const [asset, setAsset] = useState<AssetId>(DEFAULT_ASSET);
  const [side, setSide] = useState<Side>("long");
  const [leverage, setLeverage] = useState(Math.min(3, maxLev));
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const { sign, session } = useGameActions();
  const practice = battle.mode === "practice";
  const locked = myAddr ? battle.picked[myAddr] : false;
  const players = [battle.creator, battle.opponent!];

  const lockIn = async () => {
    if (!myAddr) return;
    setError(null);
    setSigning(true);
    try {
      let signature = "";
      if (!practice) {
        try {
          signature = await sign(signedMessage.pick(battle.id, asset, side, leverage));
        } catch (err) {
          setError(friendlyError(err));
          return;
        }
      }
      const res = await getSocket()
        .timeout(10_000)
        .emitWithAck("battle:pick", { battleId: battle.id, address: myAddr, asset, side, leverage, signature });
      if (!res.ok) setError(res.error);
    } catch {
      setError("Referee server did not respond");
    } finally {
      setSigning(false);
    }
  };

  // Wallet signatures need a few seconds, so lock in whatever is selected well before the deadline.
  const autoLockMs = practice || session.active ? 3_000 : 7_000;
  const remaining = (battle.pickEndsAt ?? now) - now;
  const autoTried = useRef(false);
  useEffect(() => {
    if (!myAddr || locked || signing || autoTried.current || !battle.pickEndsAt || remaining > autoLockMs) return;
    autoTried.current = true;
    lockIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, myAddr, locked, signing, battle.pickEndsAt, autoLockMs]);

  return (
    <div className="panel mx-auto max-w-xl space-y-5 p-6">
      <div className="text-center">
        <p className="text-sm font-extrabold text-muted">Choose your trade</p>
        <p className="font-display text-6xl text-[#e59b07] [text-shadow:0_3px_0_#1d1206]">{countdown((battle.pickEndsAt ?? now) - now)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {players.map((p) => (
          <div key={p.address} className="well flex items-center justify-center gap-2 p-3 text-center">
            {p.address === BOT_PLAYER.address && <Bot size={18} strokeWidth={3} />}
            <div>
              <p className="font-extrabold">{p.name}</p>
              <p className={`font-display ${battle.picked[p.address] ? "text-up" : "text-muted"}`}>
                {battle.picked[p.address] ? "Ready!" : "Deciding..."}
              </p>
            </div>
          </div>
        ))}
      </div>
      {myAddr && !locked && (
        <>
          <div className="space-y-2">
            <p className="font-display text-lg">Coin</p>
            <div className="grid grid-cols-5 gap-2">
              {ASSETS.map((a) => {
                const open = unlocked.includes(a.id);
                const active = asset === a.id;
                return (
                  <button
                    key={a.id}
                    disabled={!open}
                    onClick={() => setAsset(a.id)}
                    title={open ? a.name : `Unlocks at Town Hall ${a.unlock}`}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border-[3px] py-2 transition ${
                      active ? "border-[#1d1206] bg-[#fff3a0] shadow-[0_3px_0_#1d1206]" : "border-[#c9ac6c] bg-[#efdfb8]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <AssetCoin asset={a.id} size={36} locked={!open} />
                    <span className="text-[11px] font-extrabold">{open ? a.id : `TH ${a.unlock}`}</span>
                    {!open && <Lock size={14} strokeWidth={3} className="absolute right-1 top-1" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`${side === "long" ? "btn-green" : "btn-ghost"} text-xl`}
              onClick={() => setSide("long")}
            >
              ▲ Long
            </button>
            <button
              className={`${side === "short" ? "btn-red" : "btn-ghost"} text-xl`}
              onClick={() => setSide("short")}
            >
              ▼ Short
            </button>
          </div>
          <div className="space-y-1">
            <p className="flex justify-between font-display text-lg">
              Leverage <span className="text-muted">{practice ? "Practice max" : "Barracks max"} {maxLev}x</span>
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: maxLev }, (_, i) => i + 1).map((l) => (
                <button
                  key={l}
                  onClick={() => setLeverage(l)}
                  className={`flex-1 py-1.5 text-lg ${leverage === l ? "btn-gold" : "btn-ghost"}`}
                >
                  {l}x
                </button>
              ))}
            </div>
          </div>
          <button className="btn-red w-full text-2xl" disabled={signing} onClick={lockIn}>
            {signing
              ? practice || session.active
                ? "Locking in..."
                : "Sign in your wallet..."
              : `Lock in ${side} ${asset} ${leverage}x`}
          </button>
          <p className="text-center text-sm font-bold text-down">
            Not locked in yet. Your selection locks in automatically with {Math.round(autoLockMs / 1000)}s left.
          </p>
        </>
      )}
      {myAddr && locked && <p className="text-center font-display text-xl text-up">Locked in! Waiting for your opponent...</p>}
      {error && <p className="text-sm font-bold text-down">{error}</p>}
    </div>
  );
}

function PlayerPanel({
  battle,
  player,
  series,
  label,
}: {
  battle: BattleView;
  player: PlayerRef;
  series: Series;
  label: string;
}) {
  const pick = battle.picks?.[player.address];
  const ret = battle.returns[player.address] ?? 0;
  const color = ret >= 0 ? "#3a9d23" : "#d6362a";
  const isWinner = battle.winner === player.address;
  const entry = pick && battle.entryPrices?.[pick.asset];
  const last = pick && battle.lastPrices?.[pick.asset];
  return (
    <div className={`panel p-4 ${isWinner ? "ring-4 ring-[#ffd84a]" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {pick && <AssetCoin asset={pick.asset} size={32} />}
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
            <p className="flex items-center gap-1.5 truncate font-display text-lg">
              {player.address === BOT_PLAYER.address && <Bot size={16} strokeWidth={3} />}
              {player.name} {isWinner && "👑"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold" style={{ color }}>
            {usd(BATTLE_COLLATERAL * (1 + ret / 100))}
          </p>
          {entry && last && (
            <p className="font-mono text-xs text-muted">
              {fmtPrice(entry)} → {fmtPrice(last)}
            </p>
          )}
        </div>
      </div>
      {pick && entry && last && (
        <p className="mb-1 text-xs font-bold text-muted">
          {pick.side === "long" ? "Long" : "Short"} {pick.leverage}x: {pick.asset} {last >= entry ? "up" : "down"}{" "}
          {Math.abs(((last - entry) / entry) * 100).toFixed(3)}% × {pick.leverage}
          {pick.side === "short" ? " (shorts gain when it falls)" : ""} ={" "}
          <span style={{ color }}>{pct(ret, 3)}</span>
        </p>
      )}
      <div
        className="relative overflow-hidden rounded-xl border-2 transition-colors duration-300"
        style={{ backgroundColor: `${color}1f`, borderColor: `${color}66` }}
      >
        <span
          className="pointer-events-none absolute left-2 top-1.5 z-10 rounded-lg px-2 py-0.5 font-display text-2xl text-white shadow-[0_2px_0_rgb(0_0_0/0.25)]"
          style={{ backgroundColor: color }}
        >
          {pct(ret, 3)}
        </span>
        <LineChart
          points={pick ? (series[pick.asset] ?? []) : []}
          color={color}
          height={220}
          precision={entry ? pricePrecision(entry) : 2}
          lines={entry ? [{ price: entry, color: "#5b4220", title: `Entry ${fmtPrice(entry)}` }] : []}
        />
      </div>
    </div>
  );
}

const RETURN_UP = "#7dff5a";
const RETURN_DOWN = "#ff6b5a";

/** Head-to-head header: left player, timer and status in the middle, right player, and a lead bar underneath. */
function Scoreboard({
  battle,
  left,
  right,
  now,
  myAddr,
}: {
  battle: BattleView;
  left: PlayerRef;
  right: PlayerRef;
  now: number;
  myAddr: string | null;
}) {
  const l = battle.returns[left.address] ?? 0;
  const r = battle.returns[right.address] ?? 0;
  const ended = battle.phase === "ended";
  const status = ended
    ? "Final"
    : !myAddr
      ? "Live"
      : l > r
        ? "You're winning!"
        : l < r
          ? "You're losing!"
          : "Dead even";
  // Lead bar: 50% is even; the leader's colour pushes toward the other side.
  const spread = Math.max(0.02, Math.abs(l) + Math.abs(r));
  const leftShare = Math.min(95, Math.max(5, 50 + (50 * (l - r)) / spread));
  const leftColor = myAddr ? "#ffd84a" : "#46aef0";

  return (
    <div className="wood-header rounded-2xl border-[3px] border-[#1d1206] px-4 py-3 shadow-[0_4px_0_#1d1206] sm:px-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <ScoreSide battle={battle} player={left} label={myAddr ? "You" : battle.creator.name} align="left" />
        <div className="text-center">
          <p className="clash-text font-display text-5xl text-[#ffd84a]">
            {ended ? "00:00" : countdown((battle.endsAt ?? now) - now)}
          </p>
          <p className="clash-text font-display text-base">{status}</p>
        </div>
        <ScoreSide battle={battle} player={right} label={myAddr ? "Opponent" : right.name} align="right" />
      </div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full border-2 border-[#1d1206] bg-[#ff6b5a]">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${leftShare}%`, background: leftColor }}
        />
      </div>
    </div>
  );
}

function ScoreSide({
  battle,
  player,
  label,
  align,
}: {
  battle: BattleView;
  player: PlayerRef;
  label: string;
  align: "left" | "right";
}) {
  const pick = battle.picks?.[player.address];
  const ret = battle.returns[player.address] ?? 0;
  const last = pick && battle.lastPrices?.[pick.asset];
  const right = align === "right";
  return (
    <div className={`flex min-w-0 items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      {pick && <AssetCoin asset={pick.asset} size={48} />}
      <div className="min-w-0">
        <p className="clash-text truncate font-display text-lg">
          {label}
          {battle.winner === player.address && " 👑"}
        </p>
        {pick && (
          <p className="clash-text truncate font-display text-sm text-[#ffe9b0]">
            {pick.side === "long" ? "▲ LONG" : "▼ SHORT"} {pick.asset} {pick.leverage}x
            {last ? ` · ${fmtPrice(last)}` : ""}
          </p>
        )}
        <p className="clash-text font-display text-4xl" style={{ color: ret >= 0 ? RETURN_UP : RETURN_DOWN }}>
          {pct(ret, 3)}
        </p>
      </div>
    </div>
  );
}

function Result({ battle, myAddr }: { battle: BattleView; myAddr: string | null }) {
  const router = useRouter();
  const me = useMe();
  const winner = battle.winner === battle.creator.address ? battle.creator : battle.opponent!;
  const loser = winner === battle.creator ? battle.opponent! : battle.creator;
  const won = myAddr === battle.winner;
  const practice = battle.mode === "practice";
  const [restarting, setRestarting] = useState(false);

  const again = async () => {
    setRestarting(true);
    try {
      router.push(`/battle/${await startPractice(me.address)}`);
    } catch {
      setRestarting(false);
    }
  };

  return (
    <div className="panel space-y-4 p-6 text-center">
      {(won || !myAddr) && <Celebration count={won ? 48 : 24} />}
      <p
        className={`pop-in font-display text-6xl ${!myAddr || won ? "text-[#ffbf1f]" : "text-down"}`}
        style={{ textShadow: "0 4px 0 #1d1206, 2px 0 0 #1d1206, -2px 0 0 #1d1206, 0 -2px 0 #1d1206" }}
      >
        {!myAddr ? `${winner.name} wins` : won ? "Victory!" : "Defeat"}
      </p>
      <FinalReturns battle={battle} winner={winner} loser={loser} myAddr={myAddr} />
      {practice ? (
        <>
          <p>
            {won ? "You out-traded the Training Bot." : "The Training Bot got you this time."} Practice battles are off-chain, so
            no trophies, gold or land change hands.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-green text-lg" disabled={restarting} onClick={again}>
              <RotateCcw size={18} strokeWidth={3} /> {restarting ? "Starting..." : "Play again"}
            </button>
            <Link href="/" className="btn-ghost text-lg">
              {me.player ? "Return to village" : "Build a real village"}
            </Link>
          </div>
        </>
      ) : (
        <RealRewards battle={battle} winner={winner} loser={loser} />
      )}
    </div>
  );
}

function FinalReturns({
  battle,
  winner,
  loser,
  myAddr,
}: {
  battle: BattleView;
  winner: PlayerRef;
  loser: PlayerRef;
  myAddr: string | null;
}) {
  return (
    <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
      {[winner, loser].map((p) => {
        const ret = battle.returns[p.address] ?? 0;
        const pick = battle.picks?.[p.address];
        return (
          <div key={p.address} className={`well p-3 ${p === winner ? "ring-4 ring-[#ffd84a]" : ""}`}>
            <p className="truncate text-sm font-extrabold">
              {p.address === myAddr ? "You" : p.name} {p === winner && "👑"}
            </p>
            <p className={`font-display text-3xl ${ret >= 0 ? "text-up" : "text-down"}`}>{pct(ret, 3)}</p>
            {pick && (
              <p className="text-xs font-bold text-muted">
                {pick.side === "long" ? "Long" : "Short"} {pick.asset} {pick.leverage}x
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RealRewards({ battle, winner, loser }: { battle: BattleView; winner: PlayerRef; loser: PlayerRef }) {
  const { levels } = useBuildings(winner.address);
  const { records } = useHistory(battle.txHash ? winner.address : undefined, 1);
  const loot = battle.txHash && records[0]?.loser === loser.address ? records[0].loot : null;
  const gold = goldPerWin(levels?.[1] ?? 1);
  if (battle.settleError) {
    const noReferee = battle.settleError.includes("REFEREE_PRIVATE_KEY");
    return (
      <>
        <p className="font-bold text-down">This result wasn&apos;t recorded on-chain, so no gold, trophies or land changed hands.</p>
        <p className="text-sm text-muted">
          {noReferee
            ? "The game server has no referee key (REFEREE_PRIVATE_KEY), so it can't write results to Monad."
            : `Settlement failed: ${battle.settleError}. The referee wallet may be out of MON.`}
        </p>
        <Link href="/" className="btn-green text-lg">
          Return to village
        </Link>
      </>
    );
  }

  return (
    <>
      <p>
        {winner.name} raids {loser.name} and claims new territory.
      </p>
      <div className="flex flex-wrap justify-center gap-6 font-display text-2xl">
        <span className="pop-in inline-flex items-center gap-1" style={{ animationDelay: "0.2s" }}>
          <TrophyIcon size={26} /> +{trophiesPerWin(levels?.[3] ?? 1)}
        </span>
        <span className="pop-in inline-flex items-center gap-1" style={{ animationDelay: "0.35s" }}>
          <GoldCoin size={24} /> +{gold}
          <span className="text-base text-[#b07800]">{loot !== null ? ` +${loot} loot` : ` +${LOOT_PCT}% loot`}</span>
        </span>
        <span className="pop-in inline-flex items-center gap-1" style={{ animationDelay: "0.5s" }}>
          <LandIcon size={26} /> +1
        </span>
      </div>
      <div className="text-sm">
        {battle.txHash ? (
          <a
            className="well inline-flex items-center gap-2 px-3 py-2 hover:brightness-105"
            href={explorerTx(battle.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="font-display text-base text-up">✓ Recorded on Monad Testnet</span>
            <span className="font-mono text-xs text-muted">{shortAddr(battle.txHash)}</span>
            <span className="font-bold text-sky underline">View tx ↗</span>
          </a>
        ) : (
          <span className="animate-pulse text-muted">Recording on Monad Testnet...</span>
        )}
      </div>
      <Link href="/" className="btn-green text-lg">
        Return to village
      </Link>
    </>
  );
}
