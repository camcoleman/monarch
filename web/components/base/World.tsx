"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS, MAX_LAND } from "@monarch/shared";
import { GoldCoin } from "./ui";

/** World coordinates; the ground art is 16:9. */
export const VIEW_W = 1600;
export const VIEW_H = 900;
/** Isometric 5x5 territory grid in the middle of the grass field of the ground art. */
export const GRID = { cx: 808, cy: 428, tw: 120, th: 79.25, size: 5 };
/** Grass checks per tile edge. */
const CHECKS = 2;
/** Checkered grass extends this many tiles past the territory on every side, filling the field. */
const FIELD_MARGIN = 2;
/** The art is drawn at a steeper angle than the ground grid; flattening it lines the bases up and lowers the buildings. */
const SQUASH = 0.88;

export type Tile = { i: number; j: number };
/** Tile per piece: building IDs first, then one outpost castle per extra plot of land (piece ID = land index). */
export type Layout = Record<number, Tile>;

/** Default building tile per building ID: center, left, right, bottom of the grid. */
export const BUILDING_TILES: Tile[] = [
  { i: 2, j: 2 },
  { i: 1, j: 3 },
  { i: 3, j: 1 },
  { i: 3, j: 3 },
];

/**
 * Sprite placement, measured from the art: `baseY` is the center of the stone/rock base as a fraction of image
 * height, `aspect` is height / width, and `fill` is the base width as a fraction of the tile width.
 */
const SPRITE: Record<string, { baseY: number; aspect: number; fill: number }> = {
  townhall: { baseY: 0.701, aspect: 512 / 430, fill: 1 },
  goldmine: { baseY: 0.669, aspect: 442 / 512, fill: 0.9 },
  barracks: { baseY: 0.698, aspect: 512 / 444, fill: 0.88 },
  trophyhall: { baseY: 0.748, aspect: 512 / 424, fill: 0.84 },
  castle: { baseY: 0.802, aspect: 512 / 307, fill: 0.62 },
};

const spriteWidth = (key: string) => GRID.tw * SPRITE[key].fill;
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

/** Grid vertex where tile lines u and v cross (fractional values address the grass checks). */
const vertex = (u: number, v: number) => ({
  x: GRID.cx + ((u - v) * GRID.tw) / 2,
  y: GRID.cy + ((u + v - GRID.size) * GRID.th) / 2,
});

