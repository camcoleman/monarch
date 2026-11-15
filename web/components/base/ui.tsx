"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { assetInfo, leagueFor, type AssetId } from "@monarch/shared";

export function GoldCoin({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#7a4a00] bg-[radial-gradient(circle_at_35%_30%,#fff7c2,#ffd21f_45%,#d18a00)] font-display text-[#7a4a00] shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)]"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      $
    </span>
  );
}

export function MonGem({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path d="M12 2 21 8.5 17.5 21h-11L3 8.5Z" fill="#9b87ff" stroke="#1d1206" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 2 9 8.5h6Zm-9 6.5h18M9 8.5 12 21l3-12.5" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    </svg>
  );
}

/** Grass tile: one plot of territory. */
export function LandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path d="M2 14.5 12 20l10-5.5v3L12 23 2 17.5Z" fill="#8b5a2b" stroke="#1d1206" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12 9 22 14.5 12 20 2 14.5Z" fill="#7cc828" stroke="#1d1206" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 13.5c0-3 1-5 2-6.5 1 1.5 2 3.5 2 6.5" fill="#4e9a12" stroke="#1d1206" strokeWidth="1" />
      <path d="M12 2v5.5" stroke="#1d1206" strokeWidth="1.3" />
      <path d="M12 2.5 17 4l-5 1.6Z" fill="#ee4a2a" stroke="#1d1206" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function TrophyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path
        d="M7 3h10v4a5 5 0 0 1-10 0Zm0 1.5H4v1.5a3.5 3.5 0 0 0 3.5 3.5M17 4.5h3V6a3.5 3.5 0 0 1-3.5 3.5"
        fill="#ffd21f"
        stroke="#1d1206"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10.5 12h3l.5 4h-4Z" fill="#e59b07" stroke="#1d1206" strokeWidth="1.3" />
      <rect x="7.5" y="16" width="9" height="4.5" rx="1" fill="#8b5a2b" stroke="#1d1206" strokeWidth="1.4" />
      <path d="M9 5.5c0 1.5.4 2.6 1.2 3.3" stroke="#fff" strokeOpacity=".8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Blue XP star with the Town Hall level, like Clash's experience badge. */
export function XpStar({ level, size = 56 }: { level: number; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full drop-shadow-[0_3px_0_rgb(29_18_6/0.6)]">
        <defs>
          <linearGradient id="xpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fe0ff" />
            <stop offset=".5" stopColor="#3aa2ec" />
            <stop offset="1" stopColor="#1e5fb0" />
          </linearGradient>
        </defs>
        <path
          d="M30 3 37.6 20.5 56.5 22.3 42.2 34.9 46.4 53.5 30 43.8 13.6 53.5 17.8 34.9 3.5 22.3 22.4 20.5Z"
          fill="url(#xpfill)"
          stroke="#1d1206"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <span className="clash-text relative mt-1 font-display" style={{ fontSize: size * 0.38 }}>
        {level}
      </span>
    </span>
  );
}

export function LeagueBadge({ trophies, size = 40 }: { trophies: number; size?: number }) {
  const { league } = leagueFor(trophies);
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} aria-label={`${league.name} league`} className="shrink-0">
      <defs>
        <linearGradient id={`lg-${league.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".4" stopColor={league.color} />
          <stop offset="1" stopColor={league.color} stopOpacity=".7" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 37 8v14c0 10-7.5 16.5-17 20C10.5 38.5 3 32 3 22V8Z"
        fill={`url(#lg-${league.name})`}
        stroke="#1d1206"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M20 11 23 18h7l-5.7 4.3 2.2 7L20 25l-6.5 4.3 2.2-7L10 18h7Z" fill="#fff" stroke="#1d1206" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Round coin badge for a tradable asset. */
export function AssetCoin({ asset, size = 28, locked = false }: { asset: AssetId; size?: number; locked?: boolean }) {
  const info = assetInfo(asset);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#1d1206] font-display text-white ${locked ? "grayscale" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * (asset.length > 3 ? 0.28 : 0.34),
        background: `radial-gradient(circle at 35% 30%, #ffffffaa, ${info.color} 55%, ${info.color})`,
        boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.25)",
        textShadow: "0 1px 0 #1d1206, 0 -1px 0 #1d1206, 1px 0 0 #1d1206, -1px 0 0 #1d1206",
      }}
    >
      {asset}
    </span>
  );
}

