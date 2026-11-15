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
    res.end(JSON.stringify({ ok: true, price: feed.latest, chain: chain.enabled, mode: config.priceMode }));
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
  io.emit("price", tick);
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
  socket.emit("battles:open", battles.openSummaries());

  socket.on("battle:create", (p, ack) => respond(ack, () => battles.create(p)));
  socket.on("battle:watch", (p, ack) => respond(ack, () => battles.watch(socket, p.battleId)));
  socket.on("battle:join", (p, ack) => respond(ack, () => battles.join(p)));
  socket.on("battle:pick", (p, ack) => respond(ack, () => battles.pick(p)));
});

httpServer.listen(config.port, () => {
  console.log(`[server] MONARCH referee listening on :${config.port}`);
});
