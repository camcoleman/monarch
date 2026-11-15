"use client";

import { useAccountModal } from "@rainbow-me/rainbowkit";
import { ChartCandlestick, Globe2, Home, Plus, ScrollText, ShoppingCart, Swords, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FAUCET_URL, MAX_LAND, leagueFor, upgradeCost } from "@monarch/shared";
import { pendingGold, useBuildings, useMe, useMonBalance, type PlayerData } from "@/hooks/useMonarch";
import { useNow } from "@/hooks/useNow";
import { useLayout } from "@/hooks/useLayout";
import { useGameActions } from "@/hooks/useSession";
import { explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { BuildingActionBar, BuildingInfoModal, ShopModal } from "./BuildingPanels";
import { AssetTicker, BattleLogModal, FastModeChip, LiveFeed } from "./Feeds";
import { IncomingChallenges } from "./IncomingChallenges";
import { MatchmakingModal } from "./Matchmaking";
import { GoldCoin, HudBar, LandIcon, LeagueBadge, MonGem, RoundButton, TrophyIcon, XpStar } from "./ui";
import { World, isOutpost } from "./World";

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
  const { layout, move: moveBuilding } = useLayout(player.address);

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
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-[#3f7a1c]">
      <World
        levels={levels}
        land={player.land}
        layout={layout}
        onMove={readOnly ? undefined : moveBuilding}
        selected={selected}
        onSelect={setSelected}
        pending={pending}
        onCollect={collect}
        collecting={busy === "collect"}
        floatText={floatText}
        readOnly={readOnly}
      />
      <div className="pointer-events-none absolute inset-0 z-[100] bg-[radial-gradient(ellipse_at_center,transparent_60%,rgb(20_40_5/0.45))]" />

      <div className="pointer-events-none absolute inset-0 z-[110] p-3 sm:p-4">
        {/* Top left: XP star, name, trophies, battle log */}
        <div className="pointer-events-auto absolute left-3 top-3 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
          <ProfileChip player={player} townHall={levels[0]} />
          {!readOnly && (
            <button onClick={() => setModal("log")} className="btn-ghost gap-1 px-3 py-1 text-sm">
              <ScrollText size={15} /> Battle log
            </button>
          )}
        </div>

        {/* Top center: live price */}
        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 md:block">
          <AssetTicker townHall={levels[0]} />
        </div>

        {/* Top right: resources */}
        <div className="absolute right-4 top-6 flex flex-col items-end gap-5 sm:right-6 sm:top-7">
          <HudBar
            icon={<GoldCoin size={32} />}
            value={player.gold.toLocaleString()}
            fill={player.gold / Math.max(1, upgradeCost(0, levels[0]))}
            color="#ffd21f"
            caption="Gold"
          />
          <HudBar
            icon={<LandIcon size={34} />}
            value={`${player.land} / ${MAX_LAND}`}
            fill={player.land / MAX_LAND}
            color="#7cc828"
            caption="Territory"
          />
          {!readOnly && <MonBar address={player.address} />}
          {!readOnly && <FastModeChip address={player.address} />}
        </div>

        {!readOnly && <LiveFeed />}
        {!readOnly && <IncomingChallenges address={player.address} />}

        {/* Bottom left: Attack */}
        <div className="pointer-events-auto absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
          <button
            onClick={() => setModal("attack")}
            className="attack-pulse flex h-24 w-24 flex-col items-center justify-center rounded-[28px] border-[3px] border-[#1d1206] bg-[linear-gradient(180deg,#ffb39b_0%,#ff7552_45%,#ee4a2a_55%,#b8231a_100%)] shadow-[inset_0_-6px_0_rgb(0_0_0/0.22),inset_0_3px_0_rgb(255_255_255/0.5),0_5px_0_#1d1206] transition hover:brightness-110 active:translate-y-[3px] sm:h-28 sm:w-28"
          >
            <Swords size={46} strokeWidth={2.5} className="text-white drop-shadow-[0_2px_0_#1d1206]" />
            <span className="clash-text font-display text-lg sm:text-xl">Attack!</span>
          </button>
        </div>

        {/* Bottom center: selected building actions */}
        {selected !== null && isOutpost(selected) && (
          <div className="pop-in pointer-events-auto absolute bottom-32 left-1/2 w-72 max-w-[80vw] -translate-x-1/2 sm:bottom-6">
            <div className="panel px-4 py-3 text-center text-sm">
              <p className="font-display text-lg">Outpost</p>
              <p>A plot of land you won in battle. Each outpost adds one to your territory on the kingdom map.</p>
              {!readOnly && <p className="mt-1 text-muted">Drag it to any of your plots. Dropping onto a building swaps them.</p>}
            </div>
          </div>
        )}
        {selected !== null && !isOutpost(selected) && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 sm:bottom-6">
            {readOnly ? (
              <div className="pointer-events-auto">
                <RoundButton label="Info" onClick={() => setModal("info")} size="sm" tone="blue">
                  <span className="font-display text-2xl">i</span>
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
            <RoundButton label="World" size="sm" href="/leaderboard">
              <Globe2 size={24} strokeWidth={2.5} />
            </RoundButton>
            <RoundButton label="Ranks" size="sm" href="/leaderboard?tab=trophies">
              <Trophy size={24} strokeWidth={2.5} />
            </RoundButton>
            {readOnly ? (
              <RoundButton label="Home" size="sm" href="/">
                <Home size={24} strokeWidth={2.5} />
              </RoundButton>
            ) : (
              <RoundButton label="Train" size="sm" href="/trade">
                <ChartCandlestick size={24} strokeWidth={2.5} />
              </RoundButton>
            )}
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2 sm:gap-3">
              <WalletButton />
              <RoundButton label="Shop" onClick={() => setModal("shop")} tone="gold">
                <ShoppingCart size={36} strokeWidth={2.5} />
              </RoundButton>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="pop-in pointer-events-auto absolute left-1/2 top-20 z-[200] -translate-x-1/2 md:top-16">
          <div className={`panel px-4 py-2 text-sm font-bold ${toast.kind === "ok" ? "text-up" : "text-down"}`}>
            {toast.text}
            {toast.hash && (
              <a className="ml-2 text-sky underline" href={explorerTx(toast.hash)} target="_blank" rel="noreferrer">
                view tx
              </a>
            )}
            {toast.kind === "error" && toast.text.includes("faucet") && (
              <a className="ml-2 text-sky underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
                open faucet
              </a>
            )}
          </div>
        </div>
      )}

      {modal === "info" && selected !== null && !isOutpost(selected) && (
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

function ProfileChip({ player, townHall }: { player: PlayerData; townHall: number }) {
  const { league, next } = leagueFor(player.trophies);
  const progress = next ? (player.trophies - league.min) / (next.min - league.min) : 1;
  return (
    <div className="flex items-center gap-2">
      <XpStar level={townHall} size={58} />
      <div className="space-y-1">
        <p className="clash-text max-w-[9rem] truncate font-display text-lg leading-none sm:max-w-[14rem] sm:text-xl">{player.name}</p>
        <div className="flex items-center gap-1.5">
          <LeagueBadge trophies={player.trophies} size={26} />
          <div className="hud-pill flex items-center gap-1 py-0.5 pl-1.5 pr-2.5">
            <TrophyIcon size={18} />
            <span className="clash-text font-display text-sm">{player.trophies}</span>
          </div>
          <span className="clash-text font-display text-xs" style={{ color: league.color }}>
            {league.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hud-pill h-2.5 w-28 overflow-hidden sm:w-32">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: league.color }} />
          </div>
          <span className="clash-text font-display text-[11px]">
            {player.wins}W · {player.losses}L
          </span>
        </div>
      </div>
    </div>
  );
}

function MonBar({ address }: { address: string }) {
  const { value } = useMonBalance(address);
  return (
    <HudBar
      icon={<MonGem size={30} />}
      value={value === null ? "..." : value.toFixed(value < 10 ? 3 : 1)}
      fill={Math.min(1, (value ?? 0) / 2)}
      color="#9b87ff"
      caption="MON"
      action={
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-green pointer-events-auto ml-3 h-7 w-7 rounded-lg p-0"
          aria-label="Get testnet MON"
        >
          <Plus size={18} strokeWidth={4} />
        </a>
      }
    />
  );
}

function WalletButton() {
  const { openAccountModal } = useAccountModal();
  return (
    <RoundButton label="Wallet" size="sm" tone="blue" onClick={() => openAccountModal?.()}>
      <Wallet size={24} strokeWidth={2.5} />
    </RoundButton>
  );
}

function NeedBase({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="panel pop-in max-w-sm space-y-3 p-6 text-center">
        <p>You need your own village before you can attack.</p>
        <Link href="/" className="btn-green">
          Build a village
        </Link>
      </div>
    </div>
  );
}