/** Clash-style resource bar: dark pill with a colored fill, value on top, icon overlapping the right end. */
export function HudBar({
  icon,
  value,
  fill,
  color,
  caption,
  action,
}: {
  icon: ReactNode;
  value: ReactNode;
  fill: number;
  color: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <div className="relative">
        {caption && (
          <span className="clash-text absolute -top-3.5 left-3 font-display text-[10px] uppercase tracking-wide">{caption}</span>
        )}
        <div className="hud-pill relative h-7 w-36 overflow-hidden pl-3 pr-8 sm:h-8 sm:w-44">
          <div
            className="absolute inset-y-0.5 left-0.5 rounded-full transition-[width] duration-700"
            style={{
              width: `calc(${Math.max(6, Math.min(1, fill) * 100)}% - 4px)`,
              background: `linear-gradient(180deg, #ffffff99, ${color} 45%, ${color})`,
            }}
          />
          <span className="clash-text relative flex h-full items-center justify-end font-display text-sm sm:text-base">{value}</span>
        </div>
        <span className="absolute -right-3 top-1/2 -translate-y-1/2">{icon}</span>
      </div>
      {action}
    </div>
  );
}

const ROUND_TONES = {
  wood: "bg-[linear-gradient(180deg,#d9a464_0%,#b07c45_50%,#8b5a2b_100%)]",
  gold: "bg-[linear-gradient(180deg,#fff3a0_0%,#ffd84a_48%,#ffbf1f_52%,#e59b07_100%)]",
  red: "bg-[linear-gradient(180deg,#ffb39b_0%,#ff7552_48%,#ee4a2a_52%,#c0261a_100%)]",
  green: "bg-[linear-gradient(180deg,#c4f56e_0%,#9ae03f_48%,#6dbb1d_52%,#4e9a12_100%)]",
  blue: "bg-[linear-gradient(180deg,#bfeaff_0%,#6cc4fa_48%,#3aa2ec_52%,#1e6fc4_100%)]",
} as const;

export type RoundTone = keyof typeof ROUND_TONES;

export function RoundButton({
  onClick,
  href,
  label,
  children,
  className = "",
  size = "md",
  tone = "wood",
  disabled,
}: {
  onClick?: () => void;
  href?: string;
  label: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
  tone?: RoundTone;
  disabled?: boolean;
}) {
  const dims = size === "sm" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-16 w-16 sm:h-20 sm:w-20";
  const rootClass = `group flex flex-col items-center gap-0.5 disabled:opacity-50 disabled:grayscale ${className}`;
  const inner = (
    <>
      <span
        className={`${dims} ${ROUND_TONES[tone]} flex items-center justify-center rounded-2xl border-[3px] border-[#1d1206] text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.22),inset_0_2px_0_rgb(255_255_255/0.5),0_3px_0_#1d1206] transition [&_svg]:drop-shadow-[0_2px_0_#1d1206] group-hover:brightness-110 group-active:translate-y-[2px]`}
      >
        {children}
      </span>
      <span className="clash-text font-display text-xs sm:text-sm">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} className={rootClass}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} disabled={disabled} aria-label={label} className={rootClass}>
      {inner}
    </button>
  );
}

/** Parchment window with a wooden title bar and a red close button. */
export function ClashModal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-3" onClick={onClose}>
      <div
        className={`pop-in panel relative max-h-[88vh] w-full overflow-hidden rounded-3xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wood-header relative flex items-center justify-center px-14 py-3">
          <h2 className="clash-text text-center font-display text-xl sm:text-2xl">{title}</h2>
          <button
            onClick={onClose}
            className="btn-red absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg! p-0!"
            aria-label="Close"
          >
            <X size={20} strokeWidth={4} />
          </button>
        </div>
        <div className="relative max-h-[calc(88vh-64px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
