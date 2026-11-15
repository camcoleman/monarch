"use client";

import { ArrowUpCircle, Coins, Info } from "lucide-react";
import { BUILDINGS, MAX_BUILDING_LEVEL, upgradeCost } from "@monarch/shared";
import { GoldCoin, HoloModal } from "./ui";

export function upgradeBlocker(buildingId: number, levels: number[], gold: number): string | null {
  const level = levels[buildingId];
  if (level >= MAX_BUILDING_LEVEL) return "Max level";
  if (buildingId !== 0 && level >= levels[0]) return `Needs Command Center Lv ${level + 1}`;
  const cost = upgradeCost(buildingId, level);
  if (gold < cost) return `Need ${cost - gold} more gold`;
  return null;
}

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
      <p className="hud-text font-display text-base font-bold sm:text-lg">
        {b.name} <span className="text-cyan-200">(Level {level})</span>
      </p>
      <div className="flex items-start gap-3">
        <ActionButton label="Info" onClick={onInfo}>
          <Info size={26} />
        </ActionButton>
        {buildingId === 1 && (
          <ActionButton label={`Collect ${pending}`} onClick={onCollect} disabled={pending === 0 || !!busy} tone="gold">
            <Coins size={26} />
          </ActionButton>
        )}
        {!maxed && (
          <ActionButton
            label={upgrading ? "Building..." : blocker ?? "Upgrade"}
            onClick={onUpgrade}
            disabled={!!blocker || !!busy}
            tone="gold"
            badge={
              <span className="flex items-center gap-1 font-display text-xs font-bold">
                {upgradeCost(buildingId, level)} <GoldCoin size={14} />
              </span>
            }
          >
            {upgrading ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowUpCircle size={28} />
            )}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone = "neon",
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neon" | "gold";
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors =
    tone === "gold"
      ? "border-amber-300/80 text-amber-200 shadow-[0_0_20px_-4px_rgb(251_191_36/0.8)]"
      : "border-neon/70 text-neon shadow-[0_0_20px_-4px_rgb(34_211_238/0.8)]";
  return (
    <button onClick={onClick} disabled={disabled} className="group flex w-20 flex-col items-center gap-1 disabled:opacity-50">
      <span
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-gradient-to-b from-slate-800 to-slate-950 transition group-enabled:group-hover:scale-105 ${colors}`}
      >
        {children}
        {badge && <span className="absolute -top-2 rounded-full bg-black/80 px-1.5 py-0.5 text-amber-200">{badge}</span>}
      </span>
      <span className="hud-text text-center text-[11px] font-bold leading-tight">{label}</span>
    </button>
  );
}

export function BuildingInfoModal({ buildingId, levels, onClose }: { buildingId: number; levels: number[]; onClose: () => void }) {
  const b = BUILDINGS[buildingId];
  const level = levels[buildingId];
  return (
    <HoloModal title={b.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <img src={`/base/${b.key}.png`} alt="" className="h-28 w-28 object-contain drop-shadow-[0_0_14px_rgb(34_211_238/0.5)]" />
          <div className="space-y-1">
            <p className="font-display text-sm text-cyan-200">
              Level {level} / {MAX_BUILDING_LEVEL}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
                <span key={i} className={`h-2 w-6 skew-x-[-20deg] ${i < level ? "bg-neon shadow-[0_0_8px_#22d3ee]" : "bg-edge"}`} />
              ))}
            </div>
            <p className="text-sm text-zinc-300">{b.description}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm">
          <Stat label="Now" value={b.effect(level)} />
          {level < MAX_BUILDING_LEVEL && <Stat label={`Level ${level + 1}`} value={b.effect(level + 1)} highlight />}
        </div>
      </div>
    </HoloModal>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between rounded-xl border px-3 py-2 ${highlight ? "border-amber-300/40 bg-amber-300/5" : "border-edge"}`}>
      <span className="text-zinc-400">{label}</span>
      <span className={highlight ? "text-amber-200" : "text-zinc-100"}>{value}</span>
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
  return (
    <HoloModal title="Upgrades" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDINGS.map((b) => {
          const level = levels[b.id];
          const blocker = upgradeBlocker(b.id, levels, gold);
          return (
            <div key={b.id} className="rounded-2xl border border-neon/20 bg-slate-950/50 p-3">
              <div className="flex gap-3">
                <img src={`/base/${b.key}.png`} alt="" className="h-20 w-20 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold">{b.name}</p>
                  <p className="text-xs text-cyan-200">Level {level}</p>
                  <p className="mt-1 text-xs text-zinc-400">{b.effect(level)}</p>
                </div>
              </div>
              {level < MAX_BUILDING_LEVEL ? (
                <button
                  className="btn-gold mt-3 w-full gap-1 text-sm"
                  disabled={!!blocker || !!busy}
                  onClick={() => onUpgrade(b.id)}
                  title={blocker ?? undefined}
                >
                  {busy === `upgrade-${b.id}` ? "Building..." : blocker ?? <>Upgrade · {upgradeCost(b.id, level)} <GoldCoin size={16} /></>}
                </button>
              ) : (
                <p className="mt-3 text-center font-display text-xs text-neon">MAX LEVEL</p>
              )}
            </div>
          );
        })}
      </div>
    </HoloModal>
  );
}
