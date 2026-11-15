"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BUILDINGS, STATES, goldPerWin } from "@monarch/shared";
import { useBuildings, useMe, useStateOwners, type PlayerData } from "@/hooks/useMonarch";
import { ownerColor } from "@/lib/format";
import { BuildingPanel } from "./BuildingPanel";
import { GoldCoin } from "./GoldCoin";
import { ResourceBar } from "./ResourceBar";

/** Anchor = bottom-centre of the sprite, in % of the scene. Width in % of scene width at level 1. */
const BUILDING_SLOTS = [
  { x: 50, y: 52, w: 19 }, // Town Hall
  { x: 31, y: 63, w: 15 }, // Gold Mine
  { x: 69, y: 63, w: 14 }, // Barracks
  { x: 50, y: 84, w: 13 }, // Trophy Hall
];

/** Open ground around the plateau edge, filled in order as states are conquered. */
const CASTLE_SLOTS = [
  { x: 36, y: 30 },
  { x: 64, y: 30 },
  { x: 19, y: 52 },
  { x: 81, y: 52 },
  { x: 37, y: 84 },
  { x: 63, y: 84 },
  { x: 26, y: 38 },
  { x: 74, y: 38 },
];

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="absolute -bottom-1 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-black/50 bg-gradient-to-b from-amber-300 to-amber-600 text-sm font-black text-ink shadow-md">
      {level}
    </span>
  );
}

export function Village({ player, readOnly = false }: { player: PlayerData; readOnly?: boolean }) {
  const address = player.address;
  const { levels, refetch: refetchBuildings } = useBuildings(address);
  const { refetch: refetchPlayer } = useMe();
  const { owners } = useStateOwners();
  const [selected, setSelected] = useState<number | null>(null);

  const myStates = STATES.filter((s) => owners[s.id] === address);
  const flagColor = ownerColor(address);
  const lv = levels ?? [1, 1, 1, 1];

  const onUpgraded = useCallback(() => {
    refetchBuildings();
    refetchPlayer();
  }, [refetchBuildings, refetchPlayer]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="relative overflow-hidden rounded-3xl border-4 border-black/40 shadow-2xl">
        <ResourceBar player={player} goldPerWin={goldPerWin(lv[1])} />
        <div className="relative aspect-[16/9] w-full bg-[url(/village/ground.jpg)] bg-cover bg-center">

          {myStates.map((s, i) => {
            const slot = CASTLE_SLOTS[i];
            return (
              <div
                key={s.id}
                className="village-sprite absolute"
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: "7%", zIndex: Math.round(slot.y) }}
                title={`${s.name} - conquered`}
              >
                <div className="relative">
                  <img src="/village/castle.png" alt={s.name} className="w-full drop-shadow-lg" />
                  <svg viewBox="0 0 40 24" className="village-flag absolute" style={{ left: "54%", top: "3%", width: "42%" }}>
                    <path d="M0 2 L40 6 L30 12 L40 18 L0 22 Z" fill={flagColor} stroke="rgb(0 0 0 / 0.4)" strokeWidth="1.5" />
                  </svg>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 text-[10px] font-bold text-white">
                    {s.code}
                  </span>
                </div>
              </div>
            );
          })}

          {BUILDINGS.map((b) => {
            const slot = BUILDING_SLOTS[b.id];
            const level = lv[b.id];
            const width = slot.w * (1 + 0.07 * (level - 1));
            const isSelected = selected === b.id;
            return (
              <button
                key={b.id}
                onClick={() => !readOnly && setSelected(isSelected ? null : b.id)}
                className="village-sprite group absolute focus:outline-none"
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${width}%`, zIndex: Math.round(slot.y) }}
                aria-label={`${b.name} level ${level}`}
              >
                <div className="relative transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105">
                  <img
                    src={`/village/${b.key}.png`}
                    alt=""
                    draggable={false}
                    className={`w-full ${
                      isSelected
                        ? "drop-shadow-[0_0_14px_rgba(245,179,1,0.95)]"
                        : level >= 3
                          ? "drop-shadow-[0_0_10px_rgba(245,179,1,0.55)]"
                          : "drop-shadow-[0_8px_8px_rgba(0,0,0,0.45)]"
                    }`}
                  />
                  {b.id === 1 && level > 1 && (
                    <span className="village-coin absolute right-[18%] top-[30%]">
                      <GoldCoin size={18} />
                    </span>
                  )}
                  <LevelBadge level={level} />
                </div>
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/75 px-2 py-0.5 text-xs font-semibold text-white group-hover:block">
                  {b.name}
                </span>
              </button>
            );
          })}

          <div className="absolute bottom-3 left-3 z-[200] flex gap-2">
            <Link href="/leaderboard" className="village-btn bg-gradient-to-b from-sky-400 to-sky-700">
              🏆 Ranks
            </Link>
          </div>
          {!readOnly && (
            <div className="absolute bottom-3 right-3 z-[200] flex gap-2">
              <Link href="/trade" className="village-btn bg-gradient-to-b from-emerald-400 to-emerald-700">
                📈 Train
              </Link>
              <Link href="/map" className="village-btn bg-gradient-to-b from-orange-400 to-red-600 text-lg">
                ⚔️ Attack!
              </Link>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        {readOnly ? (
          <div className="panel space-y-2 p-5">
            <h3 className="font-display text-xl text-gold">{player.name}&apos;s kingdom</h3>
            <p className="text-sm text-zinc-400">Scout a rival&apos;s village. Beat them in battle to take their states.</p>
          </div>
        ) : selected !== null && levels ? (
          <BuildingPanel
            buildingId={selected}
            levels={levels}
            gold={player.gold}
            onClose={() => setSelected(null)}
            onUpgraded={onUpgraded}
          />
        ) : (
          <div className="panel space-y-2 p-5">
            <h3 className="font-display text-xl text-gold">Your kingdom</h3>
            <p className="text-sm text-zinc-400">
              Tap a building to upgrade it with gold. Win battles to earn gold and raise a castle for every state you
              conquer.
            </p>
          </div>
        )}
        <div className="panel p-5">
          <h3 className="mb-2 font-semibold">Buildings</h3>
          <ul className="space-y-1 text-sm">
            {BUILDINGS.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => !readOnly && setSelected(b.id)}
                  className={`flex w-full justify-between ${readOnly ? "cursor-default" : "hover:text-gold"}`}
                >
                  <span>{b.name}</span>
                  <span className="font-mono text-zinc-400">Lv {lv[b.id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <h3 className="mb-2 font-semibold">Conquered states</h3>
          {myStates.length === 0 ? (
            <p className="text-sm text-zinc-500">None yet. Hit Attack to claim your first state.</p>
          ) : (
            <p className="text-sm text-zinc-300">{myStates.map((s) => s.name).join(", ")}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
