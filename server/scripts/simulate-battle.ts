/**
 * Plays a full matchmade battle between two scripted, signing players against a running referee.
 * Usage: pnpm --filter ./server simulate
 * Keys come from SIM_KEY_A / SIM_KEY_B (defaults: Anvil accounts 1 and 2). With a contract
 * configured, both accounts must already be registered on-chain.
 */
import { io, type Socket } from "socket.io-client";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signedMessage, type ClientToServerEvents, type ServerToClientEvents } from "@monarch/shared";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const url = process.env.SERVER_URL ?? "http://localhost:4000";
const alice = privateKeyToAccount(
  (process.env.SIM_KEY_A ?? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d") as Hex
);
const bob = privateKeyToAccount(
  (process.env.SIM_KEY_B ?? "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a") as Hex
);

const connect = () =>
  new Promise<ClientSocket>((resolve) => {
    const s: ClientSocket = io(url, { transports: ["websocket"] });
    s.on("connect", () => resolve(s));
  });

function expectOk<T extends { ok: boolean; error?: string }>(label: string, res: T): T {
  if (!res.ok) throw new Error(`${label} failed: ${res.error}`);
  return res;
}

const find = async (s: ClientSocket, account: typeof alice) => {
  const timestamp = Date.now();
  const res = expectOk(
    "match:find",
    await s.emitWithAck("match:find", {
      address: account.address,
      timestamp,
      signature: await account.signMessage({ message: signedMessage.findMatch(timestamp) }),
    })
  );
  return (res as { battleId: string | null }).battleId;
};

const a = await connect();
const b = await connect();

const foundByA = new Promise<string>((resolve) => a.on("match:found", (p) => resolve(p.battleId)));
const queued = await find(a, alice);
console.log(`alice queued (battle=${queued ?? "none yet"})`);
const battleId = (await find(b, bob)) ?? (await foundByA);
console.log(`matched in battle ${battleId} (${alice.address} vs ${bob.address})`);
if ((await foundByA) !== battleId) throw new Error("players were matched into different battles");

const watched = expectOk("watch", await a.emitWithAck("battle:watch", { battleId }));
expectOk("watch", await b.emitWithAck("battle:watch", { battleId }));
const caps = (watched as { battle: { maxLeverage: Record<string, number> } }).battle.maxLeverage;
const capOf = (addr: string) => caps[addr.toLowerCase()] ?? 1;

let ticks = 0;
a.on("battle:tick", (t) => {
  if (++ticks % 4 === 0) console.log(`tick BTC $${t.prices.BTC}`, t.returns);
});

const finished = new Promise<void>((resolve) => {
  a.on("battle:state", (s) => {
    console.log(`phase=${s.phase}${s.entryPrices ? ` entry=${JSON.stringify(s.entryPrices)}` : ""}`);
    if (s.phase === "ended" && (s.txHash || s.settleError)) {
      console.log(`winner=${s.winner} tx=${s.txHash ?? "-"} settleError=${s.settleError ?? "-"}`);
      resolve();
    }
  });
});

for (const [s, acct, side] of [
  [a, alice, "long"],
  [b, bob, "short"],
] as const) {
  const leverage = capOf(acct.address);
  const asset = "BTC";
  expectOk(
    `pick ${side}`,
    await s.emitWithAck("battle:pick", {
      battleId,
      address: acct.address,
      asset,
      side,
      leverage,
      signature: await acct.signMessage({ message: signedMessage.pick(battleId, asset, side, leverage) }),
    })
  );
}

await finished;
a.close();
b.close();
