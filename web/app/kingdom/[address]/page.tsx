"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Base } from "@/components/base/Base";
import { usePlayer } from "@/hooks/useMonarch";

export default function ScoutPage() {
  const { address } = useParams<{ address: string }>();
  const { player, isLoading } = usePlayer(address);

  if (isLoading) return <p className="hud-text pt-24 text-center font-display tracking-widest">SCOUTING BASE...</p>;
  if (!player) {
    return (
      <div className="panel mx-auto max-w-md space-y-3 p-6 text-center">
        <p>No base found at this address.</p>
        <Link href="/leaderboard" className="btn-gold">
          Back to rankings
        </Link>
      </div>
    );
  }
  return <Base player={player} readOnly />;
}
