import { EventEmitter } from "node:events";
import { ASSETS, type AssetId, type AssetPrices, type MarketStats, type PriceTick, type PricesTick } from "@monarch/shared";

const COINBASE_WS = "wss://ws-feed.exchange.coinbase.com";
const TICK_MS = 500;
const HISTORY_SIZE = 600;
const STALE_MS = 15_000;
const MOCK_VOLATILITY = 0.0004;

const byProduct = new Map<string, AssetId>(ASSETS.map((a) => [a.product, a.id]));
const round = (p: number) => Number(p.toPrecision(8));

/**
 * Single source of prices for every tradable asset. Emits "tick" every TICK_MS with the
 * latest prices so every client and battle sees the exact same numbers.
 */
export class PriceFeed extends EventEmitter<{ tick: [PricesTick] }> {
  private readonly prices: AssetPrices = {};
  private lastMessageAt = 0;
  readonly history: Partial<Record<AssetId, PriceTick[]>> = {};
  readonly market: Partial<Record<AssetId, MarketStats>> = {};
  latest: PricesTick | null = null;

  constructor(private readonly mode: "live" | "mock") {
    super();
  }

  start() {
    if (this.mode === "mock") {
      for (const a of ASSETS) {
        this.prices[a.id] = a.mockStart;
        this.market[a.id] = { open24h: a.mockStart, high24h: a.mockStart, low24h: a.mockStart, volume24h: 12_345 };
      }
      console.log("[price] mock random-walk mode");
    } else {
      this.connectLive();
    }

    setInterval(() => {
      const t = Date.now();
      const p: AssetPrices = {};
      for (const a of ASSETS) {
        let price = this.prices[a.id];
        if (price === undefined) continue;
        if (this.mode === "mock") {
          price *= 1 + gaussian() * MOCK_VOLATILITY;
          this.prices[a.id] = price;
          const m = this.market[a.id]!;
          m.high24h = Math.max(m.high24h, price);
          m.low24h = Math.min(m.low24h, price);
        }
        p[a.id] = round(price);
        const h = (this.history[a.id] ??= []);
        h.push({ p: p[a.id]!, t });
        if (h.length > HISTORY_SIZE) h.shift();
      }
      if (Object.keys(p).length === 0) return;
      this.latest = { t, p };
      this.emit("tick", this.latest);
    }, TICK_MS);
  }

  private connectLive() {
    const ws = new WebSocket(COINBASE_WS);
    let watchdog: NodeJS.Timeout | undefined;

    ws.onopen = () => {
      console.log(`[price] connected to Coinbase ${ASSETS.map((a) => a.product).join(", ")}`);
      this.lastMessageAt = Date.now();
      ws.send(JSON.stringify({ type: "subscribe", product_ids: ASSETS.map((a) => a.product), channels: ["ticker"] }));
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
        const asset = byProduct.get(msg.product_id);
        if (msg.type === "ticker" && msg.price && asset) {
          this.prices[asset] = Number(msg.price);
          this.market[asset] = {
            open24h: Number(msg.open_24h),
            high24h: Number(msg.high_24h),
            low24h: Number(msg.low_24h),
            volume24h: Number(msg.volume_24h),
          };
        }
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
