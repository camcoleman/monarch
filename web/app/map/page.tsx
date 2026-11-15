"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSignMessage } from "wagmi";
import { STATES, signedMessage } from "@monarch/shared";
import { RegisterCard } from "@/components/RegisterCard";
import { USMap } from "@/components/USMap";
import { useMe, usePlayers, useStateOwners } from "@/hooks/useMonarch";
import { useOpenBattles } from "@/hooks/useOpenBattles";
import { MONARCH_ADDRESS } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { ownerColor, shortAddr } from "@/lib/format";
import { getSocket } from "@/lib/socket";

export default function MapPage() {
  const router = useRouter();
  const me = useMe();
  const { owners } = useStateOwners();
  const { players, byAddress } = usePlayers();
  const openBattles = useOpenBattles();
  const [selected, setSelected] = useState<number | null>(0);
  const [creating, setCreating] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const [error, setError] = useState<string | null>(null);

  const besieged = useMemo(() => new Set(openBattles.map((b) => b.stateId)), [openBattles]);
  const nameOf = (addr: string) => byAddress.get(addr)?.name ?? shortAddr(addr);

  const state = selected !== null ? STATES[selected] : null;
  const owner = selected !== null ? owners[selected] ?? null : null;
  const siege = openBattles.find((b) => b.stateId === selected);
  const rulers = players.filter((p) => p.statesOwned > 0).sort((a, b) => b.statesOwned - a.statesOwned);

  const canAct = Boolean(me.address && (me.player || !MONARCH_ADDRESS));

  const declareWar = async () => {
    if (selected === null || !me.address || !canAct) return;
    setCreating(true);
    setError(null);
    try {
      const timestamp = Date.now();
      let signature: string;
      try {
        signature = await signMessageAsync({ message: signedMessage.create(selected, timestamp) });
      } catch (err) {
        setError(friendlyError(err));
        return;
      }
      const res = await getSocket()
        .timeout(10_000)
        .emitWithAck("battle:create", {
          stateId: selected,
          address: me.address,
          name: me.player?.name ?? shortAddr(me.address),
          timestamp,
          signature,
        });
      if (res.ok) router.push(`/battle/${res.battleId}`);
      else setError(res.error);
    } catch {
      setError("Referee server did not respond");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="panel p-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <h1 className="font-display text-2xl">The Conquest</h1>
          <p className="text-sm text-zinc-500">{owners.filter(Boolean).length} / {STATES.length} states claimed</p>
        </div>
        <USMap owners={owners} selected={selected} besieged={besieged} onSelect={setSelected} />
      </section>

      <aside className="space-y-4">
        {state && (
          <div className="panel space-y-3 p-5">
            <p className="text-sm uppercase tracking-widest text-zinc-500">{state.code}</p>
            <h2 className="font-display text-3xl text-gold">{state.name}</h2>
            <p className="text-sm text-zinc-400">
              {owner ? (
                <>
                  Ruled by{" "}
                  <span className="font-semibold" style={{ color: ownerColor(owner) }}>
                    {nameOf(owner)}
                  </span>
                  {owner === me.address && " (you)"}
                </>
              ) : (
                "Neutral territory - free to claim."
              )}
            </p>

            {siege ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">
                  ⚔️ Under siege by <b>{siege.creator.name}</b>
                  {siege.opponent ? ` vs ${siege.opponent.name}` : ""} ({siege.phase})
                </p>
                <Link href={`/battle/${siege.id}`} className="btn-gold w-full">
                  {siege.phase === "lobby" && siege.creator.address !== me.address ? "View challenge" : "Watch battle"}
                </Link>
              </div>
            ) : canAct ? (
              <button className="btn-gold w-full" disabled={creating} onClick={declareWar}>
                {creating
                  ? "Raising armies..."
                  : owner === me.address
                    ? "Defend - open a challenge"
                    : owner
                      ? `Challenge ${nameOf(owner)}`
                      : "Declare war"}
              </button>
            ) : null}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}

        <RegisterCard compact />

        <div className="panel p-5">
          <h3 className="mb-2 font-semibold">Active battles</h3>
          {openBattles.length === 0 ? (
            <p className="text-sm text-zinc-500">No battles right now. Start one!</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openBattles.map((b) => (
                <li key={b.id}>
                  <Link href={`/battle/${b.id}`} className="flex justify-between hover:text-gold">
                    <span>
                      {STATES[b.stateId].code} · {b.creator.name}
                      {b.opponent ? ` vs ${b.opponent.name}` : ""}
                    </span>
                    <span className="text-zinc-500">{b.phase}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="mb-2 font-semibold">Rulers</h3>
          {rulers.length === 0 ? (
            <p className="text-sm text-zinc-500">No one rules yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {rulers.map((p) => (
                <li key={p.address} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: ownerColor(p.address) }} />
                    {p.name}
                  </span>
                  <span className="text-zinc-400">
                    {STATES.filter((s) => owners[s.id] === p.address)
                      .map((s) => s.code)
                      .join(" ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
