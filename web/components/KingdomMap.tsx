"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BUILDINGS, MAX_LAND, leagueFor } from "@monarch/shared";
import type { PlayerData } from "@/hooks/useMonarch";
import { shortAddr } from "@/lib/format";
import { BUILDING_TILES, GRID, TILE_ORDER, VIEW_H, VIEW_W, pct, spriteStyle, tileCenter, tilePoints } from "./base/World";
import { GoldCoin, LandIcon, LeagueBadge, TrophyIcon } from "./base/ui";

/** World-space size of one kingdom plot (the village ground art at half scale). */
const SLOT_W = VIEW_W / 2;
const SLOT_H = VIEW_H / 2;
/** Plots overlap so their forest borders blend into one landscape. */
const STEP_X = SLOT_W * 0.78;
const STEP_Y = SLOT_H * 0.78;
const PLOT_MASK = "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)";
const MAX_ZOOM = 2.5;
const FIELD_OUTLINE = (() => {
  const hw = (GRID.size * GRID.tw) / 2;
  const hh = (GRID.size * GRID.th) / 2;
  return `${GRID.cx},${GRID.cy - hh} ${GRID.cx + hw},${GRID.cy} ${GRID.cx},${GRID.cy + hh} ${GRID.cx - hw},${GRID.cy}`;
})();

const hue = (addr: string) => parseInt(addr.slice(2, 8), 16) % 360;
const territoryColor = (addr: string) => `hsl(${hue(addr)} 85% 55%)`;

/** Grid cells ordered from the center outward, so the top-ranked kingdom sits in the middle of the map. */
function spiralCells(cols: number) {
  const mid = (cols - 1) / 2;
  const cells: { c: number; r: number }[] = [];
  for (let r = 0; r < cols; r++) for (let c = 0; c < cols; c++) cells.push({ c, r });
  return cells.sort(
    (a, b) =>
      Math.hypot(a.c - mid, a.r - mid) - Math.hypot(b.c - mid, b.r - mid) ||
      Math.atan2(a.r - mid, a.c - mid) - Math.atan2(b.r - mid, b.c - mid)
  );
}

interface Props {
  players: PlayerData[];
  me?: string;
}

