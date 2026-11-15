"use client";

import { useMemo } from "react";

const PIECES = ["👑", "🏆", "✨", "🎉", "⭐"];

/** One-shot falling confetti over the whole viewport. */
export function Celebration({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        char: PIECES[i % PIECES.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 1.8,
        size: 16 + Math.random() * 18,
        drift: (Math.random() - 0.5) * 120,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0"
          style={
            {
              left: `${p.left}%`,
              fontSize: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}
