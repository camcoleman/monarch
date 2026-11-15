"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createWalletClient, http, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useBalance, usePublicClient, useReadContract, useSignMessage, useWriteContract } from "wagmi";
import { monadTestnet, monarchAbi } from "@monarch/shared";
import { MONARCH_ADDRESS, RPC_URL } from "@/lib/config";
import { useMe } from "./useMonarch";

const SESSION_DAYS = 7;
export const SESSION_FUNDING = "0.05";
/** Below this the session key can't reliably pay gas, so transactions fall back to the wallet. */
const MIN_KEY_BALANCE = 0.004;

interface Stored {
  pk: Hex;
  expiry: number;
}

const storageKey = (player: string) => `monarch:session:${MONARCH_ADDRESS}:${player}`;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}

function readRaw(player?: string) {
  if (!player || typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(player));
}

/** A browser-held key the player authorizes on-chain so the game can act without wallet pop-ups. */
export function useSession(player?: string) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(player), () => null);
  const stored = useMemo<Stored | null>(() => (raw ? JSON.parse(raw) : null), [raw]);
  const account = useMemo(() => (stored ? privateKeyToAccount(stored.pk) : null), [stored]);

  const onchain = useReadContract({
    address: MONARCH_ADDRESS,
    abi: monarchAbi,
    chainId: monadTestnet.id,
    functionName: "sessions",
    args: account ? [account.address] : undefined,
    query: { enabled: Boolean(MONARCH_ADDRESS && account), refetchInterval: 30_000 },
  });
  const balance = useBalance({
    address: account?.address,
    chainId: monadTestnet.id,
    query: { enabled: Boolean(account), refetchInterval: 15_000 },
  });

  const active = Boolean(
    player &&
      onchain.data &&
      onchain.data[0].toLowerCase() === player &&
      Number(onchain.data[1]) * 1000 > Date.now()
  );
  const keyBalance = balance.data ? Number(balance.data.value) / 1e18 : 0;

  const walletClient = useMemo(
    () => (account ? createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) }) : null),
    [account]
  );

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  const start = useCallback(async () => {
    if (!player || !MONARCH_ADDRESS || !publicClient) return;
    const pk = generatePrivateKey();
    const key = privateKeyToAccount(pk);
    const expiry = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
    const hash = await writeContractAsync({
      address: MONARCH_ADDRESS,
      abi: monarchAbi,
      chainId: monadTestnet.id,
      functionName: "startSession",
      args: [key.address, BigInt(expiry)],
      value: parseEther(SESSION_FUNDING),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Session transaction reverted");
    window.localStorage.setItem(storageKey(player), JSON.stringify({ pk, expiry } satisfies Stored));
    notify();
    await Promise.all([onchain.refetch(), balance.refetch()]);
  }, [player, publicClient, writeContractAsync, onchain, balance]);

  const end = useCallback(async () => {
    if (!player) return;
    if (active && walletClient && MONARCH_ADDRESS && keyBalance > MIN_KEY_BALANCE) {
      try {
        await walletClient.writeContract({ address: MONARCH_ADDRESS, abi: monarchAbi, functionName: "endSession" });
      } catch {
        // The key is dropped locally either way.
      }
    }
    window.localStorage.removeItem(storageKey(player));
    notify();
  }, [player, active, walletClient, keyBalance]);

  return {
    account,
    active,
    keyBalance,
    canPayGas: active && keyBalance > MIN_KEY_BALANCE,
    walletClient,
    start,
    end,
    refetch: () => Promise.all([onchain.refetch(), balance.refetch()]),
  };
}

/**
 * Signing and contract writes for game actions. Uses the session key when one is live
 * (no wallet pop-up), otherwise the connected wallet.
 */
export function useGameActions() {
  const me = useMe();
  const session = useSession(me.address);
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  const sign = useCallback(
    (message: string): Promise<Hex> =>
      session.active && session.account ? session.account.signMessage({ message }) : signMessageAsync({ message }),
    [session.active, session.account, signMessageAsync]
  );

  const send = useCallback(
    async (call: { functionName: "upgrade"; args: [number] } | { functionName: "collect"; args?: undefined }) => {
      if (!MONARCH_ADDRESS || !publicClient) throw new Error("No contract configured");
      const request = { address: MONARCH_ADDRESS, abi: monarchAbi, ...call } as const;
      const hash =
        session.canPayGas && session.walletClient
          ? await session.walletClient.writeContract(request)
          : await writeContractAsync({ ...request, chainId: monadTestnet.id });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      session.refetch();
      return hash;
    },
    [publicClient, session, writeContractAsync]
  );

  return { sign, send, session, me };
}
