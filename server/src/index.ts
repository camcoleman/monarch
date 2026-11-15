import { createServer } from "node:http";
import { Server } from "socket.io";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@monarch/shared";
import { BattleManager } from "./battles";
import { Chain, errMessage } from "./chain";
import { config } from "./config";
import { PriceFeed } from "./priceFeed";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, price: feed.latest, chain: chain.enabled, settle: chain.canSettle, mode: config.priceMode }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.corsOrigin },
});

const feed = new PriceFeed(config.priceMode);
const chain = new Chain(config);
const battles = new BattleManager(io, feed, chain, config);

feed.on("tick", (tick) => {
  io.emit("prices", tick);
  battles.onPrice(tick);
});
feed.start();

/** Runs a handler and always answers the ack, even if the handler throws. */
async function respond<T extends object>(ack: unknown, fn: () => Ack<T> | Promise<Ack<T>>) {
  let result: Ack<T>;
  try {
    result = await fn();
  } catch (err) {
    console.error("[socket] handler error:", err);
    result = { ok: false, error: errMessage(err) };
  }
  if (typeof ack === "function") ack(result);
}

io.on("connection", (socket) => {
  socket.emit("price:history", feed.history);
  socket.emit("market", feed.market);
  socket.emit("battles:live", battles.liveSummaries());
  socket.emit("match:queue", { searching: battles.queueSize() });

  socket.on("match:find", (p, ack) => respond(ack, () => battles.findMatch(socket, p)));
  socket.on("match:cancel", (p, ack) => respond(ack, () => battles.cancelMatch(p.address)));
  socket.on("battle:challenge", (p, ack) => respond(ack, () => battles.challenge(p)));
  socket.on("battle:watch", (p, ack) => respond(ack, () => battles.watch(socket, p.battleId)));
  socket.on("battle:join", (p, ack) => respond(ack, () => battles.join(p)));
  socket.on("battle:pick", (p, ack) => respond(ack, () => battles.pick(p)));
  socket.on("battle:practice", (p, ack) => respond(ack, () => battles.practice(socket, p ?? {})));
  socket.on("disconnect", () => battles.dropSocket(socket.id));
});

setInterval(() => io.emit("market", feed.market), 5_000);

httpServer.listen(config.port, () => {
  console.log(`[server] MONARCH referee listening on :${config.port}`);
});
