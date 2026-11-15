/**
 * Plays a full battle between two scripted players against a running referee.
 * Usage: pnpm --filter ./server simulate [stateId] [addressA] [addressB]
 * With a contract configured, both addresses must already be registered on-chain.
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@monarch/shared";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const url = process.env.SERVER_URL ?? "http://localhost:4000";
const stateId = Number(process.argv[2] ?? 0);
const alice = (process.argv[3] ?? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").toLowerCase();
const bob = (process.argv[4] ?? "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC").toLowerCase();

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

const created = expectOk("create", await a.emitWithAck("battle:create", { stateId, address: alice, name: "Alice" }));
const battleId = (created as { battleId: string }).battleId;
console.log(`created battle ${battleId}`);

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

expectOk("join", await b.emitWithAck("battle:join", { battleId, address: bob, name: "Bob" }));
expectOk("pick A", await a.emitWithAck("battle:pick", { battleId, address: alice, side: "long", leverage: 5 }));
expectOk("pick B", await b.emitWithAck("battle:pick", { battleId, address: bob, side: "short", leverage: 5 }));

await finished;
a.close();
b.close();
