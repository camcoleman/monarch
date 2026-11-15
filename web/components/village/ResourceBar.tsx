import type { ReactNode } from "react";
import type { PlayerData } from "@/hooks/useMonarch";
import { GoldCoin } from "./GoldCoin";

function Pill({ icon, children, title }: { icon: ReactNode; children: ReactNode; title: string }) {
  return (
    <div title={title} className="flex items-center rounded-full border-2 border-black/40 bg-black/55 pr-3 shadow-lg backdrop-blur">
      <span className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black/40 bg-gradient-to-b from-amber-300 to-amber-600 text-lg">
        {icon}
      </span>
      <span className="ml-2 font-mono text-base font-bold text-white [text-shadow:0_2px_0_rgb(0_0_0/0.6)]">{children}</span>
    </div>
  );
}

export function ResourceBar({ player, goldPerWin }: { player: PlayerData; goldPerWin: number }) {
  return (
    <div className="pointer-events-none z-30 flex flex-wrap items-start justify-between gap-2 bg-black/50 p-2 sm:absolute sm:inset-x-0 sm:top-0 sm:bg-transparent sm:p-3">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="rounded-xl border-2 border-black/40 bg-black/55 px-3 py-1 shadow-lg backdrop-blur">
          <p className="font-display text-lg font-bold text-gold [text-shadow:0_2px_0_rgb(0_0_0/0.6)]">{player.name}</p>
          <p className="text-xs text-zinc-300">
            {player.wins}W / {player.losses}L
          </p>
        </div>
        <Pill icon="🏆" title="Trophies">
          {player.trophies}
        </Pill>
      </div>
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        <Pill icon="🏰" title="States ruled">
          {player.statesOwned}
        </Pill>
        <Pill icon={<GoldCoin size={24} />} title={`Gold (+${goldPerWin} per victory)`}>
          {player.gold}
        </Pill>
      </div>
    </div>
  );
}
