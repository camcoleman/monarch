"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS, MAX_LAND } from "@monarch/shared";
import { GoldCoin } from "./ui";

/** World coordinates; the ground art is 16:9. */
export const VIEW_W = 1600;
export const VIEW_H = 900;
/** Isometric 5x5 territory grid laid over the central grass field of the ground art. */
export const GRID = { cx: 808, cy: 428, tw: 212, th: 140, size: 5 };
/** Each territory tile is split into 6x6 build cells, so the whole field is a 30x30 Clash-style grid. */
const SUB = 6;
const N = GRID.size * SUB;
const CW = GRID.tw / SUB;
const CH = GRID.th / SUB;
/** Footprints in build cells, matching Clash: Town Hall 4x4, other buildings 3x3, outpost castles 2x2. */
const FOOTPRINT: Record<string, number> = { townhall: 4, goldmine: 3, barracks: 3, trophyhall: 3, castle: 2 };
const sizeOf = (id: number) => FOOTPRINT[BUILDINGS[id].key];
/** The art is drawn at a steeper angle than the ground grid; flattening it lines the bases up and lowers the buildings. */
const SQUASH = 0.88;

export type Tile = { i: number; j: number };
/** Top-left build cell of a building footprint. */
export type Cell = { ci: number; cj: number };
export type Layout = Record<number, Cell>;

/** Default building tile per building ID: center, left, right, bottom of the grid. */
export const BUILDING_TILES: Tile[] = [
  { i: 2, j: 2 },
  { i: 1, j: 3 },
  { i: 3, j: 1 },
  { i: 3, j: 3 },
];

/** Top-left cell that centers a footprint of `size` cells in a tile (rounded toward the tile's top corner). */
const inTile = (t: Tile, size: number): Cell => {
  const off = Math.floor((SUB - size) / 2);
  return { ci: t.i * SUB + off, cj: t.j * SUB + off };
};

export const DEFAULT_LAYOUT: Layout = Object.fromEntries(BUILDING_TILES.map((t, id) => [id, inTile(t, sizeOf(id))]));

/**
 * Sprite placement, measured from the art: `baseY` is the center of the stone/rock base as a fraction of image
 * height, `aspect` is height / width, and `fill` is the base width as a fraction of the footprint width.
 */
const SPRITE: Record<string, { baseY: number; aspect: number; fill: number }> = {
  townhall: { baseY: 0.701, aspect: 512 / 430, fill: 0.98 },
  goldmine: { baseY: 0.669, aspect: 442 / 512, fill: 0.98 },
  barracks: { baseY: 0.698, aspect: 512 / 444, fill: 0.96 },
  trophyhall: { baseY: 0.748, aspect: 512 / 424, fill: 0.92 },
  castle: { baseY: 0.802, aspect: 512 / 307, fill: 0.9 },
};

const spriteWidth = (key: string) => FOOTPRINT[key] * CW * SPRITE[key].fill;
/** World y of the top of a sprite whose base is centered at `y`. */
const spriteTop = (key: string, y: number) => y - spriteWidth(key) * SPRITE[key].aspect * SQUASH * SPRITE[key].baseY;

