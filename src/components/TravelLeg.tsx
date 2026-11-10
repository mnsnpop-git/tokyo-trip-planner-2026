"use client";

import {
  TRAVEL_MODES,
  directionsUrl,
  estimateTravel,
  formatKm,
  formatMinutes,
  minutesBetween,
  type LatLng,
} from "@/lib/travelEstimate";

export interface LegEnd {
  name: string;
  time: string; // HH:MM
  mapUrl: string; // "" when the plan has no usable link
  /** LatLng = found, null = no location in the link, undefined = still looking. */
  coords: LatLng | null | undefined;
}

/** The trip from one activity to the next: estimated mode, time and distance, plus real directions. */
export function TravelLeg({
  from,
  to,
  label,
  className = "pl-3",
}: {
  from: LegEnd;
  to: LegEnd;
  /** Shown before the estimate, e.g. "จากที่พัก Hotel X". */
  label?: string;
  className?: string;
}) {
  const a = from.coords;
  const b = to.coords;
  const estimate = a && b ? estimateTravel(a, b) : null;
  const loading = (from.mapUrl && a === undefined) || (to.mapUrl && b === undefined);
  const gap = minutesBetween(from.time, to.time);
  const tooTight = estimate && gap !== null && gap >= 0 && estimate.minutes > gap;
  const href = directionsUrl({ coords: a ?? null, name: from.name }, { coords: b ?? null, name: to.name }, estimate?.mode);
  const missing = [!from.mapUrl || a === null ? from.name : "", !to.mapUrl || b === null ? to.name : ""].filter(Boolean);

  return (
    <li aria-label={`การเดินทางจาก ${from.name} ไป ${to.name}`} className={`flex items-start gap-2 text-xs text-ink-soft ${className}`}>
      <span aria-hidden className="mt-0.5 h-4 border-l-2 border-dotted border-line" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {label && <span className="min-w-0 break-words">{label}</span>}
          {estimate ? (
            estimate.km < 0.1 ? (
              <span>📍 อยู่ใกล้กัน (ไม่ถึง 100 ม.)</span>
            ) : (
              <span className="font-medium text-ink">
                {TRAVEL_MODES[estimate.mode].icon} {TRAVEL_MODES[estimate.mode].label} ~{formatMinutes(estimate.minutes)}
                <span className="font-normal text-ink-soft"> · {formatKm(estimate.km)}</span>
              </span>
            )
          ) : loading ? (
            <span>กำลังประมาณเวลาเดินทาง…</span>
          ) : (
            <span>🧭 ยังประมาณเวลาไม่ได้</span>
          )}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-full px-1.5 py-0.5 font-medium text-baby-ink hover:bg-baby"
          >
            เส้นทาง ↗
          </a>
        </div>
        {tooTight && (
          <p className="mt-0.5 text-pending-ink">เวลาเดินทางเกินช่วงห่างระหว่างกิจกรรม ({formatMinutes(gap)})</p>
        )}
        {!estimate && !loading && missing.length > 0 && (
          <p className="mt-0.5 text-ink-soft/70">ไม่พบพิกัดจากลิงก์ Google Maps ของ {missing.join(", ")}</p>
        )}
      </div>
    </li>
  );
}
