"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BATTLE_COLLATERAL,
  LOOT_PCT,
  goldPerWin,
  signedMessage,
  trophiesPerWin,
  type BattleTick,
  type BattleView,
  type PlayerRef,
  type Side,
} from "@monarch/shared";
import { Celebration } from "@/components/Celebration";
import { LineChart, type ChartPoint } from "@/components/LineChart";
import { RegisterCard } from "@/components/RegisterCard";
import { GoldCoin, LandIcon } from "@/components/base/ui";
import { useBuildings, useHistory, useMe } from "@/hooks/useMonarch";
import { useGameActions } from "@/hooks/useSession";
import { useNow } from "@/hooks/useNow";
import { MONARCH_ADDRESS, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { countdown, pct, usd } from "@/lib/format";
import { getSocket } from "@/lib/socket";

type Series = Record<string, ChartPoint[]>;

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
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
      if (b.phase === "live") {
        setSeries((s) =>
          Object.keys(s).length
            ? s
            : Object.fromEntries(Object.entries(b.returns).map(([a, r]) => [a, [{ t: Date.now(), v: r }]]))
        );
      }
    };
    const onTick = (t: BattleTick) => {
      if (t.battleId !== id) return;
      setBattle((b) => (b ? { ...b, returns: t.returns, lastPrice: t.price } : b));
      setSeries((s) => {
        const next: Series = { ...s };
        for (const [addr, r] of Object.entries(t.returns)) next[addr] = [...(s[addr] ?? []), { t: t.t, v: r }];
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
      <div className="panel mx-auto max-w-md space-y-3 p-6 text-center">
        <p className="text-lg">{loadError}</p>
        <Link href="/" className="btn-gold">
          Return to base
        </Link>
      </div>
    );
  }
  if (!battle) return <p className="hud-text text-center font-display tracking-widest">LOADING BATTLE...</p>;

  const myAddr = me.address;
  const isCreator = myAddr === battle.creator.address;
  const isOpponent = !!battle.opponent && myAddr === battle.opponent.address;
  const isPlayer = isCreator || isOpponent;
  const bottom: PlayerRef = isOpponent ? battle.opponent! : battle.creator;
  const top: PlayerRef | null = isOpponent ? battle.creator : battle.opponent;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-neon">
          {battle.mode === "match" ? "Matchmade battle" : "Challenge"}
        </p>
        <h1 className="font-display text-3xl font-black sm:text-4xl">
          {battle.creator.name} <span className="text-orange-400">vs</span> {battle.opponent?.name ?? "???"}
        </h1>
      </div>

      {battle.phase === "lobby" && <Lobby battle={battle} isCreator={isCreator} />}
      {battle.phase === "picking" && <PickPanel battle={battle} isPlayer={isPlayer} now={now} />}
      {(battle.phase === "live" || battle.phase === "ended") && top && (
        <>
          <PlayerPanel battle={battle} player={top} series={series} label={isPlayer ? "Opponent" : "Challenger"} />
          <CenterBar battle={battle} now={now} myAddr={isPlayer ? myAddr! : null} />
          <PlayerPanel battle={battle} player={bottom} series={series} label={isPlayer ? "You" : "Creator"} />
        </>
      )}
      {battle.phase === "ended" && <Result battle={battle} myAddr={isPlayer ? myAddr! : null} />}
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
          <p className="text-lg">Waiting for a challenger...</p>
          <p className="text-sm text-zinc-400">
            {battle.requiredOpponent
              ? "Send this link to your target - only they can accept."
              : "Share this link with a rival. Anyone with a base can accept."}
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} className="input flex-1 font-mono text-xs" />
            <button
              className="btn-gold"
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
            <b className="text-gold">{battle.creator.name}</b> challenges you to a 90-second BTC battle.
          </p>
          <p className="text-sm text-zinc-400">
            Each side gets {usd(BATTLE_COLLATERAL, 0)} of battle collateral and leverage up to their Mech Bay&apos;s limit. Highest
            return wins land, gold and trophies.
          </p>
          {!canAct ? (
            <RegisterCard compact />
          ) : notForMe ? (
            <p className="text-sm text-zinc-400">This challenge was sent to another commander.</p>
          ) : (
            <button className="btn-gold w-full text-lg" disabled={joining} onClick={accept}>
              {joining ? "Joining..." : "Accept challenge"}
            </button>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function PickPanel({ battle, isPlayer, now }: { battle: BattleView; isPlayer: boolean; now: number }) {
  const me = useMe();
  const maxLev = (me.address && battle.maxLeverage[me.address]) || 1;
  const [side, setSide] = useState<Side>("long");
  const [leverage, setLeverage] = useState(Math.min(3, maxLev));
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const { sign, session } = useGameActions();
  const locked = me.address ? battle.picked[me.address] : false;
  const players = [battle.creator, battle.opponent!];

  const lockIn = async () => {
    if (!me.address) return;
    setError(null);
    setSigning(true);
    try {
      let signature: string;
      try {
        signature = await sign(signedMessage.pick(battle.id, side, leverage));
      } catch (err) {
        setError(friendlyError(err));
        return;
      }
      const res = await getSocket()
        .timeout(10_000)
        .emitWithAck("battle:pick", { battleId: battle.id, address: me.address, side, leverage, signature });
      if (!res.ok) setError(res.error);
    } catch {
      setError("Referee server did not respond");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="panel mx-auto max-w-lg space-y-5 p-6">
      <div className="text-center">
        <p className="text-sm text-zinc-400">Choose your position</p>
        <p className="font-mono text-5xl text-gold">{countdown((battle.pickEndsAt ?? now) - now)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {players.map((p) => (
          <div key={p.address} className="rounded-xl border border-edge p-3 text-center">
            <p className="font-semibold">{p.name}</p>
            <p className={battle.picked[p.address] ? "text-up" : "text-zinc-500"}>
              {battle.picked[p.address] ? "Locked in" : "Deciding..."}
            </p>
          </div>
        ))}
      </div>
      {isPlayer && !locked && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`btn ${side === "long" ? "bg-up text-ink" : "border border-edge text-zinc-300"}`}
              onClick={() => setSide("long")}
            >
              Long BTC
            </button>
            <button
              className={`btn ${side === "short" ? "bg-down text-white" : "border border-edge text-zinc-300"}`}
              onClick={() => setSide("short")}
            >
              Short BTC
            </button>
          </div>
          <label className="block space-y-1">
            <span className="flex justify-between text-sm text-zinc-400">
              Leverage (Mech Bay max {maxLev}x) <span className="font-mono text-gold">{leverage}x</span>
            </span>
            <input
              type="range"
              min={1}
              max={maxLev}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-[#f5b301]"
            />
          </label>
          <button className="btn-gold w-full text-lg" disabled={signing} onClick={lockIn}>
            {signing ? (session.active ? "Locking in..." : "Sign in your wallet...") : `Lock in ${side} ${leverage}x`}
          </button>
          <p className="text-center text-xs text-zinc-500">No pick by the deadline defaults to long 1x.</p>
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
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
  const color = ret >= 0 ? "#22c55e" : "#ef4444";
  const isWinner = battle.winner === player.address;
  return (
    <div className={`panel p-4 ${isWinner ? "border-gold/70" : ""}`}>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
          <p className="text-lg font-semibold">
            {player.name} {isWinner && "👑"}
          </p>
          {pick && (
            <p className={`text-sm font-bold ${pick.side === "long" ? "text-up" : "text-down"}`}>
              {pick.side.toUpperCase()} BTC · {pick.leverage}x
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-bold" style={{ color }}>
            {pct(ret, 3)}
          </p>
          <p className="font-mono text-sm text-zinc-400">{usd(BATTLE_COLLATERAL * (1 + ret / 100))}</p>
        </div>
      </div>
      <LineChart points={series[player.address] ?? []} color={color} height={150} precision={3} />
    </div>
  );
}

function CenterBar({ battle, now, myAddr }: { battle: BattleView; now: number; myAddr: string | null }) {
  const opponentAddr =
    myAddr && (myAddr === battle.creator.address ? battle.opponent?.address : battle.creator.address);
  const mine = myAddr ? battle.returns[myAddr] ?? 0 : 0;
  const theirs = opponentAddr ? battle.returns[opponentAddr] ?? 0 : 0;
  const status =
    battle.phase === "ended"
      ? "Final"
      : !myAddr
        ? "Live"
        : mine > theirs
          ? "You're winning"
          : mine < theirs
            ? "You're losing"
            : "Dead even";
  return (
    <div className="grid grid-cols-2 items-center gap-2 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 sm:flex sm:justify-between sm:px-6">
      <div className="text-sm text-zinc-400">
        Entry <span className="font-mono text-zinc-200">{battle.entryPrice ? usd(battle.entryPrice) : "-"}</span>
      </div>
      <div className="order-first col-span-2 text-center sm:order-none">
        <p className="font-mono text-4xl font-bold text-gold">
          {battle.phase === "live" ? countdown((battle.endsAt ?? now) - now) : "00:00"}
        </p>
        <p className="text-sm font-semibold">{status}</p>
      </div>
      <div className="text-right text-sm text-zinc-400">
        BTC <span className="font-mono text-zinc-200">{battle.lastPrice ? usd(battle.lastPrice) : "-"}</span>
      </div>
    </div>
  );
}

function Result({ battle, myAddr }: { battle: BattleView; myAddr: string | null }) {
  const winner = battle.winner === battle.creator.address ? battle.creator : battle.opponent!;
  const loser = winner === battle.creator ? battle.opponent! : battle.creator;
  const won = myAddr === battle.winner;
  const { levels } = useBuildings(winner.address);
  const { records } = useHistory(battle.txHash ? winner.address : undefined, 1);
  const loot = battle.txHash && records[0]?.loser === loser.address ? records[0].loot : null;
  const gold = goldPerWin(levels?.[1] ?? 1);
  return (
    <div className="panel space-y-3 p-6 text-center">
      {(won || !myAddr) && <Celebration count={won ? 48 : 24} />}
      <p className={`pop-in font-display text-5xl font-black ${!myAddr || won ? "text-gold" : "text-down"}`}>
        {!myAddr ? `${winner.name} wins` : won ? "VICTORY" : "DEFEAT"}
      </p>
      <p className="text-zinc-300">
        {winner.name} raids {loser.name} and claims new territory.
      </p>
      <div className="flex flex-wrap justify-center gap-6 font-display text-lg">
        <span className="pop-in" style={{ animationDelay: "0.2s" }}>
          🏆 +{trophiesPerWin(levels?.[3] ?? 1)}
        </span>
        <span className="pop-in inline-flex items-center gap-1" style={{ animationDelay: "0.35s" }}>
          <GoldCoin size={20} /> +{gold}
          <span className="text-sm text-amber-200">{loot !== null ? ` +${loot} loot` : ` +${LOOT_PCT}% loot`}</span>
        </span>
        <span className="pop-in inline-flex items-center gap-1" style={{ animationDelay: "0.5s" }}>
          <LandIcon size={20} /> +1
        </span>
      </div>
      <p className="text-sm">
        {battle.txHash ? (
          <a className="text-royal underline" href={explorerTx(battle.txHash)} target="_blank" rel="noreferrer">
            Recorded on Monad Testnet - view transaction
          </a>
        ) : battle.settleError ? (
          <span className="text-red-400">
            Couldn&apos;t record this result on-chain ({battle.settleError}). The referee wallet may be out of MON.
          </span>
        ) : (
          <span className="animate-pulse text-zinc-400">Recording on Monad Testnet...</span>
        )}
      </p>
      <Link href="/" className="btn-gold">
        Return to base
      </Link>
    </div>
  );
}
