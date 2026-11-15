"use client";

import { useAccountModal } from "@rainbow-me/rainbowkit";
import { ChartCandlestick, Home, Plus, ScrollText, Store, Swords, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FAUCET_URL, MAX_LAND, leagueFor, upgradeCost } from "@monarch/shared";
import { pendingGold, useBuildings, useMe, useMonBalance, type PlayerData } from "@/hooks/useMonarch";
import { useNow } from "@/hooks/useNow";
import { useGameActions } from "@/hooks/useSession";
import { explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { BuildingActionBar, BuildingInfoModal, ShopModal } from "./BuildingPanels";
import { BattleLogModal, BtcTicker, FastModeChip, LiveFeed } from "./Feeds";
import { MatchmakingModal } from "./Matchmaking";
import { GoldCoin, HudBar, LandIcon, LeagueBadge, MonGem, RoundButton } from "./ui";
import { World } from "./World";

type Modal = "info" | "shop" | "log" | "attack" | null;
type Toast = { kind: "ok" | "error"; text: string; hash?: string } | null;

export function Base({ player, readOnly = false }: { player: PlayerData; readOnly?: boolean }) {
  const { levels: chainLevels, refetch: refetchBuildings } = useBuildings(player.address);
  const levels = chainLevels ?? [1, 1, 1, 1];
  const me = useMe();
  const { send } = useGameActions();
  const now = useNow(1000);
  const [selected, setSelected] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [floatText, setFloatText] = useState<string | null>(null);

  const pending = pendingGold(player, levels[1], now);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.kind === "ok" ? 5000 : 8000);
    return () => clearTimeout(id);
  }, [toast]);

  const refresh = useCallback(() => {
    refetchBuildings();
    me.refetch();
  }, [refetchBuildings, me]);

  const upgrade = async (id: number) => {
    setBusy(`upgrade-${id}`);
    try {
      const hash = await send({ functionName: "upgrade", args: [id] });
      refresh();
      setToast({ kind: "ok", text: "Upgrade complete!", hash });
    } catch (err) {
      setToast({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  const collect = async () => {
    if (pending === 0) return;
    const amount = pending;
    setBusy("collect");
    try {
      const hash = await send({ functionName: "collect" });
      setFloatText(`+${amount}`);
      setTimeout(() => setFloatText(null), 1300);
      refresh();
      setToast({ kind: "ok", text: `Collected ${amount} gold`, hash });
    } catch (err) {
      setToast({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-ink">
      <World
        levels={levels}
        land={player.land}
        selected={selected}
        onSelect={setSelected}
        pending={pending}
        onCollect={collect}
        collecting={busy === "collect"}
        floatText={floatText}
        readOnly={readOnly}
      />
      <div className="scanlines pointer-events-none absolute inset-0 z-[90]" />
      <div className="pointer-events-none absolute inset-0 z-[100] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(2_6_23/0.65))]" />

      <div className="pointer-events-none absolute inset-0 z-[110] p-3 sm:p-4">
        {/* Top left: profile, league, battle log */}
        <div className="pointer-events-auto absolute left-3 top-3 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
          <ProfileChip player={player} ccLevel={levels[0]} />
          {!readOnly && (
            <button
              onClick={() => setModal("log")}
              className="chamfer holo flex items-center gap-1.5 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-cyan-100"
            >
              <ScrollText size={14} /> Battle log
            </button>
          )}
        </div>

        {/* Top center: live BTC */}
        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 md:block">
          <BtcTicker />
        </div>

        {/* Top right: resources */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-3 sm:right-5 sm:top-4">
          <HudBar
            icon={<GoldCoin size={30} />}
            value={player.gold.toLocaleString()}
            fill={player.gold / Math.max(1, upgradeCost(0, levels[0]))}
            color="#fbbf24"
          />
          <HudBar
            icon={<LandIcon size={30} />}
            value={`${player.land} / ${MAX_LAND}`}
            fill={player.land / MAX_LAND}
            color="#22d3ee"
            caption="territory"
          />
          {!readOnly && <MonBar address={player.address} />}
          {!readOnly && <FastModeChip address={player.address} />}
        </div>

        {!readOnly && <LiveFeed />}

        {/* Bottom left: Attack */}
        <div className="pointer-events-auto absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
          <button
            onClick={() => setModal("attack")}
            className="attack-glow group flex h-24 w-24 flex-col items-center justify-center rounded-3xl border-[3px] border-orange-200/80 bg-gradient-to-b from-orange-400 via-orange-600 to-red-700 shadow-[0_0_0_4px_rgb(0_0_0/0.5),0_0_28px_rgb(249_115_22/0.55)] transition hover:scale-105 active:scale-95 sm:h-28 sm:w-28"
          >
            <Swords size={40} className="text-white drop-shadow-[0_2px_0_rgb(0_0_0/0.5)]" />
            <span className="font-display text-sm font-black text-white [text-shadow:0_2px_0_rgb(0_0_0/0.6)] sm:text-base">
              {readOnly ? "ATTACK" : "ATTACK!"}
            </span>
          </button>
        </div>

        {/* Bottom center: selected building actions */}
        {selected !== null && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 sm:bottom-6">
            {readOnly ? (
              <div className="pointer-events-auto">
                <RoundButton label="Info" onClick={() => setModal("info")} size="sm">
                  <span className="font-display text-lg font-bold">i</span>
                </RoundButton>
              </div>
            ) : (
              <BuildingActionBar
                buildingId={selected}
                levels={levels}
                gold={player.gold}
                pending={pending}
                busy={busy}
                onInfo={() => setModal("info")}
                onUpgrade={() => upgrade(selected)}
                onCollect={collect}
              />
            )}
          </div>
        )}

        {/* Bottom right: shop and menu */}
        <div className="pointer-events-auto absolute bottom-4 right-4 flex items-end gap-2 sm:bottom-6 sm:right-6 sm:gap-3">
          <div className="flex flex-col gap-2 sm:gap-3">
            <RoundButton label="Ranks" size="sm" href="/leaderboard">
              <Trophy size={22} />
            </RoundButton>
            {readOnly ? (
              <RoundButton label="Home" size="sm" href="/">
                <Home size={22} />
              </RoundButton>
            ) : (
              <RoundButton label="Train" size="sm" href="/trade">
                <ChartCandlestick size={22} />
              </RoundButton>
            )}
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2 sm:gap-3">
              <WalletButton />
              <RoundButton label="Shop" onClick={() => setModal("shop")}>
                <Store size={34} />
              </RoundButton>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="pop-in pointer-events-auto absolute left-1/2 top-20 z-[200] -translate-x-1/2 md:top-16">
          <div
            className={`chamfer holo px-4 py-2 text-sm ${toast.kind === "ok" ? "text-emerald-200" : "border-red-400/60 text-red-200"}`}
          >
            {toast.text}
            {toast.hash && (
              <a className="ml-2 text-neon underline" href={explorerTx(toast.hash)} target="_blank" rel="noreferrer">
                view tx
              </a>
            )}
            {toast.kind === "error" && toast.text.includes("faucet") && (
              <a className="ml-2 text-neon underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
                open faucet
              </a>
            )}
          </div>
        </div>
      )}

      {modal === "info" && selected !== null && (
        <BuildingInfoModal buildingId={selected} levels={levels} onClose={() => setModal(null)} />
      )}
      {modal === "shop" && (
        <ShopModal levels={levels} gold={player.gold} busy={busy} onUpgrade={upgrade} onClose={() => setModal(null)} />
      )}
      {modal === "log" && <BattleLogModal address={player.address} onClose={() => setModal(null)} />}
      {modal === "attack" &&
        (readOnly && me.player ? (
          <MatchmakingModal target={player} onClose={() => setModal(null)} />
        ) : readOnly ? (
          <NeedBase onClose={() => setModal(null)} />
        ) : (
          <MatchmakingModal onClose={() => setModal(null)} />
        ))}
    </div>
  );
}

function ProfileChip({ player, ccLevel }: { player: PlayerData; ccLevel: number }) {
  const { league, next } = leagueFor(player.trophies);
  const progress = next ? (player.trophies - league.min) / (next.min - league.min) : 1;
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
        <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full drop-shadow-[0_0_10px_rgb(34_211_238/0.8)]">
          <path d="M30 2 55 16v28L30 58 5 44V16Z" fill="#0b1220" stroke="#22d3ee" strokeWidth="3" />
          <path d="M30 8 50 19.5v21L30 52 10 40.5v-21Z" fill="url(#hexfill)" />
          <defs>
            <linearGradient id="hexfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22d3ee" stopOpacity=".55" />
              <stop offset="1" stopColor="#836ef9" stopOpacity=".55" />
            </linearGradient>
          </defs>
        </svg>
        <span className="hud-text relative font-display text-xl font-black sm:text-2xl">{ccLevel}</span>
      </div>
      <div className="space-y-1">
        <p className="hud-text max-w-[9rem] truncate font-display text-sm font-bold sm:max-w-[14rem] sm:text-lg">{player.name}</p>
        <div className="flex items-center gap-1.5">
          <LeagueBadge trophies={player.trophies} size={26} />
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="hud-text font-display text-sm font-bold">{player.trophies}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: league.color }}>
                {league.name}
              </span>
            </div>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800 sm:w-32">
              <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: league.color }} />
            </div>
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-200/70">
          {player.wins}W · {player.losses}L
        </p>
      </div>
    </div>
  );
}

function MonBar({ address }: { address: string }) {
  const { value } = useMonBalance(address);
  return (
    <HudBar
      icon={<MonGem size={28} />}
      value={value === null ? "..." : value.toFixed(value < 10 ? 3 : 1)}
      fill={Math.min(1, (value ?? 0) / 2)}
      color="#836ef9"
      caption="MON"
      action={
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto ml-2 flex h-6 w-6 items-center justify-center rounded-md border border-emerald-300/70 bg-emerald-500/80 text-white shadow-[0_0_10px_rgb(16_185_129/0.7)]"
          aria-label="Get testnet MON"
        >
          <Plus size={16} strokeWidth={3} />
        </a>
      }
    />
  );
}

function WalletButton() {
  const { openAccountModal } = useAccountModal();
  return (
    <RoundButton label="Wallet" size="sm" onClick={() => openAccountModal?.()}>
      <Wallet size={22} />
    </RoundButton>
  );
}

function NeedBase({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="holo pop-in max-w-sm space-y-3 rounded-3xl p-6 text-center">
        <p>You need your own base before you can attack.</p>
        <Link href="/" className="btn-gold">
          Claim a base
        </Link>
      </div>
    </div>
  );
}
