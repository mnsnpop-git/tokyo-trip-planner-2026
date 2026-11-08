"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { IconButton } from "./Icons";
import {
  BOOKING_KINDS,
  activityStart,
  bookingOpensAt,
  formatDayTab,
  isSafeUrl,
  planName,
  plansOf,
  updatePlanBooking,
  type Activity,
  type Booking,
  type BookingKind,
  type Day,
  type Member,
  type Place,
} from "@/lib/trip";
import {
  BookingFields,
  BookingModal,
  cleanBooking,
  formatCountdown,
  formatDateTime,
  paymentSummary,
  useNow,
  validateBooking,
} from "./Booking";

interface Entry {
  key: string;
  activity: Activity;
  place: Place;
  planIndex: number;
  inUse: boolean;
  day: Day;
  dayIndex: number;
  start: Date | null;
  opensAt: Date | null;
}

type Status = "todo" | "upcoming" | "booked" | "walkin";

// Tabs use exactly the booking types offered in the booking form.
const TABS: { id: BookingKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  ...BOOKING_KINDS.filter((k) => k.id !== "none").map((k) => ({ id: k.id, label: `${k.icon} ${k.label}` })),
];

const TAB_HINT: Record<BookingKind | "all", string> = {
  all: "",
  none: "",
  anytime: "จองล่วงหน้าได้ทุกเมื่อ",
  window: "เปิดให้จองก่อนวันไปตามเวลาที่ตั้งไว้",
  walkin: "ไม่รับจอง ไปต่อคิวหน้างาน",
};

type StatusFilter = "all" | "notBooked" | "booked";

const selectClass = "min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-base sm:text-sm";

