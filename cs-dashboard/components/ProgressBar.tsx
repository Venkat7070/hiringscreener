export default function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
      <span className="num text-xs text-text/70">{Math.round(pct)}%</span>
    </div>
  );
}
