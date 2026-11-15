"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { FAUCET_URL, monadTestnet, monarchAbi } from "@monarch/shared";
import { useMe } from "@/hooks/useMonarch";
import { MONARCH_ADDRESS } from "@/lib/config";
import { friendlyError } from "@/lib/errors";

/** Walks the user through connect, switch to Monad Testnet, and on-chain registration. */
export function RegisterCard({ compact = false }: { compact?: boolean }) {
  const { isConnected, player, isLoading, refetch } = useMe();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [name, setName] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: monadTestnet.id });

  useEffect(() => {
    if (receipt.isSuccess) refetch();
  }, [receipt.isSuccess, refetch]);

  if (player) {
    if (compact) return null;
    return (
      <div className="panel p-5">
        <p className="text-sm text-zinc-400">Welcome back,</p>
        <p className="font-display text-2xl text-gold">{player.name}</p>
        <p className="mt-2 text-sm text-zinc-400">
          🏆 {player.trophies} trophies · {player.gold} gold · {player.land} land · {player.wins}W/{player.losses}L
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-3 p-5">
      <h3 className="font-display text-xl text-gold">Claim your base</h3>
      {!isConnected ? (
        <>
          <p className="text-sm text-zinc-400">Connect a wallet on Monad Testnet to start building.</p>
          <ConnectButton />
        </>
      ) : chainId !== monadTestnet.id ? (
        <button className="btn-gold" disabled={switching} onClick={() => switchChain({ chainId: monadTestnet.id })}>
          Switch to Monad Testnet
        </button>
      ) : !MONARCH_ADDRESS ? (
        <p className="text-sm text-zinc-400">Waiting for the contract address to be configured.</p>
      ) : isLoading ? (
        <p className="text-sm text-zinc-400">Checking registration...</p>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            writeContract({
              address: MONARCH_ADDRESS!,
              abi: monarchAbi,
              functionName: "register",
              args: [name.trim()],
              chainId: monadTestnet.id,
            });
          }}
        >
          <input
            className="input flex-1"
            placeholder="Commander name"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-gold" disabled={!name.trim() || isPending || receipt.isLoading}>
            {isPending ? "Confirm in wallet..." : receipt.isLoading ? "Deploying base..." : "Register"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-400">{friendlyError(error)}</p>}
      <p className="text-xs text-zinc-500">
        Need gas?{" "}
        <a className="text-royal underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
          Get testnet MON from the faucet
        </a>
        .
      </p>
    </div>
  );
}
