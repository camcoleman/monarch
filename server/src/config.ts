import "dotenv/config";

type Hex = `0x${string}`;

const env = (key: string) => process.env[key] || undefined;

export const config = {
  port: Number(env("PORT") ?? 4000),
  corsOrigin: env("CORS_ORIGIN") ?? "*",
  priceMode: (env("PRICE_MODE") === "mock" ? "mock" : "live") as "live" | "mock",
  roundSeconds: Number(env("ROUND_SECONDS") ?? 90),
  pickSeconds: Number(env("PICK_SECONDS") ?? 15),
  rpcUrl: env("RPC_URL") ?? "https://testnet-rpc.monad.xyz",
  contractAddress: env("CONTRACT_ADDRESS") as Hex | undefined,
  refereeKey: env("REFEREE_PRIVATE_KEY") as Hex | undefined,
};

export type Config = typeof config;
