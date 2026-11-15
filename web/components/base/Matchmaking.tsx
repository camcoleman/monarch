"use client";

import { Link2, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signedMessage } from "@monarch/shared";
import { useGameActions } from "@/hooks/useSession";
import { useSearchingCount } from "@/hooks/useLiveBattles";
import { friendlyError } from "@/lib/errors";
import { getSocket } from "@/lib/socket";
import { HoloModal } from "./ui";

type Status = "signing" | "searching" | "idle" | "error";

/** Attack: queue for a random opponent, or challenge a specific player / open invite link. */
export function MatchmakingModal({ onClose, target }: { onClose: () => void; target?: { address: string; name: string } }) {
  const router = useRouter();
  const { sign, me, session } = useGameActions();
  const searchingCount = useSearchingCount();
  const [status, setStatus] = useState<Status>(target ? "idle" : "signing");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);
  const queued = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const onFound = ({ battleId }: { battleId: string }) => {
      queued.current = false;
      router.push(`/battle/${battleId}`);
    };
    socket.on("match:found", onFound);
    return () => {
      socket.off("match:found", onFound);
      if (queued.current && me.address) socket.emit("match:cancel", { address: me.address }, () => {});
    };
  }, [router, me.address]);

  useEffect(() => {
    if (status !== "searching") return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const fail = (msg: string) => {
    setError(msg);
    setStatus("error");
  };

  const findMatch = async () => {
    if (!me.address) return;
    setError(null);
    setStatus("signing");
    try {
      const timestamp = Date.now();
      const signature = await sign(signedMessage.findMatch(timestamp));
      const res = await getSocket()
        .timeout(15_000)
        .emitWithAck("match:find", { address: me.address, timestamp, signature });
      if (!res.ok) return fail(res.error);
      if (res.battleId) return router.push(`/battle/${res.battleId}`);
      queued.current = true;
      setStatus("searching");
    } catch (err) {
      fail(friendlyError(err));
    }
  };

  const challenge = async (to: string | null) => {
    if (!me.address) return;
    setError(null);
    setStatus("signing");
    try {
      if (queued.current) {
        getSocket().emit("match:cancel", { address: me.address }, () => {});
        queued.current = false;
      }
      const timestamp = Date.now();
      const signature = await sign(signedMessage.challenge(to, timestamp));
      const res = await getSocket()
        .timeout(15_000)
        .emitWithAck("battle:challenge", { address: me.address, target: to, timestamp, signature });
      if (!res.ok) return fail(res.error);
      router.push(`/battle/${res.battleId}`);
    } catch (err) {
      fail(friendlyError(err));
    }
  };

  useEffect(() => {
    if (started.current || target) return;
    started.current = true;
    findMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HoloModal title={target ? `Attack ${target.name}` : "Find a match"} onClose={onClose}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative h-40 w-40 overflow-hidden rounded-full border-2 border-neon/50 bg-slate-950 shadow-[0_0_40px_-8px_#22d3ee]">
          {[0.33, 0.66].map((s) => (
            <span key={s} className="absolute inset-0 m-auto rounded-full border border-neon/30" style={{ width: `${s * 100}%`, height: `${s * 100}%` }} />
          ))}
          <span className="absolute inset-x-0 top-1/2 h-px bg-neon/25" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-neon/25" />
          {(status === "searching" || status === "signing") && <span className="radar-sweep absolute inset-0 rounded-full" />}
          <Swords className="absolute inset-0 m-auto text-orange-400 drop-shadow-[0_0_10px_#f97316]" size={44} />
        </div>

        {target ? (
          <p className="text-zinc-300">
            Challenge <b className="text-gold">{target.name}</b> to a BTC battle. They get an invite link; winner takes land, gold and
            trophies.
          </p>
        ) : status === "searching" ? (
          <div className="space-y-1">
            <p className="hud-text font-display text-lg font-bold">Scanning for opponents...</p>
            <p className="text-sm text-zinc-400">
              {elapsed}s · {Math.max(1, searchingCount)} commander{searchingCount === 1 ? "" : "s"} searching
            </p>
          </div>
        ) : status === "signing" ? (
          <p className="text-sm text-zinc-300">{session.active ? "Engaging..." : "Sign the request in your wallet..."}</p>
        ) : null}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid w-full gap-2">
          {target ? (
            <button className="btn-gold gap-2 text-lg" disabled={status === "signing"} onClick={() => challenge(target.address)}>
              <Swords size={20} /> {status === "signing" ? "Signing..." : "Send challenge"}
            </button>
          ) : (
            <>
              {status === "error" && (
                <button className="btn-gold gap-2" onClick={findMatch}>
                  <Swords size={18} /> Try again
                </button>
              )}
              <button className="btn-neon gap-2" disabled={status === "signing"} onClick={() => challenge(null)}>
                <Link2 size={18} /> Invite a friend instead
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
        {!session.active && (
          <p className="text-xs text-zinc-500">Tip: turn on Fast Mode (top right) to skip wallet pop-ups during battles.</p>
        )}
      </div>
    </HoloModal>
  );
}
