"use client";

import { ArrowBigUpDash, Coins, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { ASSETS, BUILDINGS, MAX_BUILDING_LEVEL, upgradeCost } from "@monarch/shared";
import { AssetCoin, ClashModal, GoldCoin, RoundButton } from "./ui";

export function upgradeBlocker(buildingId: number, levels: number[], gold: number): string | null {
  const level = levels[buildingId];
  if (level >= MAX_BUILDING_LEVEL) return "Max level";
  if (buildingId !== 0 && level >= levels[0]) return `Needs Town Hall ${level + 1}`;
  const cost = upgradeCost(buildingId, level);
  if (gold < cost) return `Need ${cost - gold} more gold`;
  return null;
}

/** The coin the next Town Hall level unlocks, if any. */
const nextUnlock = (townHall: number) => ASSETS.find((a) => a.unlock === townHall + 1) ?? null;

/** Bottom-center action row for the selected building, like Clash of Clans. */
export function BuildingActionBar({
  buildingId,
  levels,
  gold,
  pending,
  busy,
  onInfo,
  onUpgrade,
  onCollect,
}: {
  buildingId: number;
  levels: number[];
  gold: number;
  pending: number;
  busy: string | null;
  onInfo: () => void;
  onUpgrade: () => void;
  onCollect: () => void;
}) {
  const b = BUILDINGS[buildingId];
  const level = levels[buildingId];
  const maxed = level >= MAX_BUILDING_LEVEL;
  const blocker = upgradeBlocker(buildingId, levels, gold);
  const upgrading = busy === `upgrade-${buildingId}`;

  return (
    <div className="pop-in pointer-events-auto flex flex-col items-center gap-2">
      <p className="clash-text font-display text-xl sm:text-2xl">
        {b.name} <span className="text-[#ffd84a]">(Level {level})</span>
      </p>
      <div className="flex items-start gap-3">
        <RoundButton label="Info" onClick={onInfo} tone="blue">
          <span className="font-display text-3xl">i</span>
        </RoundButton>
        {buildingId === 1 && (
          <RoundButton label={`Collect ${pending}`} onClick={onCollect} disabled={pending === 0 || !!busy} tone="gold">
            <Coins size={32} strokeWidth={2.5} />
          </RoundButton>
        )}
        {!maxed && (
          <div className="relative">
            <span className="hud-pill absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap px-2 py-0.5">
              <span className="clash-text font-display text-xs">{upgradeCost(buildingId, level)}</span> <GoldCoin size={14} />
            </span>
            <RoundButton
              label={upgrading ? "Building..." : blocker ?? "Upgrade"}
              onClick={onUpgrade}
              disabled={!!blocker || !!busy}
              tone="green"
            >
              {upgrading ? (
                <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
              ) : (
                <ArrowBigUpDash size={36} strokeWidth={2.5} />
              )}
            </RoundButton>
          </div>
        )}
      </div>
    </div>
  );
}

export function BuildingInfoModal({ buildingId, levels, onClose }: { buildingId: number; levels: number[]; onClose: () => void }) {
  const b = BUILDINGS[buildingId];
  const level = levels[buildingId];
  return (
    <ClashModal title={`${b.name} (Level ${level})`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <img src={`/village/${b.key}.png`} alt="" className="h-28 w-28 object-contain drop-shadow-[0_6px_4px_rgb(0_0_0/0.35)]" />
          <div className="space-y-2">
            <LevelPips level={level} />
            <p className="text-sm">{b.description}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm">
          <Stat label="Now" value={b.effect(level)} />
          {level < MAX_BUILDING_LEVEL && <Stat label={`Level ${level + 1}`} value={b.effect(level + 1)} highlight />}
        </div>
        {buildingId === 0 && <AssetUnlocks townHall={level} />}
      </div>
    </ClashModal>
  );
}

/** Every coin and the Town Hall level that unlocks it. */
export function AssetUnlocks({ townHall }: { townHall: number }) {
  return (
    <div className="space-y-2">
      <p className="font-display text-base">Tradable coins</p>
      <div className="grid grid-cols-5 gap-2">
        {ASSETS.map((a) => {
          const locked = a.unlock > townHall;
          return (
            <div key={a.id} className={`well flex flex-col items-center gap-1 py-2 ${locked ? "opacity-70" : ""}`}>
              <span className="relative">
                <AssetCoin asset={a.id} size={34} locked={locked} />
                {locked && (
                  <Lock size={16} strokeWidth={3} className="absolute -bottom-1 -right-1 rounded-full bg-ink p-0.5 text-white" />
                )}
              </span>
              <span className="text-[11px] font-extrabold">{locked ? `TH ${a.unlock}` : a.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LevelPips({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-6 rounded-sm border-2 border-[#1d1206] ${i < level ? "bg-[linear-gradient(180deg,#fff3a0,#ffbf1f)]" : "bg-[#d9c290]"}`}
        />
      ))}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 rounded-xl border-2 px-3 py-2 ${highlight ? "border-up/60 bg-[#e3f5c8]" : "border-[#c9ac6c] bg-[#efdfb8]"}`}>
      <span className="text-muted">{label}</span>
      <span className={`text-right font-extrabold ${highlight ? "text-up" : ""}`}>{value}</span>
    </div>
  );
}

/** Every building and its next upgrade in one list. */
export function ShopModal({
  levels,
  gold,
  busy,
  onUpgrade,
  onClose,
}: {
  levels: number[];
  gold: number;
  busy: string | null;
  onUpgrade: (id: number) => void;
  onClose: () => void;
}) {
  const unlock = nextUnlock(levels[0]);
  return (
    <ClashModal title="Shop" onClose={onClose} wide>
      <div className="mb-3 flex items-center justify-center gap-2 font-display text-lg">
        <GoldCoin size={22} /> {gold.toLocaleString()}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDINGS.map((b) => {
          const level = levels[b.id];
          const blocker = upgradeBlocker(b.id, levels, gold);
          return (
            <div key={b.id} className="well p-3">
              <div className="flex gap-3">
                <img src={`/village/${b.key}.png`} alt="" className="h-20 w-20 object-contain drop-shadow-[0_4px_3px_rgb(0_0_0/0.3)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight">{b.name}</p>
                  <p className="text-xs font-extrabold text-muted">Level {level}</p>
                  <p className="mt-1 text-xs">{b.effect(level)}</p>
                  {b.id === 0 && unlock && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-extrabold text-up">
                      Next level unlocks <AssetCoin asset={unlock.id} size={18} /> {unlock.name}
                    </p>
                  )}
                </div>
              </div>
              {level < MAX_BUILDING_LEVEL ? (
                <button
                  className="btn-green mt-3 w-full text-base"
                  disabled={!!blocker || !!busy}
                  onClick={() => onUpgrade(b.id)}
                  title={blocker ?? undefined}
                >
                  {busy === `upgrade-${b.id}` ? (
                    "Building..."
                  ) : blocker ?? (
                    <>
                      Upgrade {upgradeCost(b.id, level)} <GoldCoin size={18} />
                    </>
                  )}
                </button>
              ) : (
                <p className="mt-3 text-center font-display text-base text-up">Max level</p>
              )}
            </div>
          );
        })}
      </div>
    </ClashModal>
  );
}
