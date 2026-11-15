"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { monadTestnet } from "@monarch/shared";
import { getSocket } from "@/lib/socket";
import { wagmiConfig } from "@/lib/wagmi";

/** Refetch contract reads as soon as the referee reports a settlement. */
function ChainSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const onUpdate = () => queryClient.invalidateQueries();
    socket.on("chain:updated", onUpdate);
    return () => {
      socket.off("chain:updated", onUpdate);
    };
  }, [queryClient]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={monadTestnet}
          theme={darkTheme({ accentColor: "#f5b301", accentColorForeground: "#0b0a12", borderRadius: "large" })}
        >
          <ChainSync />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