/** "การจอง" menu: every plan with booking info, by status tab, grouped by day. */
export function Bookings({
  days,
  activities,
  members,
  currentMemberId,
  onSave,
  onOpenDay,
}: {
  days: Day[];
  activities: Activity[];
  members: Member[];
  currentMemberId: string;
  onSave: (a: Activity) => void;
  onOpenDay: (dayId: string) => void;
}) {
  const now = useNow();
  const [tab, setTab] = useState<BookingKind | "all">("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showUnused, setShowUnused] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const dayIndex = new Map(days.map((d, i) => [d.id, i]));
  const all: Entry[] = activities.flatMap((a) => {
    const i = dayIndex.get(a.dayId);
    if (i === undefined) return [];
    const day = days[i];
    const start = activityStart(day.date, a.time);
    return plansOf(a)
      .map((place, planIndex) => ({ place, planIndex }))
      .filter(({ place }) => place.booking.kind !== "none")
      .map(({ place, planIndex }) => ({
        key: `${a.id}-${planIndex}`,
        activity: a,
        place,
        planIndex,
        inUse: planIndex === a.planIndex,
        day,
        dayIndex: i,
        start,
        opensAt: bookingOpensAt(place.booking, start),
      }));
  });

  const statusOf = (e: Entry): Status => {
    const b = e.place.booking;
    if (b.kind === "walkin") return "walkin";
    if (b.booked) return "booked";
    return e.opensAt && e.opensAt.getTime() > now ? "upcoming" : "todo";
  };

  const q = search.trim().toLowerCase();
  const unusedCount = all.filter((e) => !e.inUse).length;
  const matchesStatus = (e: Entry) => {
    if (statusFilter === "all") return true;
    const st = statusOf(e);
    return statusFilter === "booked" ? st === "booked" : st === "todo" || st === "upcoming";
  };
  // Everything except the booking-type tab narrows the list; tab counts follow these filters.
  const filtered = all
    .filter((e) => showUnused || e.inUse)
    .filter((e) => dayFilter === "all" || e.day.id === dayFilter)
    .filter(matchesStatus)
    .filter((e) => !q || e.place.title.toLowerCase().includes(q) || e.activity.title.toLowerCase().includes(q));
  const count = (id: BookingKind | "all") => (id === "all" ? filtered.length : filtered.filter((e) => e.place.booking.kind === id).length);
  const activeTab = tab;
  const shown = filtered
    .filter((e) => activeTab === "all" || e.place.booking.kind === activeTab)
    .sort((x, y) => x.dayIndex - y.dayIndex || x.activity.time.localeCompare(y.activity.time) || x.planIndex - y.planIndex);
  const byDay = days
    .map((day, i) => ({ day, index: i, items: shown.filter((e) => e.day.id === day.id) }))
    .filter((g) => g.items.length > 0);
  const hasFilter = dayFilter !== "all" || statusFilter !== "all" || q !== "";
  // Not-yet-booked items with booking already open, per tab (shown as a red count).
  const urgent = (id: BookingKind | "all") =>
    filtered.filter((e) => statusOf(e) === "todo" && (id === "all" || e.place.booking.kind === id)).length;

  const viewed = all.find((e) => e.key === viewing);
  const edited = all.find((e) => e.key === editing);

  return (
    <section aria-label="การจอง" className="space-y-4">
      {/* Status tabs double as the summary */}
      <div role="tablist" aria-label="แบบการจอง" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const n = count(t.id);
          const u = urgent(t.id);
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                active ? "bg-ink text-white shadow" : "bg-surface text-ink-soft hover:bg-baby hover:text-baby-ink"
              }`}
            >
              {t.label}
              <span className={`min-w-5 rounded-full px-1.5 text-center text-xs ${active ? "bg-white/20" : "bg-white"}`}>{n}</span>
              {u > 0 && (
                <span title={`ยังไม่จอง ${u} รายการ`} className="min-w-5 rounded-full bg-pending-ink px-1.5 text-center text-xs text-white">
                  {u}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters: one compact row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหากิจกรรม"
          aria-label="ค้นหากิจกรรม"
          className={`${selectClass} col-span-2 sm:col-span-1`}
        />
        <select aria-label="เลือกวัน" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className={selectClass}>
          <option value="all">ทุกวัน</option>
          {days.map((d, i) => {
            const n = all.filter((e) => e.day.id === d.id && (showUnused || e.inUse)).length;
            return (
              <option key={d.id} value={d.id}>
                DAY {i + 1} · {formatDayTab(d.date)}
                {n ? ` (${n})` : ""}
              </option>
            );
          })}
        </select>
        <select
          aria-label="สถานะการจอง"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectClass}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="notBooked">ยังไม่จอง</option>
          <option value="booked">จองแล้ว</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        {TAB_HINT[activeTab] && <span>{TAB_HINT[activeTab]}</span>}
        {unusedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} className="h-4 w-4" />
            รวมแผนที่ไม่ได้ใช้ ({unusedCount})
          </label>
        )}
        {hasFilter && (
          <button
            onClick={() => {
              setDayFilter("all");
              setStatusFilter("all");
              setSearch("");
            }}
            className="ml-auto rounded-full px-2 py-1 font-medium text-baby-ink hover:bg-baby"
          >
            ✕ ล้างตัวกรอง
          </button>
        )}
      </div>

      {byDay.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">
          {all.length === 0 ? (
            <>
              ยังไม่มีการจอง — ตั้ง <b>แบบการจอง</b> ได้ที่ไอคอนดินสอของกิจกรรม
            </>
          ) : statusFilter === "notBooked" && !q && dayFilter === "all" ? (
            "จองครบหมดแล้ว"
          ) : (
            "ไม่มีรายการที่ตรงกับตัวกรอง"
          )}
        </p>
      ) : (
        <div className="space-y-5">
          {byDay.map(({ day, index, items }) => (
            <div key={day.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">DAY {index + 1}</span>
                <span className="text-sm font-semibold">{formatDayTab(day.date)}</span>
                <span className="min-w-0 truncate text-sm text-ink-soft">{day.title}</span>
                <button
                  onClick={() => onOpenDay(day.id)}
                  className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-baby-ink hover:bg-baby"
                >
                  Timeline →
                </button>
              </div>
              <ul className="space-y-2">
                {items.map((e) => (
                  <BookingRow
                    key={e.key}
                    entry={e}
                    status={statusOf(e)}
                    showStatus={statusOf(e) !== "walkin"}
                    now={now}
                    members={members}
                    onView={() => setViewing(e.key)}
                    onEdit={() => setEditing(e.key)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {edited && (
        <BookingEditor
          entry={edited}
          members={members}
          currentMemberId={currentMemberId}
          onCancel={() => setEditing(null)}
          onSave={(b) => {
            onSave(updatePlanBooking(edited.activity, edited.planIndex, () => b));
            setEditing(null);
          }}
        />
      )}

      {viewed && (
        <BookingModal
          title={viewed.place.title}
          booking={viewed.place.booking}
          members={members}
          start={viewed.start}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

/** Not booked = soft red (book now), not open yet = white outline (just wait), booked = blue. */
const STATUS_STYLE: Record<Status, string> = {
  todo: "bg-pending text-pending-ink",
  upcoming: "border border-dashed border-ink-soft/60 bg-white text-ink-soft",
  booked: "bg-done text-done-ink",
  walkin: "bg-white text-ink-soft",
};

const STATUS_BADGE: Record<Status, string> = {
  todo: "ยังไม่จอง",
  upcoming: "ยังไม่จอง · ยังไม่เปิด",
  booked: "จองแล้ว",
  walkin: "Walk-in",
};

function BookingRow({
  entry: e,
  status,
  showStatus,
  now,
  members,
  onView,
  onEdit,
}: {
  entry: Entry;
  status: Status;
  /** Show a booked / not-booked badge (walk-ins have no booking status). */
  showStatus: boolean;
  now: number;
  members: Member[];
  onView: () => void;
  onEdit: () => void;
}) {
  const b = e.place.booking;
  const p = b.payment;
  const by = members.find((m) => m.id === b.bookedBy);
  const hasUrl = b.url && isSafeUrl(b.url) && b.kind !== "walkin";

  let detail = "";
  if (status === "walkin") detail = b.method || "ไปต่อคิวหน้างาน";
  else if (status === "booked") detail = "";
  else if (status === "upcoming" && e.opensAt)
    detail = `เปิดจอง ${formatDateTime(e.opensAt)} · ${formatCountdown(e.opensAt.getTime() - now)}`;
  else if (e.opensAt) detail = `เปิดจองแล้วตั้งแต่ ${formatDateTime(e.opensAt)}`;
  else detail = "จองได้เลย";

  return (
    <li className={`card-fill-hover relative rounded-2xl bg-surface/60 p-3 ${e.inUse ? "" : "opacity-60"}`}>
      {/* Time · title · status, then view/edit. Status is changed in the edit form. */}
      <div className="-mr-1.5 -mt-1.5 flex items-start gap-2">
        <p className="min-w-0 flex-1 pt-1.5 leading-snug">
          <span className="mr-2 font-mono text-sm font-semibold text-ink-soft">{e.activity.time}</span>
          <span className="font-medium">{e.place.title}</span>
        </p>
        {showStatus && (
          <span className={`mt-1.5 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
            {STATUS_BADGE[status]}
          </span>
        )}
        <div className="flex shrink-0">
          <IconButton icon="view" label={`ดูรายละเอียด ${e.place.title}`} onClick={onView} />
          <IconButton icon="edit" label={`แก้ไขการจอง ${e.place.title}`} onClick={onEdit} />
        </div>
      </div>

      {(detail || e.planIndex > 0 || !e.inUse) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {(e.planIndex > 0 || !e.inUse) && (
            <span className="rounded-full bg-alt px-2 py-0.5 text-alt-ink">
              {planName(e.planIndex, e.activity.backups.length)}
              {e.inUse ? "" : " · ไม่ได้ใช้"}
            </span>
          )}
          {detail && <span className="min-w-0 text-ink-soft">{detail}</span>}
        </div>
      )}
      {((p.required && p.amount > 0) || (status === "booked" && by)) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {p.required && p.amount > 0 && <span>{paymentSummary(p)}</span>}
          {status === "booked" && by && (
            <span className="text-ink-soft">
              จองโดย {by.emoji} {by.name}
            </span>
          )}
        </p>
      )}

      {hasUrl && status !== "booked" && (
        <div className="mt-2.5 flex text-xs">
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-ink px-3.5 py-1.5 font-medium text-white hover:opacity-90"
          >
            🔗 ไปจอง
          </a>
        </div>
      )}
    </li>
  );
}