/** Diamond covering `size` tiles from tile coordinate (u, v), shrunk toward its center by `inset`. */
function diamond(u: number, v: number, size: number, inset = 0) {
  const c = vertex(u + size / 2, v + size / 2);
  const k = 1 - inset;
  return [vertex(u, v), vertex(u + size, v), vertex(u + size, v + size), vertex(u, v + size)]
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

const tileKey = (t: Tile) => `${t.i},${t.j}`;
const sameTile = (a: Tile, b: Tile) => a.i === b.i && a.j === b.j;

/** Pieces on the village: the four buildings, then an outpost castle for every plot beyond the starting four. */
export const isOutpost = (piece: number) => piece >= BUILDINGS.length;
const pieceKey = (piece: number) => (isOutpost(piece) ? "castle" : BUILDINGS[piece].key);

/**
 * Tile of every piece. Saved positions win when they're on claimed land and not already taken; anything else falls
 * back to its claim-order plot, then to the first free claimed plot.
 */
export function resolveLayout(layout: Layout, land: number): Tile[] {
  const claimedCount = Math.min(Math.max(land, BUILDINGS.length), MAX_LAND);
  const claimed = new Set(TILE_ORDER.slice(0, claimedCount).map(tileKey));
  const used = new Set<string>();
  const out: Tile[] = [];
  const pieces = Array.from({ length: claimedCount }, (_, p) => p);
  const take = (p: number, t: Tile) => {
    out[p] = t;
    used.add(tileKey(t));
  };
  const leftover: number[] = [];
  for (const p of pieces) {
    const saved = layout[p];
    if (saved && claimed.has(tileKey(saved)) && !used.has(tileKey(saved))) take(p, saved);
    else leftover.push(p);
  }
  for (const p of leftover) {
    const home = TILE_ORDER[p];
    take(p, used.has(tileKey(home)) ? TILE_ORDER.slice(0, claimedCount).find((t) => !used.has(tileKey(t)))! : home);
  }
  return out;
}

/** Pointer capture throws if the pointer is already gone (e.g. a lifted touch); dragging still works without it. */
function capture(e: ReactPointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {}
}

interface Props {
  levels: number[];
  land: number;
  layout?: Layout;
  /** Saves new tiles for one or two pieces (two when a drop swaps places). */
  onMove?: (changes: Layout) => void;
  selected: number | null;
  onSelect: (piece: number | null) => void;
  pending: number;
  onCollect?: () => void;
  collecting?: boolean;
  floatText?: string | null;
  readOnly?: boolean;
}

type Move = { piece: number; pointerId: number; x: number; y: number; grab: { a: number; b: number }; tile: Tile; moved: boolean };

export function World({
  levels,
  land,
  layout = {},
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
  const claimed = useMemo(() => new Set(claimedTiles.map(tileKey)), [claimedTiles]);
  const nextTile = land < MAX_LAND ? TILE_ORDER[land] : null;

  const tiles = useMemo(() => resolveLayout(layout, land), [layout, land]);
  const pieces = tiles.map((_, p) => p);
  const tileOf = (p: number) => (move?.moved && move.piece === p ? move.tile : tiles[p]);

  /** Screen point to fractional (i - j, i + j) tile coordinates. */
  const toGrid = (clientX: number, clientY: number) => {
    const r = worldRef.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * VIEW_W;
    const vy = ((clientY - r.top) / r.height) * VIEW_H;
    return { a: (vx - GRID.cx) / (GRID.tw / 2), b: (vy - GRID.cy) / (GRID.th / 2) + (GRID.size - 1) };
  };

  const startMove = (e: ReactPointerEvent, piece: number) => {
    if (readOnly || !onMove) return;
    e.stopPropagation();
    capture(e);
    const t = tiles[piece];
    const p = toGrid(e.clientX, e.clientY);
    setMove({ piece, pointerId: e.pointerId, x: e.clientX, y: e.clientY, grab: { a: p.a - (t.i - t.j), b: p.b - (t.i + t.j) }, tile: t, moved: false });
  };

  const continueMove = (e: ReactPointerEvent) => {
    if (!move || e.pointerId !== move.pointerId) return;
    if (!move.moved && Math.hypot(e.clientX - move.x, e.clientY - move.y) < 6) return;
    const p = toGrid(e.clientX, e.clientY);
    const a = p.a - move.grab.a;
    const b = p.b - move.grab.b;
    const last = GRID.size - 1;
    const tile = {
      i: Math.min(last, Math.max(0, Math.round((a + b) / 2))),
      j: Math.min(last, Math.max(0, Math.round((b - a) / 2))),
    };
    setMove({ ...move, tile, moved: true });
    if (selected !== move.piece) onSelect(move.piece);
  };

  const endMove = (e: ReactPointerEvent, piece: number) => {
    if (!move || e.pointerId !== move.pointerId) return;
    if (!move.moved) {
      onSelect(selected === piece ? null : piece);
    } else if (claimed.has(tileKey(move.tile)) && !sameTile(move.tile, tiles[piece])) {
      const other = tiles.findIndex((t, p) => p !== piece && sameTile(t, move.tile));
      onMove?.(other === -1 ? { [piece]: move.tile } : { [piece]: move.tile, [other]: tiles[piece] });
    }
    setMove(null);
  };

  const moveValid = move?.moved ? claimed.has(tileKey(move.tile)) : true;
  const swapWith = move?.moved && moveValid ? tiles.findIndex((t, p) => p !== move.piece && sameTile(t, move.tile)) : -1;

  const boundary = useMemo(() => {
    const edges: [number, number, number, number][] = [];
    for (const t of claimedTiles) {
      const { i: u, j: v } = t;
      if (!claimed.has(`${t.i},${t.j - 1}`)) edges.push([u, v, u + 1, v]);
      if (!claimed.has(`${t.i + 1},${t.j}`)) edges.push([u + 1, v, u + 1, v + 1]);
      if (!claimed.has(`${t.i},${t.j + 1}`)) edges.push([u + 1, v + 1, u, v + 1]);
      if (!claimed.has(`${t.i - 1},${t.j}`)) edges.push([u, v + 1, u, v]);
    }
    return edges;
  }, [claimedTiles, claimed]);

  const checks = useMemo(() => {
    const out: { u: number; v: number }[] = [];
    const lo = -FIELD_MARGIN * CHECKS;
    const hi = (GRID.size + FIELD_MARGIN) * CHECKS;
    for (let u = lo; u < hi; u++) for (let v = lo; v < hi; v++) out.push({ u, v });
    return out;
  }, []);

  const goldMine = tileCenter(tileOf(1));
  const labelFor = move?.moved ? move.piece : selected;
  const labelTile = labelFor !== null && labelFor < tiles.length ? tileOf(labelFor) : null;

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

          {/* Checkered grass, darker where the land isn't claimed yet. */}
          {checks.map(({ u, v }) => {
            const owned = claimed.has(`${Math.floor(u / CHECKS)},${Math.floor(v / CHECKS)}`);
            const light = (u + v + 2 * FIELD_MARGIN * CHECKS) % 2 === 0;
            return (
              <polygon
                key={`c-${u}-${v}`}
                points={diamond(u / CHECKS, v / CHECKS, 1 / CHECKS)}
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
              points={diamond(nextTile.i, nextTile.j, 1, 0.04)}
              fill="#ffd84a"
              fillOpacity={0.12}
              stroke="#ffd84a"
              strokeWidth={3}
              strokeDasharray="12 8"
            />
          )}

          {pieces.map((p) => {
            if (move?.moved && move.piece === p) return null;
            const t = tiles[p];
            const { x, y } = tileCenter(t);
            const isSel = selected === p;
            return (
              <g key={`pad-${p}`}>
                <ellipse cx={x - 6} cy={y + 5} rx={GRID.tw * 0.36} ry={GRID.th * 0.33} fill="#000" fillOpacity={0.32} filter="url(#soft-shadow)" />
                <polygon
                  points={diamond(t.i, t.j, 1, 0.06)}
                  fill="#6b5626"
                  fillOpacity={0.55}
                  stroke={isSel ? "#fff7c2" : "#3d3214"}
                  strokeOpacity={isSel ? 1 : 0.5}
                  strokeWidth={isSel ? 3 : 1.5}
                />
              </g>
            );
          })}
        </svg>

        {move?.moved && (
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 2400 }}>
            {claimedTiles.map((t) => (
              <polygon key={`m-${t.i}-${t.j}`} points={diamond(t.i, t.j, 1, 0.04)} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="8 6" />
            ))}
            <polygon
              points={diamond(move.tile.i, move.tile.j, 1, 0.02)}
              fill={moveValid ? "#5cff5c" : "#ff4d3d"}
              fillOpacity={0.45}
              stroke={moveValid ? "#c8ffc8" : "#ffd0c8"}
              strokeWidth={3}
            />
          </svg>
        )}

        {pieces.map((p) => {
          const key = pieceKey(p);
          const isSelected = selected === p;
          const moving = move?.moved && move.piece === p;
          const swapping = swapWith === p;
          const style = spriteAt(key, tileCenter(tileOf(p)));
          const name = isOutpost(p) ? "Outpost" : BUILDINGS[p].name;
          return (
            <button
              key={`piece-${p}`}
              className={`group absolute focus:outline-none ${readOnly ? "" : "cursor-move"}`}
              style={{ ...style, zIndex: moving ? 2500 : style.zIndex }}
              onPointerDown={(e) => startMove(e, p)}
              onPointerMove={continueMove}
              onPointerUp={(e) => endMove(e, p)}
              onPointerCancel={() => setMove(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (readOnly || !onMove) onSelect(isSelected ? null : p);
              }}
              aria-label={isOutpost(p) ? name : `${name} level ${levels[p] ?? 1}`}
            >
              <img
                src={`/village/${key}.png`}
                alt=""
                draggable={false}
                className={`w-full transition duration-150 ${moving ? "-translate-y-3 opacity-90" : swapping ? "opacity-60" : "group-hover:brightness-110"} ${
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
            className="clash-text pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[10px] sm:text-xs"
            style={{ ...pct(tileCenter(nextTile).x, tileCenter(nextTile).y), zIndex: 3000 }}
          >
            WIN TO CLAIM
          </span>
        )}

        {labelFor !== null && labelTile && (
          <span
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full flex-col items-center whitespace-nowrap"
            style={{ ...pct(tileCenter(labelTile).x, spriteTop(pieceKey(labelFor), tileCenter(labelTile).y) - 6), zIndex: 3000 }}
          >
            <span className="clash-text font-display text-base sm:text-lg">{isOutpost(labelFor) ? "Outpost" : BUILDINGS[labelFor].name}</span>
            <span className="clash-text font-display text-xs text-[#ffd84a] sm:text-sm">
              {move?.moved ? (moveValid ? (swapWith !== -1 ? "Drop to swap" : "Drop to move") : "Your land only") : isOutpost(labelFor) ? "Land won in battle" : `Level ${levels[labelFor] ?? 1}`}
            </span>
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
