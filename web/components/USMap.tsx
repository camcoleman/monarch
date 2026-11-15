"use client";

import { geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/states-albers-10m.json";
import { STATES } from "@monarch/shared";
import { ownerColor } from "@/lib/format";

type StateFeature = Feature<Geometry, { name: string }>;

const topology = us as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
const features = (feature(topology, topology.objects.states) as FeatureCollection<Geometry, { name: string }>)
  .features as StateFeature[];
const path = geoPath();
const activeByFips = new Map<string, number>(STATES.map((s) => [s.fips, s.id]));

interface Props {
  owners: (string | null)[];
  selected: number | null;
  besieged: Set<number>;
  onSelect: (stateId: number) => void;
}

export function USMap({ owners, selected, besieged, onSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  const prevOwners = useRef<(string | null)[] | null>(null);

  const ownersKey = owners.join(",");
  useEffect(() => {
    const prev = prevOwners.current;
    prevOwners.current = owners;
    if (!prev || prev.length === 0 || owners.length === 0) return;
    const changed = owners.map((o, i) => (o !== prev[i] ? i : -1)).filter((i) => i >= 0);
    if (changed.length === 0) return;
    setFlashing(new Set(changed));
    const t = setTimeout(() => setFlashing(new Set()), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownersKey]);

  const labels = useMemo(
    () =>
      features
        .filter((f) => activeByFips.has(String(f.id)))
        .map((f) => {
          const id = activeByFips.get(String(f.id))!;
          const [x, y] = path.centroid(f);
          return { id, x, y };
        }),
    []
  );

  return (
    <svg viewBox="0 0 975 610" className="h-auto w-full select-none">
      {features.map((f) => {
        const stateId = activeByFips.get(String(f.id));
        const active = stateId !== undefined;
        const owner = active ? owners[stateId] : null;
        const fill = !active ? "#17151f" : owner ? ownerColor(owner) : "#3b3650";
        const isSelected = active && selected === stateId;
        const isHovered = active && hovered === stateId;
        return (
          <path
            key={String(f.id)}
            d={path(f) ?? undefined}
            fill={fill}
            fillOpacity={active ? (isHovered || isSelected ? 1 : 0.85) : 1}
            stroke={isSelected ? "#f5b301" : active ? "#0b0a12" : "#24212f"}
            strokeWidth={isSelected ? 3 : 1}
            className={
              active ? `cursor-pointer transition-[fill-opacity] ${flashing.has(stateId) ? "state-flash" : ""}` : ""
            }
            onMouseEnter={() => active && setHovered(stateId)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => active && onSelect(stateId)}
          >
            <title>{f.properties.name}</title>
          </path>
        );
      })}
      {labels.map(({ id, x, y }) => (
        <g key={id} pointerEvents="none">
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[14px] font-bold">
            {STATES[id].code}
          </text>
          {besieged.has(id) && (
            <text x={x} y={y + 18} textAnchor="middle" className="text-[14px]">
              ⚔️
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
