"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS, MAX_LAND } from "@monarch/shared";
import { GoldCoin } from "./ui";

/** World coordinates; the ground art is 16:9. */
const VIEW_W = 1600;
const VIEW_H = 900;
/** Isometric 5x5 territory grid laid over the central platform of the ground art. */
export const GRID = { cx: 805, cy: 440, tw: 236, th: 123, size: 5 };

type Tile = { i: number; j: number };

/** Building tile per building ID: center, left, right, bottom of the grid. */
const BUILDING_TILES: Tile[] = [
  { i: 2, j: 2 },
  { i: 1, j: 3 },
  { i: 3, j: 1 },
  { i: 3, j: 3 },
];
const BUILDING_WIDTH = [250, 185, 185, 165];

const tileCenter = ({ i, j }: Tile) => ({
  x: GRID.cx + ((i - j) * GRID.tw) / 2,
  y: GRID.cy + ((i + j - (GRID.size - 1)) * GRID.th) / 2,
});

/** Claim order: the four building plots, then outward from the center. */
const TILE_ORDER: Tile[] = (() => {
  const key = (t: Tile) => `${t.i},${t.j}`;
  const taken = new Set(BUILDING_TILES.map(key));
  const mid = (GRID.size - 1) / 2;
  const rest: Tile[] = [];
  for (let i = 0; i < GRID.size; i++) {
    for (let j = 0; j < GRID.size; j++) if (!taken.has(key({ i, j }))) rest.push({ i, j });
  }
  rest.sort((a, b) => {
    const da = Math.abs(a.i - mid) + Math.abs(a.j - mid);
    const db = Math.abs(b.i - mid) + Math.abs(b.j - mid);
    return da - db || Math.atan2(a.i - mid, a.j - mid) - Math.atan2(b.i - mid, b.j - mid);
  });
  return [...BUILDING_TILES, ...rest];
})();

