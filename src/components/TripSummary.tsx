"use client";

import { useState } from "react";
import { Progress } from "./Progress";
import { TravelSection, TravelStrip } from "./Travel";
import {
  activePlace,
  categoryBadge,
  findCategory,
  formatDate,
  needsBooking,
  type Flight,
  type Hotel,
  type Member,
  type TripData,
  sumJpy,
  yen,
  type Expense,
  requiresBooking,
  type Activity,
  type Category,
  type Day,
} from "@/lib/trip";

type GroupBy = "day" | "category";

/** Trip overview shown on the "All" day tab: totals, then activities grouped per day or per category. */
export function TripSummary({
  days,
  activities,
  categories,
  costs,
  thbPerJpy,
  flights,
  hotels,
  members,
  onTravelChange,
  onOpenDay,
}: {
  flights: Flight[];
  hotels: Hotel[];
  members: Member[];
  onTravelChange: (patch: Partial<Pick<TripData, "flights" | "hotels">>) => void;
  days: Day[];
  activities: Activity[];
  categories: Category[];
  /** Expenses tied to each activity, keyed by activity id. */
  costs: Map<string, Expense[]>;
  thbPerJpy: number;
  onOpenDay: (dayId: string) => void;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  // Day ids whose activity list is collapsed; everything starts expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleDay = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = days.length > 0 && days.every((d) => collapsed.has(d.id));

  const dayIndex = new Map(days.map((d, i) => [d.id, i]));
  // Only activities that belong to an existing day, in trip order (day, then time).
  const ordered = activities
    .filter((a) => dayIndex.has(a.dayId))
    .sort((a, b) => dayIndex.get(a.dayId)! - dayIndex.get(b.dayId)! || a.time.localeCompare(b.time));

  const visited = ordered.filter((a) => a.visited).length;
  const withBackup = ordered.filter((a) => a.backups.length > 0).length;
  const onBackup = ordered.filter((a) => a.planIndex > 0).length;
  const costOf = (a: Activity) => sumJpy(costs.get(a.id) ?? [], thbPerJpy);
  const costOfList = (list: Activity[]) => list.reduce((s, a) => s + costOf(a), 0);
  // Booking stats follow the plan in use (main or backup).
  const toBook = ordered.filter((a) => requiresBooking(activePlace(a).booking));
  const booked = toBook.filter((a) => activePlace(a).booking.booked).length;

  // Categories in their managed order, plus any orphaned ids so no activity is hidden.
  const knownIds = new Set(categories.map((c) => c.id));
  const orphanIds = [...new Set(ordered.map((a) => a.category).filter((id) => !knownIds.has(id)))];
  const allCategories = [...categories, ...orphanIds.map((id) => findCategory(categories, id))];
  const categoryOf = (a: Activity) => findCategory(categories, a.category);

  return (
    <section aria-label="สรุปทริปทั้งหมด" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="จำนวนวัน" value={`${days.length}`} unit="วัน" />
        <Stat label="กิจกรรมทั้งหมด" value={`${ordered.length}`} unit="รายการ" />
        <Stat label="ไปแล้ว" value={`${visited}/${ordered.length}`} progress={ordered.length ? visited / ordered.length : 0} />
        <Stat
          label="🎫 จองแล้ว"
          value={`${booked}/${toBook.length}`}
          progress={toBook.length ? booked / toBook.length : undefined}
        />
        <Stat label="มีแผนสำรอง" value={`${withBackup}`} unit={onBackup ? `· ใช้อยู่ ${onBackup}` : "รายการ"} />
        <Stat label="💴 ค่าใช้จ่ายกิจกรรม" value={yen(costOfList(ordered))} />
      </div>

      <TravelSection
        flights={flights}
        hotels={hotels}
        members={members}
        defaultDate={days[0]?.date ?? ""}
        defaultReturnDate={days[days.length - 1]?.date ?? ""}
        thbPerJpy={thbPerJpy}
        onChange={onTravelChange}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="สรุปตาม" className="inline-flex rounded-full bg-white/80 p-1 shadow-sm">
          {(
            [
              ["day", "📅 ตามวัน"],
              ["category", "🏷️ ตามประเภท"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={groupBy === id}
              onClick={() => setGroupBy(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                groupBy === id ? "bg-ink text-white shadow" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {groupBy === "day" && days.length > 0 && (
          <button
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(days.map((d) => d.id)))}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-surface hover:text-ink"
          >
            {allCollapsed ? "⊞ ขยายทั้งหมด" : "⊟ ย่อทั้งหมด"}
          </button>
        )}
      </div>

      {groupBy === "day" ? (
        <div className="space-y-4">
          {days.map((day, i) => {
            const items = ordered.filter((a) => a.dayId === day.id);
            const done = items.filter((a) => a.visited).length;
            const counts = allCategories
              .map((c) => ({ c, n: items.filter((a) => a.category === c.id).length }))
              .filter((x) => x.n > 0);
            const isOpen = !collapsed.has(day.id);
            const listId = `summary-day-${day.id}`;
            return (
              <article key={day.id} className="rounded-3xl border border-line bg-white/80 p-4 shadow-sm">
                <header className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDay(day.id)}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    className="-m-1.5 flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-1.5 text-left transition hover:bg-surface"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 20 20"
                      className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="currentColor"
                    >
                      <path d="M7 4l7 6-7 6V4z" />
                    </svg>
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold tracking-wide text-white">DAY {i + 1}</span>
                    <h3 className="font-semibold">{day.title}</h3>
                    <span className="text-sm text-ink-soft">{formatDate(day.date)}</span>
                    {!isOpen && <span className="text-xs text-ink-soft">· {items.length} กิจกรรม</span>}
                    {costOfList(items) > 0 && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium">💴 {yen(costOfList(items))}</span>
                    )}
                  </button>
                  <button
                    onClick={() => onOpenDay(day.id)}
                    className="shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium text-baby-ink hover:bg-baby"
                  >
                    ดู Timeline →
                  </button>
                </header>

                <Progress done={done} total={items.length} />

                <TravelStrip date={day.date} flights={flights} hotels={hotels} className="mt-3" />

                {counts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {counts.map(({ c, n }) => (
                      <span key={c.id} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryBadge(c)}`}>
                        {c.icon} {c.label} · {n}
                      </span>
                    ))}
                  </div>
                )}

                <div id={listId} hidden={!isOpen}>
                  {items.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-soft">ยังไม่มีกิจกรรม</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line/70">
                      {items.map((a) => (
                        <SummaryRow key={a.id} activity={a} cost={costOf(a)} onOpen={() => onOpenDay(a.dayId)}>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryBadge(categoryOf(a))}`}>
                            {categoryOf(a).icon}
                          </span>
                        </SummaryRow>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {allCategories.map((c) => {
            const items = ordered.filter((a) => a.category === c.id);
            if (items.length === 0) return null;
            const done = items.filter((a) => a.visited).length;
            return (
              <article key={c.id || "unknown"} className="rounded-3xl border border-line bg-white/80 p-4 shadow-sm">
                <header className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${categoryBadge(c)}`}>
                    {c.icon} {c.label}
                  </span>
                  <span className="text-sm text-ink-soft">{items.length} รายการ</span>
                  {costOfList(items) > 0 && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium">💴 {yen(costOfList(items))}</span>
                  )}
                </header>
                <Progress done={done} total={items.length} />
                <ul className="mt-3 divide-y divide-line/70">
                  {items.map((a) => (
                    <SummaryRow key={a.id} activity={a} cost={costOf(a)} onOpen={() => onOpenDay(a.dayId)}>
                      <span className="w-12 shrink-0 text-[11px] font-semibold text-ink-soft">
                        DAY {dayIndex.get(a.dayId)! + 1}
                      </span>
                    </SummaryRow>
                  ))}
                </ul>
              </article>
            );
          })}

          {(() => {
            const empty = allCategories.filter((c) => !ordered.some((a) => a.category === c.id));
            if (empty.length === 0) return null;
            return (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                ยังไม่มีกิจกรรม:
                {empty.map((c) => (
                  <span key={c.id} className={`rounded-full px-2 py-0.5 font-medium opacity-70 ${categoryBadge(c)}`}>
                    {c.icon} {c.label}
                  </span>
                ))}
              </p>
            );
          })()}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, unit, progress }: { label: string; value: string; unit?: string; progress?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 p-3 shadow-sm">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-2xl font-bold">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-ink-soft">{unit}</span>}
      </p>
      {progress !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-done-ink/70" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}


function SummaryRow({
  activity: a,
  cost,
  onOpen,
  children,
}: {
  activity: Activity;
  /** Yen total of this activity's expenses. */
  cost: number;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const place = activePlace(a);
  const onBackup = a.planIndex > 0;
  return (
    <li>
      <button
        onClick={onOpen}
        className={`flex w-full items-center gap-2.5 rounded-xl px-1 py-2 text-left text-sm transition hover:bg-surface/70 ${
          a.visited ? "text-ink-soft" : ""
        }`}
      >
        <span aria-label={a.visited ? "ไปแล้ว" : "ยังไม่ไป"} className="shrink-0">
          {a.visited ? "✅" : "⬜"}
        </span>
        {children}
        <span className="w-11 shrink-0 font-mono text-xs text-ink-soft">{a.time}</span>
        <span className={`min-w-0 flex-1 truncate ${a.visited ? "line-through" : ""}`}>{place.title}</span>
        {place.subtasks.length > 0 && (
          <span
            title="สถานที่ / กิจกรรมย่อยที่ทำแล้ว"
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              place.subtasks.every((t) => t.done) ? "bg-done text-done-ink" : "bg-surface text-ink-soft"
            }`}
          >
            🗺️ {place.subtasks.filter((t) => t.done).length}/{place.subtasks.length}
          </span>
        )}
        {needsBooking(a) && (
          <span className="shrink-0 rounded-full bg-alert px-2 py-0.5 text-[11px] font-medium text-alert-ink">⏳ ยังไม่จอง</span>
        )}
        {cost > 0 && <span className="shrink-0 text-xs font-medium">{yen(cost)}</span>}
        {onBackup && (
          <span className="shrink-0 rounded-full bg-alt px-2 py-0.5 text-[11px] font-medium text-alt-ink">🔁 สำรอง</span>
        )}
      </button>
    </li>
  );
}