/** Edit one plan's booking right here, with the same fields as the activity form. */
function BookingEditor({
  entry: e,
  members,
  currentMemberId,
  onCancel,
  onSave,
}: {
  entry: Entry;
  members: Member[];
  currentMemberId: string;
  onCancel: () => void;
  onSave: (b: Booking) => void;
}) {
  const [booking, setBooking] = useState<Booking>(e.place.booking);
  const [error, setError] = useState("");

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const err = validateBooking(booking, members);
    if (err) return setError(err);
    onSave(cleanBooking(booking));
  };

  return (
    <Modal title={`การจอง · ${e.place.title}`} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="rounded-full bg-ink px-2 py-0.5 font-semibold text-white">DAY {e.dayIndex + 1}</span>
          {formatDayTab(e.day.date)} · {e.activity.time}
          {e.activity.backups.length > 0 && (
            <span className="rounded-full bg-alt px-2 py-0.5 text-alt-ink">{planName(e.planIndex, e.activity.backups.length)}</span>
          )}
        </p>
        <BookingFields
          idPrefix={`bk-${e.key}`}
          booking={booking}
          members={members}
          currentMemberId={currentMemberId}
          start={e.start}
          onUpdate={(update) => setBooking(update)}
        />
        {booking.kind === "none" && (
          <p className="text-[11px] text-ink-soft">เลือก “ไม่ต้องจอง” แล้วบันทึก รายการนี้จะหายจากหน้า Reservations</p>
        )}
        {error && <p className="rounded-xl bg-alert/60 px-3 py-2 text-sm text-alert-ink">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface">
            ยกเลิก
          </button>
          <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90">
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
}
