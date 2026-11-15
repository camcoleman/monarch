import { monadTestnet } from "@monarch/shared";

export const MONARCH_ADDRESS = (process.env.NEXT_PUBLIC_MONARCH_ADDRESS || undefined) as `0x${string}` | undefined;
export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const explorerTx = (hash: string) => `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${monadTestnet.blockExplorers.default.url}/address/${addr}`;