const pct = (x: number, y: number) => ({ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` });

function tilePoints(t: Tile, inset = 0) {
  const { x, y } = tileCenter(t);
  const w = GRID.tw / 2 - inset;
  const h = GRID.th / 2 - inset * (GRID.th / GRID.tw);
  return `${x},${y - h} ${x + w},${y} ${x},${y + h} ${x - w},${y}`;
}

interface Props {
  levels: number[];
  land: number;
  selected: number | null;
  onSelect: (id: number | null) => void;
  pending: number;
  onCollect?: () => void;
  collecting?: boolean;
  floatText?: string | null;
  readOnly?: boolean;
}

export function World({ levels, land, selected, onSelect, pending, onCollect, collecting, floatText, readOnly }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrame({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worldW = Math.max(frame.w, (frame.h * VIEW_W) / VIEW_H) * zoom;
  const worldH = (worldW * VIEW_H) / VIEW_W;
  const clamp = useCallback(
    (o: { x: number; y: number }) => ({
      x: Math.min(0, Math.max(frame.w - worldW, o.x)),
      y: Math.min(0, Math.max(frame.h - worldH, o.y)),
    }),
    [frame.w, frame.h, worldW, worldH]
  );

  // Keep the base centered whenever the viewport or zoom changes.
  useEffect(() => {
    setOffset(clamp({ x: (frame.w - worldW) / 2, y: (frame.h - worldH) / 2 - worldH * 0.02 }));
  }, [frame.w, frame.h, worldW, worldH, clamp]);

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    d.moved = true;
    setOffset(clamp({ x: d.ox + dx, y: d.oy + dy }));
  };
  const endDrag = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    return moved;
  };

  const claimed = TILE_ORDER.slice(0, Math.min(land, MAX_LAND));
  const nextTile = land < MAX_LAND ? TILE_ORDER[land] : null;
  const outposts = claimed.slice(BUILDING_TILES.length);

  return (
    <div
      ref={frameRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-ink active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        if (!endDrag() && e.target === e.currentTarget.firstChild) onSelect(null);
      }}
      onPointerCancel={endDrag}
      onWheel={(e) => setZoom((z) => Math.min(1.9, Math.max(1, z - e.deltaY * 0.0012)))}
    >
      <div
        className="absolute bg-[url(/base/ground.jpg)] bg-cover"
        style={{ width: worldW, height: worldH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.stopPropagation();
        }}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <filter id="tile-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {TILE_ORDER.map((t, idx) => {
            const owned = idx < land;
            const isNext = nextTile && t.i === nextTile.i && t.j === nextTile.j;
            return (
              <polygon
                key={`${t.i}-${t.j}`}
                points={tilePoints(t, 4)}
                className={owned ? "tile-claimed" : ""}
                fill={owned ? "#22d3ee" : "#020617"}
                fillOpacity={owned ? 0.12 : 0.45}
                stroke={owned ? "#67e8f9" : isNext ? "#fbbf24" : "#334155"}
                strokeOpacity={owned ? 0.85 : isNext ? 0.9 : 0.5}
                strokeWidth={owned ? 2.5 : 2}
                strokeDasharray={owned ? undefined : "8 6"}
                filter={owned ? "url(#tile-glow)" : undefined}
              />
            );
          })}
          {outposts.map((t) => {
            const { x, y } = tileCenter(t);
            return (
              <g key={`o-${t.i}-${t.j}`} transform={`translate(${x} ${y})`}>
                <ellipse rx="26" ry="14" fill="#22d3ee" fillOpacity=".25" />
                <rect x="-3" y="-120" width="6" height="120" fill="url(#beam)" opacity=".8" />
                <path d="M0 -46 16 -36v20L0 -6l-16-10v-20Z" fill="#0f172a" stroke="#67e8f9" strokeWidth="2.5" />
                <path d="M0 -40 10 -33v13L0 -13l-10-7v-13Z" fill="#22d3ee" fillOpacity=".7" />
              </g>
            );
          })}
          <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#67e8f9" stopOpacity=".9" />
            <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
          </linearGradient>
          {nextTile && !readOnly && (
            <text
              x={tileCenter(nextTile).x}
              y={tileCenter(nextTile).y + 6}
              textAnchor="middle"
              className="fill-amber-300 font-display text-[15px] font-bold"
              style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 4 }}
            >
              WIN TO CLAIM
            </text>
          )}
        </svg>

        {BUILDINGS.map((b) => {
          const { x, y } = tileCenter(BUILDING_TILES[b.id]);
          const level = levels[b.id] ?? 1;
          const width = BUILDING_WIDTH[b.id] * (1 + 0.05 * (level - 1));
          const isSelected = selected === b.id;
          return (
            <button
              key={b.id}
              className="base-sprite group absolute focus:outline-none"
              style={{ ...pct(x, y + GRID.th * 0.32), width: `${(width / VIEW_W) * 100}%`, zIndex: Math.round(y) }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : b.id);
              }}
              aria-label={`${b.name} level ${level}`}
            >
              <img
                src={`/base/${b.key}.png`}
                alt=""
                draggable={false}
                className={`w-full transition duration-200 group-hover:-translate-y-1 ${
                  isSelected
                    ? "drop-shadow-[0_0_18px_rgba(34,211,238,1)] brightness-110"
                    : "drop-shadow-[0_10px_10px_rgba(0,0,0,0.55)]"
                }`}
              />
            </button>
          );
        })}

        {!readOnly && pending > 0 && (
          <button
            className="collect-bubble absolute flex -translate-x-1/2 flex-col items-center"
            style={{ ...pct(tileCenter(BUILDING_TILES[1]).x, tileCenter(BUILDING_TILES[1]).y - 255), zIndex: 1000 }}
            onClick={(e) => {
              e.stopPropagation();
              onCollect?.();
            }}
            disabled={collecting}
            aria-label={`Collect ${pending} gold`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-300/90 to-amber-600/90 shadow-[0_0_20px_rgb(251_191_36/0.9)]">
              {collecting ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <GoldCoin size={26} />}
            </span>
            <span className="hud-text mt-0.5 font-display text-xs font-bold">{pending}</span>
          </button>
        )}
        {floatText && (
          <span
            className="coin-float hud-text pointer-events-none absolute font-display text-xl font-black text-amber-300"
            style={{ ...pct(tileCenter(BUILDING_TILES[1]).x, tileCenter(BUILDING_TILES[1]).y - 270), zIndex: 1001 }}
          >
            {floatText}
          </span>
        )}
      </div>
    </div>
  );
}
