"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS, MAX_LAND } from "@monarch/shared";
import { GoldCoin } from "./ui";

/** World coordinates; the ground art is 16:9. */
export const VIEW_W = 1600;
export const VIEW_H = 900;
/** Isometric 5x5 territory grid laid over the central grass field of the ground art. */
export const GRID = { cx: 808, cy: 428, tw: 212, th: 140, size: 5 };

export type Tile = { i: number; j: number };

/** Building tile per building ID: center, left, right, bottom of the grid. */
export const BUILDING_TILES: Tile[] = [
  { i: 2, j: 2 },
  { i: 1, j: 3 },
  { i: 3, j: 1 },
  { i: 3, j: 3 },
];
/**
 * Sprite placement: `baseY` is the center of the sprite's stone/rock base as a fraction of image height
 * (measured from the art), `fill` is the base width as a fraction of the tile width.
 */
const SPRITE: Record<string, { baseY: number; fill: number }> = {
  townhall: { baseY: 0.701, fill: 0.86 },
  goldmine: { baseY: 0.669, fill: 0.8 },
  barracks: { baseY: 0.698, fill: 0.78 },
  trophyhall: { baseY: 0.748, fill: 0.72 },
  castle: { baseY: 0.802, fill: 0.46 },
};

export const spriteStyle = (key: string, t: Tile) => {
  const { x, y } = tileCenter(t);
  const s = SPRITE[key];
  return {
    ...pct(x, y),
    width: `${((GRID.tw * s.fill) / VIEW_W) * 100}%`,
    transform: `translate(-50%, -${s.baseY * 100}%)`,
    zIndex: Math.round(y),
  };
};

export const tileCenter = ({ i, j }: Tile) => ({
  x: GRID.cx + ((i - j) * GRID.tw) / 2,
  y: GRID.cy + ((i + j - (GRID.size - 1)) * GRID.th) / 2,
});

/** Claim order: the four building plots, then outward from the center. */
export const TILE_ORDER: Tile[] = (() => {
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

export const pct = (x: number, y: number) => ({ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` });

export function tilePoints(t: Tile, inset = 0) {
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
      className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-[#3f7a1c] active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        if (!endDrag() && e.target === e.currentTarget.firstChild) onSelect(null);
      }}
      onPointerCancel={endDrag}
      onWheel={(e) => setZoom((z) => Math.min(1.9, Math.max(1, z - e.deltaY * 0.0012)))}
    >
      <div
        className="absolute bg-[url(/village/ground.jpg)] bg-cover"
        style={{ width: worldW, height: worldH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.stopPropagation();
        }}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {TILE_ORDER.map((t, idx) => {
            const owned = idx < land;
            const isNext = nextTile && t.i === nextTile.i && t.j === nextTile.j;
            return (
              <polygon
                key={`${t.i}-${t.j}`}
                points={tilePoints(t, 3)}
                fill={owned ? "#c8f07a" : "#1f3d0c"}
                fillOpacity={owned ? 0.16 : 0.32}
                stroke={isNext ? "#ffd84a" : "#ffffff"}
                strokeOpacity={owned ? 0.4 : isNext ? 0.95 : 0.12}
                strokeWidth={isNext ? 3 : 2}
                strokeDasharray={owned ? undefined : "10 8"}
              />
            );
          })}
          <defs>
            <radialGradient id="contact-shadow">
              <stop offset="0%" stopColor="#000" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#000" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[...BUILDING_TILES, ...outposts].map((t, idx) => {
            const { x, y } = tileCenter(t);
            const isBuilding = idx < BUILDING_TILES.length;
            const isSelected = isBuilding && selected === idx;
            return (
              <g key={`f-${t.i}-${t.j}`}>
                <polygon
                  points={tilePoints(t, isBuilding ? 6 : 30)}
                  fill="#7a6332"
                  fillOpacity={0.7}
                  stroke={isSelected ? "#fff7c2" : "#3d3214"}
                  strokeOpacity={isSelected ? 1 : 0.45}
                  strokeWidth={isSelected ? 4 : 2}
                />
                <ellipse
                  cx={x}
                  cy={y + GRID.th * 0.04}
                  rx={GRID.tw * (isBuilding ? 0.42 : 0.2)}
                  ry={GRID.th * (isBuilding ? 0.36 : 0.17)}
                  fill="url(#contact-shadow)"
                />
              </g>
            );
          })}
          {nextTile && !readOnly && (
            <text
              x={tileCenter(nextTile).x}
              y={tileCenter(nextTile).y + 7}
              textAnchor="middle"
              className="fill-white font-display text-[19px]"
              style={{ paintOrder: "stroke", stroke: "#1d1206", strokeWidth: 5 }}
            >
              WIN TO CLAIM
            </text>
          )}
        </svg>

        {outposts.map((t) => (
          <img
            key={`o-${t.i}-${t.j}`}
            src="/village/castle.png"
            alt=""
            draggable={false}
            className="pointer-events-none absolute drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
            style={spriteStyle("castle", t)}
          />
        ))}

        {BUILDINGS.map((b) => {
          const level = levels[b.id] ?? 1;
          const isSelected = selected === b.id;
          return (
            <button
              key={b.id}
              className="group absolute focus:outline-none"
              style={spriteStyle(b.key, BUILDING_TILES[b.id])}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : b.id);
              }}
              aria-label={`${b.name} level ${level}`}
            >
              <img
                src={`/village/${b.key}.png`}
                alt=""
                draggable={false}
                className={`w-full transition duration-200 group-hover:brightness-110 ${
                  isSelected
                    ? "brightness-115 drop-shadow-[0_0_8px_rgba(255,247,194,0.95)]"
                    : "drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
                }`}
              />
              <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border-2 border-[#1d1206] bg-[linear-gradient(180deg,#b07c45,#7a4f25)] px-1.5 py-px font-display text-[11px] text-white shadow-[0_2px_0_#1d1206] sm:text-xs">
                <span className="clash-text">Lv {level}</span>
              </span>
            </button>
          );
        })}

        {!readOnly && pending > 0 && (
          <button
            className="collect-bubble absolute flex -translate-x-1/2 flex-col items-center"
            style={{ ...pct(tileCenter(BUILDING_TILES[1]).x, tileCenter(BUILDING_TILES[1]).y - 215), zIndex: 1000 }}
            onClick={(e) => {
              e.stopPropagation();
              onCollect?.();
            }}
            disabled={collecting}
            aria-label={`Collect ${pending} gold`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#1d1206] bg-[radial-gradient(circle_at_35%_30%,#fffaf0,#f6ead0)] shadow-[0_3px_0_#1d1206]">
              {collecting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-[#7a4a00] border-t-transparent" />
              ) : (
                <GoldCoin size={28} />
              )}
            </span>
            <span className="clash-text mt-0.5 font-display text-sm">{pending}</span>
          </button>
        )}
        {floatText && (
          <span
            className="coin-float clash-text pointer-events-none absolute font-display text-2xl text-[#ffd84a]"
            style={{ ...pct(tileCenter(BUILDING_TILES[1]).x, tileCenter(BUILDING_TILES[1]).y - 230), zIndex: 1001 }}
          >
            {floatText}
          </span>
        )}
      </div>
    </div>
  );
}
