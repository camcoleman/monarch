"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { leagueFor } from "@monarch/shared";

export function GoldCoin({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-amber-800 bg-[radial-gradient(circle_at_35%_30%,#fff3b0,#f5c400_45%,#b77900)] font-black text-amber-800 shadow-[inset_0_-2px_0_rgb(0_0_0/0.25),0_0_10px_rgb(251_191_36/0.6)]"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      $
    </span>
  );
}

export function MonGem({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0 drop-shadow-[0_0_6px_rgb(131_110_249/0.9)]">
      <path d="M12 2 21 8.5 17.5 21h-11L3 8.5Z" fill="#836ef9" stroke="#e9e3ff" strokeWidth="1.2" />
      <path d="M12 2 9 8.5h6Zm-9 6.5h18M9 8.5 12 21l3-12.5" fill="none" stroke="#e9e3ff" strokeOpacity=".6" strokeWidth="1" />
    </svg>
  );
}

export function LandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0 drop-shadow-[0_0_6px_rgb(34_211_238/0.9)]">
      <path d="M12 3 22 8.5 12 14 2 8.5Z" fill="#22d3ee" fillOpacity=".35" stroke="#a5f3fc" strokeWidth="1.3" />
      <path d="M2 12.5 12 18l10-5.5M2 16.5 12 22l10-5.5" fill="none" stroke="#a5f3fc" strokeOpacity=".7" strokeWidth="1.3" />
    </svg>
  );
}

export function LeagueBadge({ trophies, size = 40 }: { trophies: number; size?: number }) {
  const { league } = leagueFor(trophies);
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} aria-label={`${league.name} league`} className="shrink-0">
      <defs>
        <linearGradient id={`lg-${league.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".35" stopColor={league.color} />
          <stop offset="1" stopColor={league.color} stopOpacity=".55" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 37 8v14c0 10-7.5 16.5-17 20C10.5 38.5 3 32 3 22V8Z"
        fill={`url(#lg-${league.name})`}
        stroke="#0b1220"
        strokeWidth="2.5"
        style={{ filter: `drop-shadow(0 0 6px ${league.color})` }}
      />
      <path d="M20 11 23 18h7l-5.7 4.3 2.2 7L20 25l-6.5 4.3 2.2-7L10 18h7Z" fill="#0b1220" fillOpacity=".75" />
    </svg>
  );
}

/** Clash-style resource bar: icon overlapping a glowing fill bar with the value on top. */
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
        <div className="chamfer holo relative h-8 w-36 overflow-hidden pl-3 pr-8 sm:h-9 sm:w-44">
          <div
            className="absolute inset-y-0 left-0 opacity-45 transition-[width] duration-700"
            style={{ width: `${Math.max(4, Math.min(1, fill) * 100)}%`, background: `linear-gradient(90deg, transparent, ${color})` }}
          />
          <span className="hud-text relative flex h-full items-center justify-end font-display text-sm font-bold sm:text-base">
            {value}
          </span>
        </div>
        {caption && (
          <span className="absolute -bottom-3.5 right-8 text-[9px] uppercase tracking-widest text-cyan-200/70">{caption}</span>
        )}
        <span className="absolute -right-2 top-1/2 -translate-y-1/2">{icon}</span>
      </div>
      {action}
    </div>
  );
}

export function RoundButton({
  onClick,
  href,
  label,
  children,
  className = "",
  size = "md",
  disabled,
}: {
  onClick?: () => void;
  href?: string;
  label: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const dims = size === "sm" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-16 w-16 sm:h-20 sm:w-20";
  const rootClass = `group flex flex-col items-center gap-1 disabled:opacity-40 ${className}`;
  const inner = (
    <>
      <span
        className={`${dims} flex items-center justify-center rounded-2xl border-2 border-neon/50 bg-gradient-to-b from-slate-800/90 to-slate-950/90 text-neon shadow-[0_0_20px_-4px_rgb(34_211_238/0.7),inset_0_1px_0_rgb(255_255_255/0.15)] transition group-hover:scale-105 group-hover:border-neon group-active:scale-95`}
      >
        {children}
      </span>
      <span className="hud-text font-display text-[10px] font-bold uppercase tracking-wider sm:text-xs">{label}</span>
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

export function HoloModal({
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`pop-in holo relative max-h-[88vh] w-full overflow-hidden rounded-3xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scanlines pointer-events-none absolute inset-0" />
        <div className="relative flex items-center justify-between border-b border-neon/25 bg-gradient-to-r from-neon/15 via-royal/10 to-transparent px-5 py-3">
          <h2 className="hud-text font-display text-lg font-bold uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-cyan-200 hover:bg-white/10" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="relative max-h-[calc(88vh-56px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
