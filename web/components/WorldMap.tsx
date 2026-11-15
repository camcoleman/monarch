"use client";

import { useMemo, useState } from "react";
import { REALMS } from "@monarch/shared";
import { MatchmakingModal } from "@/components/base/Matchmaking";
import { useMe, usePlayers, useRealms } from "@/hooks/useMonarch";
import { shortAddr } from "@/lib/format";

const hue = (addr: string) => parseInt(addr.slice(2, 8), 16) % 360;
const territoryColor = (addr: string) => `hsl(${hue(addr)} 85% 55%)`;

/** Shared 4x4 isometric world map. Click a realm to claim it or attack its owner. */
export function WorldMap() {
  const { owners, isLoading } = useRealms();
  const { byAddress } = usePlayers();
  const me = useMe();
  const [selected, setSelected] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<{ realm: number; target?: { address: string; name: string } } | null>(null);

  const nameOf = (addr: string | null) => (addr ? byAddress.get(addr)?.name ?? shortAddr(addr) : null);
  const pick = selected === null ? null : REALMS[selected];
  const owner = selected === null ? null : owners[selected] ?? null;
  const mine = Boolean(me.address && owner === me.address);

  const cells = useMemo(() => REALMS.map((r) => ({ ...r, owner: owners[r.id] ?? null })), [owners]);

  return (
    <div className="space-y-4">
      <div className="panel overflow-hidden p-0">
        <div className="relative mx-auto aspect-[5/3] w-full max-w-3xl bg-[radial-gradient(ellipse_at_center,#4a7a22,#2f5514_70%,#1f3d0c)]">
          <svg viewBox="0 0 800 520" className="absolute inset-0 h-full w-full">
            {cells.map((r) => {
              const cx = 400 + ((r.i - r.j) * 88) / 1;
              const cy = 120 + ((r.i + r.j) * 52) / 1;
              const w = 80;
              const h = 44;
              const pts = `${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`;
              const color = r.owner ? territoryColor(r.owner) : "#6f9431";
              const isSel = selected === r.id;
              return (
                <g key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)}>
                  <polygon
                    points={pts}
                    fill={color}
                    fillOpacity={r.owner ? 0.72 : 0.45}
                    stroke={isSel ? "#fff7c2" : "#1d1206"}
                    strokeWidth={isSel ? 4 : 2}
                    strokeOpacity={isSel ? 1 : 0.55}
                  />
                  <text
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    className="pointer-events-none fill-white font-display text-[13px]"
                    style={{ paintOrder: "stroke", stroke: "#1d1206", strokeWidth: 3 }}
                  >
                    {r.name}
                  </text>
                  <text
                    x={cx}
                    y={cy + 14}
                    textAnchor="middle"
                    className="pointer-events-none fill-[#ffe9b0] font-display text-[10px]"
                    style={{ paintOrder: "stroke", stroke: "#1d1206", strokeWidth: 2.5 }}
                  >
                    {r.owner ? nameOf(r.owner) : "Neutral"}
                  </text>
                </g>
              );
            })}
          </svg>
          {isLoading && <p className="absolute inset-0 flex items-center justify-center font-display text-xl text-white">Loading realms...</p>}
        </div>
      </div>

      {pick && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="clash-text font-display text-2xl">{pick.name}</p>
            <p className="text-sm text-muted">
              {owner ? (
                <>
                  Owned by <span className="font-extrabold" style={{ color: territoryColor(owner) }}>{nameOf(owner)}</span>
                  {mine && " (you)"}
                </>
              ) : (
                "Neutral — claim it by winning a battle here"
              )}
            </p>
          </div>
          {me.address && me.player && !mine && (
            <button
              className={owner ? "btn-red" : "btn-gold"}
              onClick={() =>
                setChallenge({
                  realm: pick.id,
                  target: owner ? { address: owner, name: nameOf(owner) ?? shortAddr(owner) } : undefined,
                })
              }
            >
              {owner ? `Attack ${nameOf(owner)}` : "Claim"}
            </button>
          )}
          {mine && <p className="font-display text-sm text-[#b07800]">Defend this realm when someone challenges you.</p>}
          {!me.player && me.isConnected && <p className="text-sm text-muted">Register a base to conquer realms.</p>}
          {!me.isConnected && <p className="text-sm text-muted">Connect a wallet to claim or attack.</p>}
        </div>
      )}

      {challenge && (
        <MatchmakingModal
          onClose={() => setChallenge(null)}
          target={challenge.target}
          realm={challenge.realm}
        />
      )}
    </div>
  );
}
