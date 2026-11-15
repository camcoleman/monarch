import { EventEmitter } from "node:events";
import type { PriceTick } from "@monarch/shared";

const COINBASE_WS = "wss://ws-feed.exchange.coinbase.com";
const TICK_MS = 500;
const HISTORY_SIZE = 600;
const STALE_MS = 15_000;
const MOCK_START_PRICE = 97_000;
const MOCK_VOLATILITY = 0.0004;

/**
 * Single source of BTC prices. Emits "tick" every TICK_MS with the latest price so
 * every client and battle sees the exact same numbers.
 */
export class PriceFeed extends EventEmitter<{ tick: [PriceTick] }> {
  private price: number | null = null;
  private lastMessageAt = 0;
  readonly history: PriceTick[] = [];

  constructor(private readonly mode: "live" | "mock") {
    super();
  }

  get latest(): PriceTick | null {
    return this.history.at(-1) ?? null;
  }

  start() {
    if (this.mode === "mock") {
      this.price = MOCK_START_PRICE;
      console.log("[price] mock random-walk mode");
    } else {
      this.connectLive();
    }

    setInterval(() => {
      if (this.mode === "mock" && this.price !== null) {
        this.price *= 1 + gaussian() * MOCK_VOLATILITY;
      }
      if (this.price === null) return;
      const tick = { p: Math.round(this.price * 100) / 100, t: Date.now() };
      this.history.push(tick);
      if (this.history.length > HISTORY_SIZE) this.history.shift();
      this.emit("tick", tick);
    }, TICK_MS);
  }

  private connectLive() {
    const ws = new WebSocket(COINBASE_WS);
    let watchdog: NodeJS.Timeout | undefined;

    ws.onopen = () => {
      console.log("[price] connected to Coinbase BTC-USD");
      this.lastMessageAt = Date.now();
      ws.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }));
      watchdog = setInterval(() => {
        if (Date.now() - this.lastMessageAt > STALE_MS) {
          console.warn("[price] feed stale, reconnecting");
          ws.close();
        }
      }, 5_000);
    };

    ws.onmessage = (event) => {
      this.lastMessageAt = Date.now();
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === "ticker" && msg.price) this.price = Number(msg.price);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearInterval(watchdog);
      console.warn("[price] disconnected, retrying in 2s");
      setTimeout(() => this.connectLive(), 2_000);
    };
  }
}

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
