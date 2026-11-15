"use client";

import { useMemo, useState } from "react";
import { STATES } from "@monarch/shared";
import { useMe, usePlayers, useStateOwners } from "@/hooks/useMonarch";
import { ownerColor, shortAddr } from "@/lib/format";

type SortKey = "trophies" | "states";

export default function LeaderboardPage() {
  const { players, isLoading } = usePlayers();
  const { owners } = useStateOwners();
  const { address } = useMe();
  const [sort, setSort] = useState<SortKey>("trophies");

  const ranked = useMemo(
    () =>
      [...players].sort((a, b) =>
        sort === "trophies"
          ? b.trophies - a.trophies || b.wins - a.wins
          : b.statesOwned - a.statesOwned || b.trophies - a.trophies
      ),
    [players, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl">Leaderboard</h1>
        <div className="flex gap-1 rounded-xl border border-edge p-1 text-sm">
          {(["trophies", "states"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-lg px-3 py-1 capitalize ${sort === k ? "bg-gold text-ink" : "text-zinc-400"}`}
            >
              {k === "trophies" ? "Trophies" : "Conquest"}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-edge text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Monarch</th>
              <th className="px-4 py-3 text-right">🏆 Trophies</th>
              <th className="px-4 py-3 text-right">🪙 Gold</th>
              <th className="px-4 py-3 text-right">W / L</th>
              <th className="px-4 py-3">🏰 States</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.address} className={`border-b border-edge/50 ${p.address === address ? "bg-gold/10" : ""}`}>
                <td className="px-4 py-3 font-mono text-zinc-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: ownerColor(p.address) }} />
                    <span className="font-semibold">{p.name}</span>
                    <span className="font-mono text-xs text-zinc-500">{shortAddr(p.address)}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{p.trophies}</td>
                <td className="px-4 py-3 text-right font-mono">{p.gold}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {p.wins} / {p.losses}
                </td>
                <td className="px-4 py-3">
                  {STATES.filter((s) => owners[s.id] === p.address)
                    .map((s) => s.code)
                    .join(" ") || <span className="text-zinc-600">-</span>}
                </td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  {isLoading ? "Loading..." : "No monarchs yet. Be the first to register."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
