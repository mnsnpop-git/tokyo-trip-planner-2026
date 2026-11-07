/** Visited progress bar ("ไปแล้ว x/y"), shared by the All summary and each day's timeline. */
export function Progress({
  done,
  total,
  className = "mt-3",
  label = "ไปแล้ว",
}: {
  done: number;
  total: number;
  className?: string;
  label?: string;
}) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className={`flex items-center gap-2 text-xs text-ink-soft ${className}`}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-done-ink/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0">
        {label} {done}/{total}
      </span>
    </div>
  );
}
