"use client";

import { Landing } from "@/components/Landing";
import { Base } from "@/components/base/Base";
import { useMe } from "@/hooks/useMonarch";
import { MONARCH_ADDRESS } from "@/lib/config";

export default function Home() {
  const { player, isConnected, isLoading, isError, refetch } = useMe();
  if (isConnected && isLoading) {
    return <p className="clash-text pt-24 text-center font-display text-2xl">Entering village...</p>;
  }
  if (isConnected && isError && !player) {
    return (
      <div className="panel mx-auto mt-16 max-w-md space-y-3 p-6 text-center">
        <p className="font-display text-2xl">Can&apos;t reach your village</p>
        <p className="text-sm text-muted">
          The MONARCH contract at <span className="break-all font-mono">{MONARCH_ADDRESS}</span> didn&apos;t answer on Monad Testnet.
        </p>
        <button className="btn-green px-4 py-2" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }
  return player ? <Base player={player} /> : <Landing />;
}
