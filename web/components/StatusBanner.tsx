"use client";

import { useEffect, useState } from "react";
import { MONARCH_ADDRESS, SERVER_URL } from "@/lib/config";
import { useServerConnected } from "@/lib/priceStore";

export function StatusBanner() {
  const connected = useServerConnected();
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (connected) return setShowOffline(false);
    const id = setTimeout(() => setShowOffline(true), 3000);
    return () => clearTimeout(id);
  }, [connected]);

  if (MONARCH_ADDRESS && !showOffline) return null;
  return (
    <div className="mx-auto mt-3 max-w-6xl space-y-2 px-4 text-sm font-bold">
      {!MONARCH_ADDRESS && (
        <div className="panel px-4 py-2 text-[#b07800]">
          Contract not configured: set <code>NEXT_PUBLIC_MONARCH_ADDRESS</code> in <code>web/.env.local</code> to enable
          registration, villages, and the leaderboard.
        </div>
      )}
      {showOffline && (
        <div className="panel px-4 py-2 text-down">
          Can&apos;t reach the referee server at <code>{SERVER_URL}</code>. Start it with <code>pnpm dev:server</code>.
        </div>
      )}
    </div>
  );
}
