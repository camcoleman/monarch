export function GoldCoin({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full border border-amber-800 bg-[radial-gradient(circle_at_35%_30%,#fff3b0,#f5c400_45%,#b77900)] font-black text-amber-800 shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)]"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      $
    </span>
  );
}
