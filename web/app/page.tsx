"use client";

import { Landing } from "@/components/Landing";
import { Village } from "@/components/village/Village";
import { useMe } from "@/hooks/useMonarch";

export default function Home() {
  const { player, isConnected, isLoading } = useMe();
  if (isConnected && isLoading) return <p className="pt-20 text-center text-zinc-400">Entering your kingdom...</p>;
  return player ? <Village player={player} /> : <Landing />;
}
