"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Village } from "@/components/village/Village";
import { usePlayer } from "@/hooks/useMonarch";

export default function KingdomPage() {
  const { address } = useParams<{ address: string }>();
  const { player, isLoading } = usePlayer(address);

  if (isLoading) return <p className="pt-20 text-center text-zinc-400">Scouting kingdom...</p>;
  if (!player) {
    return (
      <div className="panel mx-auto max-w-md space-y-3 p-6 text-center">
        <p>No kingdom found at this address.</p>
        <Link href="/leaderboard" className="btn-gold">
          Back to leaderboard
        </Link>
      </div>
    );
  }
  return <Village player={player} readOnly />;
}
