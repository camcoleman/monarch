import "dotenv/config";
import { ROUND_SECONDS } from "@monarch/shared";

type Hex = `0x${string}`;

const env = (key: string) => process.env[key] || undefined;

function parseOrigins(raw: string): string | string[] {
  const list = raw.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

export const config = {
  port: Number(env("PORT") ?? 4000),
  // "*" or a comma-separated list of allowed origins (e.g. prod + preview Vercel URLs)
  corsOrigin: parseOrigins(env("CORS_ORIGIN") ?? "*"),
  priceMode: (env("PRICE_MODE") === "mock" ? "mock" : "live") as "live" | "mock",
  roundSeconds: Number(env("ROUND_SECONDS") ?? ROUND_SECONDS),
  pickSeconds: Number(env("PICK_SECONDS") ?? 15),
  rpcUrl: env("RPC_URL") ?? "https://testnet-rpc.monad.xyz",
  contractAddress: env("CONTRACT_ADDRESS") as Hex | undefined,
  refereeKey: env("REFEREE_PRIVATE_KEY") as Hex | undefined,
};

export type Config = typeof config;