export const pct = (x: number, y: number) => ({ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` });

const spriteAt = (key: string, { x, y }: { x: number; y: number }) => {
  const s = SPRITE[key];
  return {
    ...pct(x, y),
    width: `${(spriteWidth(key) / VIEW_W) * 100}%`,
    transformOrigin: `50% ${s.baseY * 100}%`,
    transform: `translate(-50%, -${s.baseY * 100}%) scaleY(${SQUASH})`,
    zIndex: Math.round(y),
  };
};

export const tileCenter = ({ i, j }: Tile) => ({
  x: GRID.cx + ((i - j) * GRID.tw) / 2,
  y: GRID.cy + ((i + j - (GRID.size - 1)) * GRID.th) / 2,
});

export const spriteStyle = (key: string, t: Tile) => spriteAt(key, tileCenter(t));

/** Center of a (possibly fractional) build cell. */
const cellCenter = (ci: number, cj: number) => ({
  x: GRID.cx + ((ci - cj) * CW) / 2,
  y: GRID.cy + ((ci + cj - (N - 1)) * CH) / 2,
});

const footprintCenter = ({ ci, cj }: Cell, size: number) => cellCenter(ci + (size - 1) / 2, cj + (size - 1) / 2);

/** Grid vertex where cell lines u and v cross. */
const vertex = (u: number, v: number) => ({ x: GRID.cx + ((u - v) * CW) / 2, y: GRID.cy + ((u + v - N) * CH) / 2 });

function diamond(ci: number, cj: number, size: number, inset = 0) {
  const c = cellCenter(ci + (size - 1) / 2, cj + (size - 1) / 2);
  const k = 1 - inset;
  return [vertex(ci, cj), vertex(ci + size, cj), vertex(ci + size, cj + size), vertex(ci, cj + size)]
    .map((p) => `${c.x + (p.x - c.x) * k},${c.y + (p.y - c.y) * k}`)
    .join(" ");
}

/** Claim order: the four starting plots, then outward from the center. */
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

export function tilePoints(t: Tile, inset = 0) {
  const { x, y } = tileCenter(t);
  const w = GRID.tw / 2 - inset;
  const h = GRID.th / 2 - inset * (GRID.th / GRID.tw);
  return `${x},${y - h} ${x + w},${y} ${x},${y + h} ${x - w},${y}`;
}

/** Pointer capture throws if the pointer is already gone (e.g. a lifted touch); dragging still works without it. */
function capture(e: ReactPointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {}
}

const overlaps = (a: Cell, as: number, b: Cell, bs: number) =>
  a.ci < b.ci + bs && b.ci < a.ci + as && a.cj < b.cj + bs && b.cj < a.cj + as;

interface Props {
  levels: number[];
  land: number;
  layout?: Layout;
  onMove?: (id: number, cell: Cell) => void;
  selected: number | null;
  onSelect: (id: number | null) => void;
  pending: number;
  onCollect?: () => void;
  collecting?: boolean;
  floatText?: string | null;
  readOnly?: boolean;
}

type Move = { id: number; pointerId: number; x: number; y: number; grab: { a: number; b: number }; cell: Cell; moved: boolean };

export function World({
  levels,
  land,
  layout = DEFAULT_LAYOUT,
  onMove,
  selected,
  onSelect,
  pending,
  onCollect,
  collecting,
  floatText,
  readOnly,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [move, setMove] = useState<Move | null>(null);

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
    if (!d.moved) capture(e);
    d.moved = true;
    setOffset(clamp({ x: d.ox + dx, y: d.oy + dy }));
  };
  const endDrag = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    return moved;
  };

  const claimedTiles = useMemo(() => TILE_ORDER.slice(0, Math.min(land, MAX_LAND)), [land]);
  const claimed = useMemo(() => new Set(claimedTiles.map((t) => `${t.i},${t.j}`)), [claimedTiles]);
  const isClaimed = (i: number, j: number) => claimed.has(`${i},${j}`);
  const nextTile = land < MAX_LAND ? TILE_ORDER[land] : null;

  const positions = BUILDINGS.map((b) => {
    if (move?.id === b.id) return move.cell;
    const c = layout[b.id] ?? DEFAULT_LAYOUT[b.id];
    const max = N - sizeOf(b.id);
    return { ci: Math.min(max, c.ci), cj: Math.min(max, c.cj) };
  });
  // Outposts get a castle in the middle of the plot unless a building has been moved onto it.
  const castles = claimedTiles
    .slice(BUILDING_TILES.length)
    .map((t) => inTile(t, FOOTPRINT.castle))
    .filter((c) => !BUILDINGS.some((b) => overlaps(layout[b.id] ?? DEFAULT_LAYOUT[b.id], sizeOf(b.id), c, FOOTPRINT.castle)));

  const canPlace = (id: number, cell: Cell) =>
    !BUILDINGS.some((b) => b.id !== id && overlaps(cell, sizeOf(id), layout[b.id] ?? DEFAULT_LAYOUT[b.id], sizeOf(b.id))) &&
    !castles.some((c) => overlaps(cell, sizeOf(id), c, FOOTPRINT.castle));

  /** Screen point to fractional (ci - cj, ci + cj) grid coordinates. */
  const toGrid = (clientX: number, clientY: number) => {
    const r = worldRef.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * VIEW_W;
    const vy = ((clientY - r.top) / r.height) * VIEW_H;
    return { a: (vx - GRID.cx) / (CW / 2), b: (vy - GRID.cy) / (CH / 2) + (N - 1) };
  };

  const startMove = (e: ReactPointerEvent, id: number) => {
    if (readOnly || !onMove) return;
    e.stopPropagation();
    capture(e);
    const cell = positions[id];
    const p = toGrid(e.clientX, e.clientY);
    const half = (sizeOf(id) - 1) / 2;
    const c = { ci: cell.ci + half, cj: cell.cj + half };
    setMove({ id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, grab: { a: p.a - (c.ci - c.cj), b: p.b - (c.ci + c.cj) }, cell, moved: false });
  };

  const continueMove = (e: ReactPointerEvent) => {
    if (!move || e.pointerId !== move.pointerId) return;
    if (!move.moved && Math.hypot(e.clientX - move.x, e.clientY - move.y) < 6) return;
    const p = toGrid(e.clientX, e.clientY);
    const a = p.a - move.grab.a;
    const b = p.b - move.grab.b;
    const size = sizeOf(move.id);
    const half = (size - 1) / 2;
    const cell = {
      ci: Math.min(N - size, Math.max(0, Math.round((a + b) / 2 - half))),
      cj: Math.min(N - size, Math.max(0, Math.round((b - a) / 2 - half))),
    };
    setMove({ ...move, cell, moved: true });
    if (selected !== move.id) onSelect(move.id);
  };

  const endMove = (e: ReactPointerEvent, id: number) => {
    if (!move || e.pointerId !== move.pointerId) {
      return;
    }
    if (move.moved) {
      if (canPlace(id, move.cell)) onMove?.(id, move.cell);
    } else {
      onSelect(selected === id ? null : id);
    }
    setMove(null);
  };

  const moveValid = move?.moved ? canPlace(move.id, move.cell) : true;

  const boundary = useMemo(() => {
    const edges: [number, number, number, number][] = [];
    for (const t of claimedTiles) {
      const u = t.i * SUB;
      const v = t.j * SUB;
      if (!claimed.has(`${t.i},${t.j - 1}`)) edges.push([u, v, u + SUB, v]);
      if (!claimed.has(`${t.i + 1},${t.j}`)) edges.push([u + SUB, v, u + SUB, v + SUB]);
      if (!claimed.has(`${t.i},${t.j + 1}`)) edges.push([u + SUB, v + SUB, u, v + SUB]);
      if (!claimed.has(`${t.i - 1},${t.j}`)) edges.push([u, v + SUB, u, v]);
    }
    return edges;
  }, [claimedTiles, claimed]);

  const cells = useMemo(() => {
    const out: { ci: number; cj: number }[] = [];
    for (let ci = 0; ci < N; ci += 2) for (let cj = 0; cj < N; cj += 2) out.push({ ci, cj });
    return out;
  }, []);

  const goldMine = footprintCenter(positions[1], sizeOf(1));
  const labelFor = move?.moved ? move.id : selected;
  const labelAt = labelFor === null ? null : footprintCenter(positions[labelFor], sizeOf(labelFor));

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
        ref={worldRef}
        className="absolute bg-[url(/village/ground.jpg)] bg-cover"
        style={{ width: worldW, height: worldH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.stopPropagation();
        }}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          {/* Build grid: checkered grass, darker where the land isn't claimed yet. */}
          {cells.map(({ ci, cj }) => {
            const owned = isClaimed(Math.floor(ci / SUB), Math.floor(cj / SUB));
            const light = (ci + cj) % 4 === 0;
            return (
              <polygon
                key={`c-${ci}-${cj}`}
                points={diamond(ci, cj, 2)}
                fill={owned ? (light ? "#9dd047" : "#8fc23c") : light ? "#6f9431" : "#66892c"}
                fillOpacity={owned ? 0.88 : 0.8}
              />
            );
          })}

          {boundary.map(([u1, v1, u2, v2], idx) => {
            const p1 = vertex(u1, v1);
            const p2 = vertex(u2, v2);
            return <line key={`b-${idx}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff6c8" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" />;
          })}

          {nextTile && !readOnly && (
            <polygon
              points={diamond(nextTile.i * SUB, nextTile.j * SUB, SUB, 0.04)}
              fill="#ffd84a"
              fillOpacity={0.12}
              stroke="#ffd84a"
              strokeWidth={3}
              strokeDasharray="12 8"
            />
          )}

          {move?.moved &&
            Array.from({ length: N + 1 }, (_, k) => {
              const a1 = vertex(k, 0);
              const a2 = vertex(k, N);
              const b1 = vertex(0, k);
              const b2 = vertex(N, k);
              return (
                <g key={`g-${k}`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5}>
                  <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} />
                  <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} />
                </g>
              );
            })}
          {castles.map((c) => {
            const size = FOOTPRINT.castle;
            const { x, y } = footprintCenter(c, size);
            return (
              <g key={`cp-${c.ci}-${c.cj}`}>
                <ellipse cx={x - 4} cy={y + 4} rx={size * CW * 0.6} ry={size * CH * 0.55} fill="#000" fillOpacity={0.35} filter="url(#soft-shadow)" />
                <polygon points={diamond(c.ci, c.cj, size, 0.06)} fill="#6b5626" fillOpacity={0.6} stroke="#3d3214" strokeOpacity={0.5} strokeWidth={1.5} />
              </g>
            );
          })}

          {BUILDINGS.map((b) => {
            const cell = positions[b.id];
            const moving = move?.moved && move.id === b.id;
            const size = sizeOf(b.id);
            const { x, y } = footprintCenter(cell, size);
            return (
              <g key={`pad-${b.id}`}>
                {!moving && (
                  <>
                    <ellipse cx={x - 6} cy={y + 5} rx={size * CW * 0.6} ry={size * CH * 0.55} fill="#000" fillOpacity={0.38} filter="url(#soft-shadow)" />
                    <polygon
                      points={diamond(cell.ci, cell.cj, size, 0.04)}
                      fill="#6b5626"
                      fillOpacity={0.62}
                      stroke={selected === b.id ? "#fff7c2" : "#3d3214"}
                      strokeOpacity={selected === b.id ? 1 : 0.5}
                      strokeWidth={selected === b.id ? 3 : 1.5}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {move?.moved && (
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 2400 }}>
            <polygon
              points={diamond(move.cell.ci, move.cell.cj, sizeOf(move.id))}
              fill={moveValid ? "#5cff5c" : "#ff4d3d"}
              fillOpacity={0.5}
              stroke={moveValid ? "#c8ffc8" : "#ffd0c8"}
              strokeWidth={3}
            />
          </svg>
        )}

        {castles.map((c) => (
          <img
            key={`o-${c.ci}-${c.cj}`}
            src="/village/castle.png"
            alt=""
            draggable={false}
            className="pointer-events-none absolute drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
            style={spriteAt("castle", footprintCenter(c, FOOTPRINT.castle))}
          />
        ))}

        {BUILDINGS.map((b) => {
          const level = levels[b.id] ?? 1;
          const isSelected = selected === b.id;
          const moving = move?.moved && move.id === b.id;
          const style = spriteAt(b.key, footprintCenter(positions[b.id], sizeOf(b.id)));
          return (
            <button
              key={b.id}
              className={`group absolute focus:outline-none ${readOnly ? "" : "cursor-move"}`}
              style={{ ...style, zIndex: moving ? 2500 : style.zIndex }}
              onPointerDown={(e) => startMove(e, b.id)}
              onPointerMove={continueMove}
              onPointerUp={(e) => endMove(e, b.id)}
              onPointerCancel={() => setMove(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (readOnly || !onMove) onSelect(isSelected ? null : b.id);
              }}
              aria-label={`${b.name} level ${level}`}
            >
              <img
                src={`/village/${b.key}.png`}
                alt=""
                draggable={false}
                className={`w-full transition duration-150 ${moving ? "-translate-y-3 opacity-90" : "group-hover:brightness-110"} ${
                  isSelected
                    ? "brightness-115 drop-shadow-[0_0_8px_rgba(255,247,194,0.95)]"
                    : "drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
                }`}
              />
            </button>
          );
        })}

        {nextTile && !readOnly && (
          <span
            className="clash-text pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-sm sm:text-base"
            style={{ ...pct(tileCenter(nextTile).x, tileCenter(nextTile).y), zIndex: 3000 }}
          >
            WIN TO CLAIM
          </span>
        )}

        {labelFor !== null && labelAt && (
          <span
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full flex-col items-center whitespace-nowrap"
            style={{ ...pct(labelAt.x, spriteTop(BUILDINGS[labelFor].key, labelAt.y) - 6), zIndex: 3000 }}
          >
            <span className="clash-text font-display text-base sm:text-lg">{BUILDINGS[labelFor].name}</span>
            <span className="clash-text font-display text-xs text-[#ffd84a] sm:text-sm">Level {levels[labelFor] ?? 1}</span>
          </span>
        )}

        {!readOnly && pending > 0 && !move?.moved && (
          <button
            className="collect-bubble absolute flex -translate-x-1/2 flex-col items-center"
            style={{ ...pct(goldMine.x, spriteTop("goldmine", goldMine.y) - 70), zIndex: 2000 }}
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
            style={{ ...pct(goldMine.x, spriteTop("goldmine", goldMine.y) - 85), zIndex: 2001 }}
          >
            {floatText}
          </span>
        )}
      </div>
    </div>
  );
}
