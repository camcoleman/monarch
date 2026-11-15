/**
 * Plays a full battle between two scripted, signing players against a running referee.
 * Usage: pnpm --filter ./server simulate [stateId]
 * Keys come from SIM_KEY_A / SIM_KEY_B (defaults: Anvil accounts 1 and 2). With a contract
 * configured, both accounts must already be registered on-chain.
 */
import { io, type Socket } from "socket.io-client";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signedMessage, type ClientToServerEvents, type ServerToClientEvents } from "@monarch/shared";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const url = process.env.SERVER_URL ?? "http://localhost:4000";
const stateId = Number(process.argv[2] ?? 0);
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

const a = await connect();
const b = await connect();

const timestamp = Date.now();
const created = expectOk(
  "create",
  await a.emitWithAck("battle:create", {
    stateId,
    address: alice.address,
    name: "Alice",
    timestamp,
    signature: await alice.signMessage({ message: signedMessage.create(stateId, timestamp) }),
  })
);
const battleId = (created as { battleId: string }).battleId;
console.log(`created battle ${battleId} (${alice.address} vs ${bob.address})`);

expectOk("watch", await a.emitWithAck("battle:watch", { battleId }));
expectOk("watch", await b.emitWithAck("battle:watch", { battleId }));

let ticks = 0;
a.on("battle:tick", (t) => {
  if (++ticks % 4 === 0) console.log(`tick $${t.price}`, t.returns);
});

const finished = new Promise<void>((resolve) => {
  a.on("battle:state", (s) => {
    console.log(`phase=${s.phase}${s.entryPrice ? ` entry=$${s.entryPrice}` : ""}`);
    if (s.phase === "ended" && (s.txHash || s.settleError)) {
      console.log(`winner=${s.winner} tx=${s.txHash ?? "-"} settleError=${s.settleError ?? "-"}`);
      resolve();
    }
  });
});

expectOk(
  "join",
  await b.emitWithAck("battle:join", {
    battleId,
    address: bob.address,
    name: "Bob",
    signature: await bob.signMessage({ message: signedMessage.join(battleId) }),
  })
);
expectOk(
  "pick A",
  await a.emitWithAck("battle:pick", {
    battleId,
    address: alice.address,
    side: "long",
    leverage: 5,
    signature: await alice.signMessage({ message: signedMessage.pick(battleId, "long", 5) }),
  })
);
expectOk(
  "pick B",
  await b.emitWithAck("battle:pick", {
    battleId,
    address: bob.address,
    side: "short",
    leverage: 5,
    signature: await bob.signMessage({ message: signedMessage.pick(battleId, "short", 5) }),
  })
);

await finished;
a.close();
b.close();
