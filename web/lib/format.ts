export const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

/** USD with enough decimals for coins worth fractions of a cent. */
export const price = (n: number) => usd(n, n >= 100 ? 2 : n >= 1 ? 3 : n >= 0.1 ? 4 : 5);

export const pct = (n: number, digits = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const signedUsd = (n: number) => `${n >= 0 ? "+" : "-"}${usd(Math.abs(n))}`;

export const countdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Stable, distinct color per player address. */
export function ownerColor(address: string): string {
  let h = 0;
  for (let i = 2; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}
