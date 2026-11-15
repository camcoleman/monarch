"use client";

import { Swords, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signedMessage } from "@monarch/shared";
import { useLiveBattles } from "@/hooks/useLiveBattles";
import { useGameActions } from "@/hooks/useSession";
import { friendlyError } from "@/lib/errors";
import { getSocket } from "@/lib/socket";

/** Direct challenges addressed to this player, with an inline Accept. */
export function IncomingChallenges({ address }: { address: string }) {
  const router = useRouter();
  const live = useLiveBattles();
  const { sign } = useGameActions();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const incoming = live.filter(
    (b) => b.phase === "lobby" && b.requiredOpponent === address && b.creator.address !== address && !dismissed.has(b.id)
  );
  if (incoming.length === 0) return null;

  const accept = async (battleId: string) => {
    setJoining(battleId);
    setError(null);
    try {
      const signature = await sign(signedMessage.join(battleId));
      const res = await getSocket().timeout(10_000).emitWithAck("battle:join", { battleId, address, signature });
      if (res.ok) router.push(`/battle/${battleId}`);
      else setError(res.error);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-24 z-[180] flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:top-16">
      {incoming.map((b) => (
        <div key={b.id} className="panel pop-in flex items-center gap-3 p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#1d1206] bg-[linear-gradient(180deg,#ff7552,#c0261a)] text-white">
            <Swords size={24} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight">{b.creator.name} challenges you!</p>
            <p className="text-xs text-muted">Win to take land, gold and trophies.</p>
          </div>
          <button className="btn-green px-3 py-1.5 text-base" disabled={joining !== null} onClick={() => accept(b.id)}>
            {joining === b.id ? "Joining..." : "Accept"}
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0!"
            aria-label="Dismiss"
            onClick={() => setDismissed((d) => new Set(d).add(b.id))}
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>
      ))}
      {error && <p className="panel px-3 py-1.5 text-sm font-bold text-down">{error}</p>}
    </div>
  );
}
