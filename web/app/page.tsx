"use client";

import { Landing } from "@/components/Landing";
import { Base } from "@/components/base/Base";
import { useMe } from "@/hooks/useMonarch";

export default function Home() {
  const { player, isConnected, isLoading } = useMe();
  if (isConnected && isLoading) {
    return <p className="hud-text pt-24 text-center font-display tracking-widest">ENTERING BASE...</p>;
  }
  return player ? <Base player={player} /> : <Landing />;
}
