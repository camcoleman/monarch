"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MAX_LAND, leagueFor } from "@monarch/shared";
import { KingdomMap } from "@/components/KingdomMap";
import { GoldCoin, LandIcon, LeagueBadge, TrophyIcon } from "@/components/base/ui";
import { useMe, usePlayers } from "@/hooks/useMonarch";
import { shortAddr } from "@/lib/format";

type Tab = "trophies" | "territory";

export default function LeaderboardPage() {
  const { players, isLoading } = usePlayers();
  const { address } = useMe();
  const [tab, setTab] = useState<Tab>("trophies");

  const ranked = useMemo(() => [...players].sort((a, b) => b.trophies - a.trophies || b.wins - a.wins), [players]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="clash-text font-display text-4xl">{tab === "trophies" ? "Top Players" : "Kingdom Map"}</h1>
        <div className="flex gap-2">
          {(["trophies", "territory"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-base ${tab === k ? "btn-blue" : "btn-ghost"}`}>
              {k === "trophies" ? "Trophies" : "Territory"}
            </button>
          ))}
        </div>
      </div>

      {tab === "territory" ? (
        <KingdomMap players={players} me={address} />
      ) : (
        <>
          <div className="panel overflow-hidden">
            <div className="wood-header grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-2 sm:grid-cols-[3rem_1fr_9rem_6rem_6rem_6rem_6rem]">
              {["#", "Commander", "League", "Trophies", "Territory", "Gold", "W / L"].map((h, i) => (
                <span key={h} className={`clash-text font-display text-sm ${i >= 2 ? "hidden sm:block" : ""} ${i >= 3 ? "text-right" : ""}`}>
                  {h}
                </span>
              ))}
              <span className="clash-text text-right font-display text-sm sm:hidden">Trophies</span>
            </div>
            <ol className="divide-y-2 divide-[#e6d1a0]">
              {ranked.map((p, i) => {
                const { league } = leagueFor(p.trophies);
                const mine = p.address === address;
                return (
                  <li
                    key={p.address}
                    className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[3rem_1fr_9rem_6rem_6rem_6rem_6rem] ${
                      mine ? "bg-[#fff3a0]" : i % 2 ? "bg-[#efdfb8]" : ""
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#1d1206] font-display text-white ${
                        i === 0 ? "bg-[#ffbf1f]" : i === 1 ? "bg-[#b8c2cc]" : i === 2 ? "bg-[#d08a4a]" : "bg-[#8b5a2b]"
                      }`}
                      style={{ textShadow: "0 1px 0 #1d1206" }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/kingdom/${p.address}`} className="font-display text-lg hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-muted">{shortAddr(p.address)}</span>
                    </span>
                    <span className="hidden items-center gap-1.5 font-display text-sm sm:flex" style={{ color: league.color }}>
                      <LeagueBadge trophies={p.trophies} size={22} />
                      <span style={{ textShadow: "0 1px 0 #1d1206" }}>{league.name}</span>
                    </span>
                    <span className="flex items-center justify-end gap-1 font-display">
                      <TrophyIcon size={18} /> {p.trophies}
                    </span>
                    <span className="hidden items-center justify-end gap-1 font-display sm:flex">
                      <LandIcon size={18} /> {p.land}/{MAX_LAND}
                    </span>
                    <span className="hidden items-center justify-end gap-1 font-display sm:flex">
                      <GoldCoin size={16} /> {p.gold}
                    </span>
                    <span className="hidden text-right font-display sm:block">
                      {p.wins} / {p.losses}
                    </span>
                  </li>
                );
              })}
              {ranked.length === 0 && (
                <li className="px-4 py-8 text-center text-muted">{isLoading ? "Loading..." : "No commanders yet. Be the first to build a village."}</li>
              )}
            </ol>
          </div>
          <p className="clash-text text-center font-display text-sm">Tap a commander to scout their village and attack them directly.</p>
        </>
      )}
    </div>
  );
}