export function KingdomMap({ players, me }: Props) {
  const ranked = useMemo(
    () => [...players].sort((a, b) => b.land - a.land || b.trophies - a.trophies),
    [players]
  );
  let cols = 3;
  while (cols * cols < ranked.length + 4) cols += 2;
  const cells = useMemo(() => spiralCells(cols), [cols]);
  const worldW = (cols - 1) * STEP_X + SLOT_W;
  const worldH = (cols - 1) * STEP_Y + SLOT_H;

  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; dist: number; view: typeof view; moved: boolean } | null>(null);
  const centered = useRef(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrame({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const minZoom = frame.w ? Math.min(frame.w / worldW, frame.h / worldH) * 0.9 : 0.1;
  const clampView = (v: typeof view) => {
    const s = Math.min(MAX_ZOOM, Math.max(minZoom, v.s));
    const w = worldW * s;
    const h = worldH * s;
    const x = w <= frame.w ? (frame.w - w) / 2 : Math.min(0, Math.max(frame.w - w, v.x));
    const y = h <= frame.h ? (frame.h - h) / 2 : Math.min(0, Math.max(frame.h - h, v.y));
    return { x, y, s };
  };

  const slotOf = (addr: string) => {
    const idx = ranked.findIndex((p) => p.address === addr);
    return idx >= 0 ? cells[idx] : null;
  };

  const focus = (addr: string | undefined, s = 1.1) => {
    const cell = (addr && slotOf(addr)) || cells[0];
    const cx = cell.c * STEP_X + SLOT_W / 2;
    const cy = cell.r * STEP_Y + SLOT_H / 2;
    setView(clampView({ x: frame.w / 2 - cx * s, y: frame.h / 2 - cy * s, s }));
  };

  // Open centered on the player's own kingdom (or the top kingdom) once the frame and players are known.
  useEffect(() => {
    if (!frame.w || centered.current || (players.length === 0 && !me)) return;
    centered.current = true;
    focus(me && slotOf(me) ? me : undefined, Math.max(minZoom, Math.min(1, frame.w / (SLOT_W * 2.2))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, players.length, me]);

  useEffect(() => {
    setView((v) => clampView(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, frame.h, worldW]);

  const zoomAt = (px: number, py: number, s: number) =>
    setView((v) => {
      const ns = Math.min(MAX_ZOOM, Math.max(minZoom, s));
      return clampView({ x: px - ((px - v.x) * ns) / v.s, y: py - ((py - v.y) * ns) / v.s, s: ns });
    });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { x: cx, y: cy, dist, view, moved: gesture.current?.moved ?? false };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) gesture.current = null;
    startGesture();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    if (!g.moved && Math.hypot(cx - g.x, cy - g.y) < 6 && pts.length === 1) return;
    if (!g.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    g.moved = true;
    let s = g.view.s;
    if (pts.length > 1 && g.dist > 0) {
      s = Math.min(MAX_ZOOM, Math.max(minZoom, (g.view.s * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / g.dist));
    }
    const x = cx - ((g.x - g.view.x) * s) / g.view.s;
    const y = cy - ((g.y - g.view.y) * s) / g.view.s;
    setView(clampView({ x, y, s }));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) startGesture();
  };

  const selectedPlayer = selected ? ranked.find((p) => p.address === selected) : undefined;

  return (
    <div className="panel relative h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden p-0!">
      <div
        ref={frameRef}
        className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden bg-[#244a14] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          const p = local(e);
          zoomAt(p.x, p.y, view.s * Math.exp(-e.deltaY * 0.0015));
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: worldW, height: worldH, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          onClickCapture={(e) => {
            if (gesture.current?.moved) e.stopPropagation();
          }}
          onClick={() => setSelected(null)}
        >
          {/* Outer plots first so overlapping wilderness never covers a kingdom's field. */}
          {[...cells.entries()].reverse().map(([idx, cell]) => {
            const p = ranked[idx];
            return (
              <Plot
                key={`${cell.c}-${cell.r}`}
                left={cell.c * STEP_X}
                top={cell.r * STEP_Y}
                labelScale={Math.min(3, 0.75 / view.s)}
                player={p}
                mine={Boolean(p && p.address === me)}
                selected={Boolean(p && p.address === selected)}
                onSelect={() => p && setSelected(p.address)}
              />
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <span className="flex items-center gap-1.5 rounded-lg border-2 border-[#1d1206] bg-[#1d1206]/75 px-3 py-1 font-display text-sm text-white">
          <LandIcon size={18} /> {ranked.length} {ranked.length === 1 ? "kingdom" : "kingdoms"}
        </span>
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button className="btn-ghost h-10 w-10 p-0! text-xl" aria-label="Zoom in" onClick={() => zoomAt(frame.w / 2, frame.h / 2, view.s * 1.35)}>
          +
        </button>
        <button className="btn-ghost h-10 w-10 p-0! text-xl" aria-label="Zoom out" onClick={() => zoomAt(frame.w / 2, frame.h / 2, view.s / 1.35)}>
          −
        </button>
        <button className="btn-ghost h-10 px-2! text-xs" onClick={() => setView(clampView({ x: 0, y: 0, s: minZoom }))}>
          All
        </button>
        {me && slotOf(me) && (
          <button className="btn-gold h-10 px-2! text-xs" onClick={() => focus(me, 1.2)}>
            Me
          </button>
        )}
      </div>

      <p className="clash-text pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 font-display text-xs sm:block">
        Drag to move · scroll or pinch to zoom · tap a kingdom
      </p>

      {selectedPlayer && <KingdomCard player={selectedPlayer} mine={selectedPlayer.address === me} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Plot({
  left,
  top,
  player,
  mine,
  selected,
  onSelect,
  labelScale,
}: {
  left: number;
  top: number;
  labelScale: number;
  player?: PlayerData;
  mine: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = { left, top, width: SLOT_W, height: SLOT_H };
  const ground = <div className="absolute inset-0 bg-[url(/village/ground.jpg)] bg-cover" style={{ maskImage: PLOT_MASK, WebkitMaskImage: PLOT_MASK }} />;
  if (!player) {
    return (
      <div className="absolute brightness-[0.8] saturate-[0.7]" style={style}>
        {ground}
        <span className="clash-text absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-lg opacity-60">
          Wilderness
        </span>
      </div>
    );
  }

  const color = territoryColor(player.address);
  const land = Math.min(player.land, MAX_LAND);
  const outposts = TILE_ORDER.slice(BUILDING_TILES.length, land);
  const top3 = tileCenter(BUILDING_TILES[0]);

  return (
    <div className="absolute" style={style}>
      {ground}
      <button
        className="absolute inset-0 cursor-pointer focus:outline-none"
        aria-label={`${player.name}'s kingdom`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {TILE_ORDER.map((t, idx) => (
            <polygon
              key={`${t.i}-${t.j}`}
              points={tilePoints(t, 3)}
              fill={idx < land ? color : "#1f3d0c"}
              fillOpacity={idx < land ? 0.32 : 0.28}
              stroke={idx < land ? color : "#ffffff"}
              strokeOpacity={idx < land ? 0.9 : 0.1}
              strokeWidth={idx < land ? 4 : 2}
              strokeDasharray={idx < land ? undefined : "10 8"}
            />
          ))}
          {(selected || mine) && (
            <polygon
              points={FIELD_OUTLINE}
              fill="none"
              stroke={selected ? "#fff7c2" : "#ffd84a"}
              strokeWidth={selected ? 12 : 8}
              strokeDasharray={selected ? undefined : "26 14"}
            />
          )}
        </svg>
        {outposts.map((t) => (
          <img key={`o-${t.i}-${t.j}`} src="/village/castle.png" alt="" draggable={false} className="absolute" style={spriteStyle("castle", t)} />
        ))}
        {BUILDINGS.map((b) => (
          <img key={b.id} src={`/village/${b.key}.png`} alt="" draggable={false} className="absolute" style={spriteStyle(b.key, BUILDING_TILES[b.id])} />
        ))}
      </button>
      <div
        className="pointer-events-none absolute flex origin-bottom flex-col items-center"
        style={{ ...pct(top3.x, top3.y - 190), transform: `translate(-50%, -100%) scale(${labelScale})`, zIndex: 2000 }}
      >
        <span
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border-[3px] border-[#1d1206] px-3 py-0.5 font-display text-xl text-white shadow-[0_3px_0_#1d1206]"
          style={{ background: mine ? "linear-gradient(180deg,#ffd84a,#e0a400)" : `linear-gradient(180deg,${color},hsl(${hue(player.address)} 70% 35%))` }}
        >
          <span className="clash-text">{mine ? `${player.name} (you)` : player.name}</span>
        </span>
        <span className="mt-1 flex items-center gap-2 rounded-md bg-[#1d1206]/70 px-2 py-0.5 font-display text-sm text-white">
          <TrophyIcon size={16} /> {player.trophies}
          <LandIcon size={16} /> {land}/{MAX_LAND}
        </span>
      </div>
    </div>
  );
}

function KingdomCard({ player, mine, onClose }: { player: PlayerData; mine: boolean; onClose: () => void }) {
  const { league } = leagueFor(player.trophies);
  return (
    <div className="panel absolute bottom-3 left-3 right-3 mx-auto flex max-w-md items-center gap-3 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <LeagueBadge trophies={player.trophies} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl">
          {player.name} {mine && <span className="text-muted">(you)</span>}
        </p>
        <p className="font-mono text-xs text-muted">{shortAddr(player.address)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-sm">
          <span style={{ color: league.color, textShadow: "0 1px 0 #1d1206" }}>{league.name}</span>
          <span className="flex items-center gap-1">
            <TrophyIcon size={16} /> {player.trophies}
          </span>
          <span className="flex items-center gap-1">
            <LandIcon size={16} /> {Math.min(player.land, MAX_LAND)}/{MAX_LAND}
          </span>
          <span className="flex items-center gap-1">
            <GoldCoin size={14} /> {player.gold}
          </span>
          <span>
            {player.wins}W / {player.losses}L
          </span>
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Link href={mine ? "/" : `/kingdom/${player.address}`} className={`${mine ? "btn-green" : "btn-red"} px-3 py-1.5 text-sm`}>
          {mine ? "Visit" : "Scout"}
        </Link>
        <button className="btn-ghost px-3 py-1 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
