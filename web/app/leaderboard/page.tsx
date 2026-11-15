"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MAX_LAND, leagueFor } from "@monarch/shared";
import { LeagueBadge } from "@/components/base/ui";
import { useMe, usePlayers } from "@/hooks/useMonarch";
import { shortAddr } from "@/lib/format";

type SortKey = "trophies" | "land";

export default function LeaderboardPage() {
  const { players, isLoading } = usePlayers();
  const { address } = useMe();
  const [sort, setSort] = useState<SortKey>("trophies");

  const ranked = useMemo(
    () =>
      [...players].sort((a, b) =>
        sort === "trophies" ? b.trophies - a.trophies || b.wins - a.wins : b.land - a.land || b.trophies - a.trophies
      ),
    [players, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-2xl font-black uppercase tracking-wider">Rankings</h1>
        <div className="flex gap-1 rounded-xl border border-edge p-1 text-sm">
          {(["trophies", "land"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-lg px-3 py-1 font-display text-xs uppercase tracking-wider ${
                sort === k ? "bg-neon text-ink" : "text-zinc-400"
              }`}
            >
              {k === "trophies" ? "Trophies" : "Territory"}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-edge font-display text-[11px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Commander</th>
              <th className="px-4 py-3">League</th>
              <th className="px-4 py-3 text-right">Trophies</th>
              <th className="px-4 py-3 text-right">Territory</th>
              <th className="px-4 py-3 text-right">Gold</th>
              <th className="px-4 py-3 text-right">W / L</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const { league } = leagueFor(p.trophies);
              return (
                <tr key={p.address} className={`border-b border-edge/50 ${p.address === address ? "bg-neon/10" : ""}`}>
                  <td className="px-4 py-3 font-display text-zinc-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/kingdom/${p.address}`} className="font-semibold hover:text-neon">
                      {p.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-zinc-500">{shortAddr(p.address)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: league.color }}>
                      <LeagueBadge trophies={p.trophies} size={20} /> {league.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{p.trophies}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.land}/{MAX_LAND}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{p.gold}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.wins} / {p.losses}
                  </td>
                </tr>
              );
            })}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  {isLoading ? "Loading..." : "No commanders yet. Be the first to register."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-center text-xs text-zinc-500">Tap a commander to scout their base and attack them directly.</p>
    </div>
  );
}
