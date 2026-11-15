"use client";

import { Bot, Link2, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { REALMS, signedMessage } from "@monarch/shared";
import { useGameActions } from "@/hooks/useSession";
import { useSearchingCount } from "@/hooks/useLiveBattles";
import { friendlyError } from "@/lib/errors";
import { startPractice } from "@/lib/practice";
import { getSocket } from "@/lib/socket";
import { ClashModal } from "./ui";

type Status = "idle" | "signing" | "searching" | "error";

/** Attack: queue for a random opponent, practice against the bot, or challenge a specific player / open invite link. */
export function MatchmakingModal({
  onClose,
  target,
  realm = null,
}: {
  onClose: () => void;
  target?: { address: string; name: string };
  /** When set, the battle is fought over this shared realm. */
  realm?: number | null;
}) {
  const router = useRouter();
  const { sign, me, session } = useGameActions();
  const searchingCount = useSearchingCount();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
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

  const leaveQueue = () => {
    if (queued.current && me.address) getSocket().emit("match:cancel", { address: me.address }, () => {});
    queued.current = false;
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

  const practice = async () => {
    setError(null);
    setStatus("signing");
    leaveQueue();
    try {
      router.push(`/battle/${await startPractice(me.address)}`);
    } catch (err) {
      fail(friendlyError(err));
    }
  };

  const challenge = async (to: string | null) => {
    if (!me.address) return;
    setError(null);
    setStatus("signing");
    leaveQueue();
    try {
      const timestamp = Date.now();
      const signature = await sign(signedMessage.challenge(to, timestamp, realm));
      const res = await getSocket()
        .timeout(15_000)
        .emitWithAck("battle:challenge", { address: me.address, target: to, realm, timestamp, signature });
      if (!res.ok) return fail(res.error);
      router.push(`/battle/${res.battleId}`);
    } catch (err) {
      fail(friendlyError(err));
    }
  };

  const busy = status === "signing";
  const realmName = realm != null ? REALMS[realm]?.name : null;
  const title = realmName
    ? target
      ? `Battle for ${realmName}`
      : `Claim ${realmName}`
    : target
      ? `Attack ${target.name}`
      : "Attack!";

  return (
    <ClashModal title={title} onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center">
        <SearchScene searching={status === "searching" || busy} />

        {target || realmName ? (
          <p>
            {realmName ? (
              <>
                Fight over <b>{realmName}</b>
                {target ? (
                  <>
                    {" "}
                    against <b>{target.name}</b>
                  </>
                ) : (
                  <> — send an invite link; the winner conquers the realm</>
                )}
                . The winner takes the realm, gold and trophies.
              </>
            ) : (
              <>
                Challenge <b>{target!.name}</b> to a trading battle. They get an invite link; the winner takes land, gold and
                trophies.
              </>
            )}
          </p>
        ) : status === "searching" ? (
          <div className="space-y-1">
            <p className="font-display text-xl">Searching for opponents...</p>
            <p className="text-sm text-muted">
              {elapsed}s · {Math.max(1, searchingCount)} commander{searchingCount === 1 ? "" : "s"} searching
            </p>
          </div>
        ) : busy ? (
          <p className="text-sm">{session.active ? "Getting ready..." : "Sign the request in your wallet..."}</p>
        ) : (
          <p className="text-sm text-muted">Battle a rival for loot and territory, or warm up against the Training Bot.</p>
        )}

        {error && <p className="text-sm font-bold text-down">{error}</p>}

        <div className="grid w-full gap-2.5">
          {target ? (
            <button className="btn-red text-xl" disabled={busy} onClick={() => challenge(target.address)}>
              <Swords size={22} strokeWidth={3} /> {busy ? "Signing..." : "Send challenge"}
            </button>
          ) : realmName ? (
            <button className="btn-gold text-xl" disabled={busy} onClick={() => challenge(null)}>
              <Link2 size={20} strokeWidth={3} /> {busy ? "Signing..." : "Create invite"}
            </button>
          ) : (
            <>
              {status !== "searching" && (
                <button className="btn-red text-xl" disabled={busy} onClick={findMatch}>
                  <Swords size={22} strokeWidth={3} /> Find a match
                </button>
              )}
              <button className="btn-green text-lg" disabled={busy} onClick={practice}>
                <Bot size={20} strokeWidth={3} /> Practice vs Bot
              </button>
              <button className="btn-blue text-base" disabled={busy} onClick={() => challenge(null)}>
                <Link2 size={18} strokeWidth={3} /> Invite a friend
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={onClose}>
            {status === "searching" ? "Stop searching" : "Cancel"}
          </button>
        </div>
        {!target && !realmName && (
          <p className="text-xs text-muted">
            Practice battles are free and off-chain: no rewards, no wallet pop-ups.
            {!session.active && " Turn on Fast Mode to skip pop-ups in real battles too."}
          </p>
        )}
      </div>
    </ClashModal>
  );
}

/** Crossed swords over drifting clouds, Clash's "searching" screen in miniature. */
function SearchScene({ searching }: { searching: boolean }) {
  return (
    <div className="relative h-32 w-full overflow-hidden rounded-2xl border-[3px] border-[#1d1206] bg-[linear-gradient(180deg,#7fd0ff,#bfeaff)]">
      {[
        { left: "4%", top: "18%", w: 90 },
        { left: "58%", top: "8%", w: 110 },
        { left: "30%", top: "56%", w: 120 },
      ].map((c, i) => (
        <svg
          key={i}
          viewBox="0 0 100 50"
          className={`absolute ${searching ? "cloud-drift" : ""}`}
          style={{ left: c.left, top: c.top, width: c.w, animationDelay: `${i * 0.6}s` }}
        >
          <path
            d="M20 45a15 15 0 0 1 2-30 20 20 0 0 1 37-6 16 16 0 0 1 27 10 13 13 0 0 1-3 26Z"
            fill="#fff"
            stroke="#1d1206"
            strokeWidth="2.5"
          />
        </svg>
      ))}
      <Swords
        size={58}
        strokeWidth={2.5}
        className={`absolute inset-0 m-auto text-white drop-shadow-[0_3px_0_#1d1206] ${searching ? "swords-spin" : ""}`}
      />
    </div>
  );
}
