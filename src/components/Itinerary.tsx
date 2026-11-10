"use client";

import { useReadOnly } from "./ReadOnly";
import { useId, useState } from "react";
import {
  EMPTY_PLACE,
  SLOTS,
  activePlace,
  activityStart,
  baht,
  categoryBadge,
  findCategory,
  formatDayLabel,
  isSafeUrl,
  mapsSearchUrl,
  planName,
  plansOf,
  slotFromTime,
  startHotelOn,
  sumThb,
  uid,
  updatePlanBooking,
  updatePlace,
  yen,
  type Activity,
  type Booking,
  type Category,
  type Day,
  type Expense,
  type Flight,
  type Hotel,
  type Member,
  type Place,
  type Slot,
} from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { ImagePicker, ImageViewer } from "./Images";
import { Progress } from "./Progress";
import { DeleteButton, IconButton } from "./Icons";
import { TravelStrip } from "./Travel";
import { TravelLeg, type LegEnd } from "./TravelLeg";
import { useMapCoords } from "@/lib/useMapCoords";
import { SubTaskList } from "./SubTasks";
import { MapPlaceField } from "./MapPlaceField";
import type { LatLng } from "@/lib/travelEstimate";
import { BookingFields, BookingInfo, cleanBooking, validateBooking } from "./Booking";

type Draft = Omit<Activity, "id"> & { id?: string };
type PlaceUpdate = (update: (p: Place) => Place) => void;

export function Itinerary({
  days,
  activities,
  categories,
  members,
  currentMemberId,
  selectedDayId,
  costs,
  thbPerJpy,
  flights,
  hotels,
  wishesToBuy,
  onOpenWishlist,
  onSave,
  onDelete,
  onUpdateDay,
  onDeleteDay,
}: {
  days: Day[];
  activities: Activity[];
  categories: Category[];
  members: Member[];
  currentMemberId: string;
  selectedDayId: string | "all";
  /** Expenses tied to each activity, keyed by activity id. */
  costs: Map<string, Expense[]>;
  thbPerJpy: number;
  flights: Flight[];
  hotels: Hotel[];
  /** Wishes still to buy at each activity, keyed by activity id. */
  wishesToBuy: Map<string, number>;
  /** Open the Wishlist at this activity's items. */
  onOpenWishlist: (activityId: string) => void;
  onSave: (a: Activity) => void;
  onDelete: (id: string) => void;
  onUpdateDay: (day: Day) => void;
  onDeleteDay: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const visibleDays = selectedDayId === "all" ? days : days.filter((d) => d.id === selectedDayId);
  const visibleIds = new Set(visibleDays.map((d) => d.id));
  const linkOf = (a: Activity) => {
    const url = activePlace(a).mapUrl.trim();
    return url && isSafeUrl(url) ? url : "";
  };
  // Each day starts at a hotel; without a map link its address (or name) is looked up instead.
  const startHotels = new Map(visibleDays.map((d) => [d.id, startHotelOn(hotels, d.date)]));
  const hotelLink = (h: Hotel) => {
    const url = h.mapUrl.trim();
    return url && isSafeUrl(url) ? url : h.address.trim() || h.name.trim() ? mapsSearchUrl(h.address.trim() || h.name.trim()) : "";
  };
  const coords = useMapCoords(
    [
      ...activities.filter((a) => visibleIds.has(a.dayId)).map(linkOf),
      ...[...startHotels.values()].map((h) => (h ? hotelLink(h) : "")),
    ].filter(Boolean),
  );
  /** Where place searches for a day should look first: its start hotel, then its activities, then anything known. */
  const nearFor = (dayId: string): LatLng | null => {
    const hotel = startHotels.get(dayId);
    const fromHotel = hotel ? coords.get(hotelLink(hotel)) : null;
    if (fromHotel) return fromHotel;
    for (const a of activities) {
      const c = a.dayId === dayId ? coords.get(linkOf(a)) : null;
      if (c) return c;
    }
    return [...coords.values()].find((c): c is LatLng => !!c) ?? null;
  };
  const hotelEnd = (h: Hotel): LegEnd => {
    const mapUrl = hotelLink(h);
    return { name: h.address.trim() || h.name, time: "", mapUrl, coords: mapUrl ? coords.get(mapUrl) : null };
  };
  const legEnd = (a: Activity): LegEnd => {
    const mapUrl = linkOf(a);
    return { name: activePlace(a).title, time: a.time, mapUrl, coords: mapUrl ? coords.get(mapUrl) : null };
  };

  const openNew = (dayId: string, slot: Slot) =>
    setDraft({
      ...EMPTY_PLACE,
      dayId,
      slot,
      time: { morning: "09:00", afternoon: "13:00", evening: "18:00", night: "20:00" }[slot],
      category: categories[0]?.id ?? "",
      backups: [],
      planIndex: 0,
      visited: false,
    });

  return (
    <section aria-label="แพลนรายวัน" className="space-y-8">
      {visibleDays.map((day) => {
        const index = days.findIndex((d) => d.id === day.id) + 1;
        const dayActs = activities.filter((a) => a.dayId === day.id);
        // The day in time order: each activity is followed by the trip to the next one.
        const ordered = [...dayActs].sort((a, b) => a.time.localeCompare(b.time));
        const nextOf = (a: Activity) => ordered[ordered.indexOf(a) + 1];
        const startHotel = startHotels.get(day.id);
        const visitedCount = dayActs.filter((a) => a.visited).length;
        return (
          <div key={day.id}>
            <DayHeader
              day={day}
              index={index}
              visitedCount={visitedCount}
              total={dayActs.length}
              canDelete={days.length > 1}
              onUpdate={onUpdateDay}
              onDelete={() => onDeleteDay(day.id)}
            />

            {/* Flights that day and where you sleep that night, same as on the All page. */}
            <TravelStrip date={day.date} flights={flights} hotels={hotels} className="-mt-1 mb-6" />

            {/* Timeline: slots run top-to-bottom from morning to night along one vertical line */}
            <ol className="relative ml-4 space-y-7 border-l-2 border-line pl-6">
              {SLOTS.map((slot) => {
                const items = dayActs
                  .filter((a) => slotFromTime(a.time) === slot.id)
                  .sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <li key={slot.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[calc(2.5rem+1px)] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-line bg-white text-base shadow-sm"
                    >
                      {slot.icon}
                    </span>
                    <div className="flex min-h-8 items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {slot.label}
                        <span className="ml-2 text-xs font-normal text-ink-soft">{slot.hint}</span>
                      </h3>
                      <IconButton icon="add" label={`เพิ่มกิจกรรมช่วง${slot.label}`} onClick={() => openNew(day.id, slot.id)} />
                    </div>

                    {items.length === 0 ? (
                      <p className="mt-2 rounded-2xl border-2 border-dashed border-line py-3 text-center text-sm text-ink-soft">
                        ยังไม่มีแพลน
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {items.flatMap((a) => {
                          const next = nextOf(a);
                          return [
                            a === ordered[0] && startHotel && (
                              <TravelLeg
                                key={`leg-hotel-${a.id}`}
                                from={hotelEnd(startHotel)}
                                to={legEnd(a)}
                                label={`🏨 จากที่พัก ${startHotel.name}`}
                              />
                            ),
                            <ActivityCard
                              key={a.id}
                              activity={a}
                              category={findCategory(categories, a.category)}
                              members={members}
                              currentMemberId={currentMemberId}
                              start={activityStart(day.date, a.time)}
                              costs={costs.get(a.id) ?? []}
                              thbPerJpy={thbPerJpy}
                              toBuy={wishesToBuy.get(a.id) ?? 0}
                              onOpenWishlist={() => onOpenWishlist(a.id)}
                              onChange={onSave}
                              onEdit={() => setDraft(a)}
                              onDelete={() => onDelete(a.id)}
                            />,
                            next && <TravelLeg key={`leg-${a.id}`} from={legEnd(a)} to={legEnd(next)} />,
                          ];
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      {draft && (
        <ActivityForm
          draft={draft}
          days={days}
          near={nearFor(draft.dayId)}
          categories={categories}
          members={members}
          currentMemberId={currentMemberId}
          onCancel={() => setDraft(null)}
          onSubmit={(a) => {
            onSave(a);
            setDraft(null);
          }}
        />
      )}
    </section>
  );
}

// ---------- Day header ----------

function DayHeader({
  day,
  index,
  visitedCount,
  total,
  canDelete,
  onUpdate,
  onDelete,
}: {
  day: Day;
  index: number;
  visitedCount: number;
  total: number;
  canDelete: boolean;
  onUpdate: (day: Day) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(day.title);
  const [date, setDate] = useState(day.date);
  const [ootdTheme, setOotdTheme] = useState(day.ootd.theme);
  const [ootdImages, setOotdImages] = useState(day.ootd.images);
  const [viewing, setViewing] = useState<number | null>(null);

  const start = () => {
    setTitle(day.title);
    setDate(day.date);
    setOotdTheme(day.ootd.theme);
    setOotdImages(day.ootd.images);
    setEditing(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    onUpdate({ ...day, title: title.trim() || day.title, date, ootd: { theme: ootdTheme.trim(), images: ootdImages } });
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={save}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        aria-label={`แก้ไข Day ${index}`}
        className="mb-4 space-y-3 rounded-2xl border border-line bg-white/80 p-3 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-2">
          <span className="mb-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold tracking-wide text-white">DAY {index}</span>
          <div className="min-w-40 flex-1">
            <label className={labelClass} htmlFor={`day-title-${day.id}`}>ชื่อวัน</label>
            <input
              id={`day-title-${day.id}`}
              autoFocus
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`day-date-${day.id}`}>วันที่</label>
            <input
              id={`day-date-${day.id}`}
              type="date"
              required
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3 rounded-xl bg-surface/70 p-3">
          <div>
            <label className={labelClass} htmlFor={`day-ootd-${day.id}`}>OOTD · ธีมชุดของวันนี้</label>
            <input
              id={`day-ootd-${day.id}`}
              className={inputClass}
              value={ootdTheme}
              onChange={(e) => setOotdTheme(e.target.value)}
              placeholder="เช่น โทนขาว-ฟ้า, Street style, ใส่โค้ทยาว"
            />
          </div>
          <ImagePicker
            idPrefix={`day-ootd-${day.id}`}
            label="รูปตัวอย่างชุด"
            images={ootdImages}
            onUpdate={(update) => setOotdImages(update)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {canDelete && (
            <DeleteButton label={total ? `ลบวันนี้และกิจกรรม ${total} รายการ` : "ลบวันนี้"} onConfirm={onDelete} />
          )}
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-ink-soft hover:bg-surface">
              ยกเลิก
            </button>
            <button type="submit" className="rounded-full bg-ink px-4 py-1.5 font-medium text-white hover:opacity-90">
              บันทึก
            </button>
          </span>
        </div>
      </form>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold tracking-wide text-white">DAY {index}</span>
        <h2 className="text-xl font-semibold">{day.title}</h2>
        <span className="text-sm text-ink-soft">{formatDayLabel(day.date)}</span>
        <IconButton icon="edit" label={`แก้ไข Day ${index}`} onClick={start} className="-ml-1.5 self-center" />
      </div>
      <OotdLine ootd={day.ootd} onEdit={start} onViewImage={setViewing} />
      <Progress done={visitedCount} total={total} />
      {viewing !== null && day.ootd.images[viewing] && (
        <ImageViewer
          title={`OOTD · ${day.ootd.theme || day.title}`}
          images={day.ootd.images}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/** Low-key OOTD line under the day title: theme text plus small example thumbnails. */
function OotdLine({
  ootd,
  onEdit,
  onViewImage,
}: {
  ootd: Day["ootd"];
  onEdit: () => void;
  onViewImage: (index: number) => void;
}) {
  const readOnly = useReadOnly();
  if (!ootd.theme && ootd.images.length === 0) {
    if (readOnly) {
      return (
        <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft/70">
          <span className="font-medium tracking-wide">OOTD</span>
          <span>ไม่มีธีมชุด</span>
        </p>
      );
    }
    return (
      <button onClick={onEdit} className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft/70 transition hover:text-ink">
        <span className="font-medium tracking-wide">OOTD</span>
        <span>ไม่มีธีมชุด</span>
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-ink-soft">
      <span className="shrink-0 font-medium tracking-wide">OOTD</span>
      {ootd.theme && <span className="min-w-0 truncate">{ootd.theme}</span>}
      {ootd.images.length > 0 && (
        <span className="flex shrink-0 gap-1">
          {ootd.images.slice(0, 4).map((src, i) => (
            <button
              key={`${i}-${src.slice(-16)}`}
              onClick={() => onViewImage(i)}
              aria-label={`ดูรูปตัวอย่างชุด ${i + 1}`}
              className="overflow-hidden rounded-md border border-line opacity-90 transition hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-7 w-7 object-cover" />
            </button>
          ))}
          {ootd.images.length > 4 && (
            <button onClick={() => onViewImage(4)} className="rounded-md bg-white px-1.5 text-[11px] hover:text-ink">
              +{ootd.images.length - 4}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// ---------- Card ----------

const expenseIcon = (e: Expense) => (e.wishId ? "🛍️" : e.id.startsWith("booking-") ? "🎫" : "💴");

function ActivityCard({
  activity: a,
  category: cat,
  members,
  currentMemberId,
  start,
  costs,
  thbPerJpy,
  toBuy,
  onOpenWishlist,
  onChange,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  category: Category;
  members: Member[];
  currentMemberId: string;
  /** When this activity starts; booking windows count back from it. */
  start: Date | null;
  /** Expenses tied to this activity (booking, linked expenses, wishes bought here). */
  costs: Expense[];
  thbPerJpy: number;
  /** Wishlist items still to buy here. */
  toBuy: number;
  onOpenWishlist: () => void;
  onChange: (a: Activity) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const readOnly = useReadOnly();
  const [showCosts, setShowCosts] = useState(false);
  // Plans shown expanded; the plan in use starts open, the others folded to one line.
  const [openPlans, setOpenPlans] = useState<Set<number>>(() => new Set([a.planIndex]));
  const togglePlan = (i: number) =>
    setOpenPlans((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const [viewing, setViewing] = useState<{ place: Place; index: number } | null>(null);
  const title = activePlace(a).title;
  const plans = plansOf(a);
  const total = sumThb(costs, thbPerJpy);

  /** Flip a plan's booked status; marking it booked credits the signed-in profile if nobody is set. */
  const toggleBooked = (planIndex: number) =>
    onChange(
      updatePlanBooking(a, planIndex, (b: Booking) => ({
        ...b,
        booked: !b.booked,
        bookedBy: !b.booked && !b.bookedBy ? currentMemberId : b.bookedBy,
      })),
    );

  return (
    <li
      id={`activity-${a.id}`}
      className={`card-fill-hover relative scroll-mt-32 rounded-2xl p-3 ${a.visited ? "bg-done/50" : "bg-surface/60"}`}
    >
      <span
        aria-hidden
        className={`absolute -left-[calc(1.875rem+1px)] top-4 h-3 w-3 rounded-full border-2 border-white ${
          a.visited ? "bg-done-ink" : "bg-baby-ink"
        }`}
      />

      {/* Edit / delete: icons in the top-right corner */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-white/80">
        <IconButton
          icon="edit"
          label={`แก้ไข ${title}`}
          title={a.visited ? "ติ๊กออกก่อนเพื่อแก้ไข" : `แก้ไข ${title}`}
          onClick={onEdit}
          disabled={a.visited}
        />
        <DeleteButton label={`ลบ ${title}`} onConfirm={onDelete} disabled={a.visited} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        {/* The checkbox stays outside the inert area so a visited item can always be unticked. */}
        <label className="flex shrink-0 cursor-pointer items-center gap-2 self-start sm:mt-0.5" title={a.visited ? "ติ๊กออกเพื่อแก้ไข" : "ติ๊กเมื่อไปแล้ว"}>
          <input
            type="checkbox"
            checked={a.visited}
            disabled={readOnly}
            onChange={(e) => onChange({ ...a, visited: e.target.checked })}
            aria-label={`ไปแล้ว: ${title}`}
            className="h-5 w-5 cursor-pointer accent-done-ink"
          />
          <span className={`w-11 font-mono text-sm font-semibold ${a.visited ? "text-ink-soft/60 line-through" : "text-ink-soft"}`}>
            {a.time}
          </span>
        </label>

        <div className="min-w-0 flex-1">
          {a.visited && (
            <p className="mb-1.5 text-xs sm:pr-20">
              <span className="rounded-full bg-visited px-2 py-0.5 font-semibold text-visited-ink">ไปแล้ว</span>
            </p>
          )}
          <div
            inert={a.visited}
            aria-disabled={a.visited}
            className={`transition ${a.visited ? "select-none opacity-50 grayscale" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-1.5 sm:pr-20">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryBadge(cat)}`}>
                {cat.icon} {cat.label}
              </span>
              {toBuy > 0 && (
                <button
                  onClick={onOpenWishlist}
                  title="ดูใน Wishlist"
                  className="text-[11px] font-medium text-pending-ink underline underline-offset-2 hover:opacity-80"
                >
                  มีของที่ต้องซื้อ {toBuy}
                </button>
              )}
              {costs.length > 0 && (
                <button
                  onClick={() => setShowCosts((v) => !v)}
                  aria-expanded={showCosts}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-baby"
                >
                  {baht(total)} {showCosts ? "▴" : "▾"}
                </button>
              )}
            </div>

            {showCosts && costs.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 rounded-xl bg-white/70 px-2.5 py-1.5 text-xs">
                {costs.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {expenseIcon(e)} {e.title}
                    </span>
                    <span className="shrink-0 font-medium">{e.currency === "JPY" ? yen(e.amount) : baht(e.amount)}</span>
                  </li>
                ))}
                {costs.length > 1 && (
                  <li className="flex gap-2 border-t border-line pt-0.5 font-semibold">
                    <span className="flex-1">รวม</span>
                    <span>{baht(total)}</span>
                  </li>
                )}
              </ul>
            )}

            {plans.length > 1 ? (
              <div className="mt-2 space-y-2">
                {plans.map((place, i) => {
                  const active = a.planIndex === i;
                  // Visited: every plan folds to its one-line header (opens again once unticked).
                  const isOpen = !a.visited && openPlans.has(i);
                  const bodyId = `plan-${a.id}-${i}`;
                  return (
                    <div
                      key={i}
                      className={`min-w-0 rounded-xl border transition ${
                        active ? "border-baby-ink/40 bg-white ring-1 ring-baby-ink/20" : "border-dashed border-line bg-white/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2 text-xs">
                        <button
                          onClick={() => togglePlan(i)}
                          aria-expanded={isOpen}
                          aria-controls={bodyId}
                          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-0.5 text-left"
                        >
                          <svg
                            aria-hidden
                            viewBox="0 0 20 20"
                            className={`h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform ${isOpen ? "rotate-90" : ""}`}
                            fill="currentColor"
                          >
                            <path d="M7 4l7 6-7 6V4z" />
                          </svg>
                          <span className="shrink-0 font-semibold text-ink-soft">{planName(i, a.backups.length)}</span>
                          {!isOpen && <span className="min-w-0 truncate font-medium text-ink">· {place.title}</span>}
                          {!isOpen && place.subtasks.length > 0 && (
                            <span className="shrink-0 text-ink-soft">
                              {place.subtasks.filter((t) => t.done).length}/{place.subtasks.length}
                            </span>
                          )}
                        </button>
                        {active ? (
                          <span className="shrink-0 rounded-full bg-baby px-2 py-0.5 font-medium text-baby-ink">✓ ใช้แผนนี้</span>
                        ) : readOnly ? null : (
                          <button
                            onClick={() => {
                              onChange({ ...a, planIndex: i });
                              setOpenPlans(new Set([i]));
                            }}
                            className="shrink-0 rounded-full bg-white px-2 py-0.5 font-medium text-ink-soft shadow-sm hover:text-baby-ink"
                          >
                            เลือกแผนนี้
                          </button>
                        )}
                      </div>
                      <div id={bodyId} hidden={!isOpen} className={`px-2.5 pb-2.5 ${active ? "" : "opacity-80"}`}>
                        <PlaceView place={place} onViewImage={(index) => setViewing({ place, index })} />
                        <SubTaskList
                          placeTitle={place.title}
                          placeMapUrl={place.mapUrl}
                          subtasks={place.subtasks}
                          order={place.subtaskOrder}
                          onChange={(subtasks, subtaskOrder) => onChange(updatePlace(a, i, (p) => ({ ...p, subtasks, subtaskOrder })))}
                        />
                        <BookingInfo title={place.title} booking={place.booking} members={members} start={start} onToggleBooked={readOnly ? undefined : () => toggleBooked(i)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-1.5">
                <PlaceView place={a} compact={a.visited} onViewImage={(index) => setViewing({ place: a, index })} />
                {/* Visited: folded to just the title; details come back once unticked. */}
                {!a.visited && (
                  <>
                    <SubTaskList
                      placeTitle={a.title}
                      placeMapUrl={a.mapUrl}
                      subtasks={a.subtasks}
                      order={a.subtaskOrder}
                      onChange={(subtasks, subtaskOrder) => onChange(updatePlace(a, 0, (p) => ({ ...p, subtasks, subtaskOrder })))}
                    />
                    <BookingInfo title={a.title} booking={a.booking} members={members} start={start} onToggleBooked={readOnly ? undefined : () => toggleBooked(0)} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewing && viewing.place.images[viewing.index] && (
        <ImageViewer
          title={viewing.place.title}
          images={viewing.place.images}
          index={viewing.index}
          onIndex={(index) => setViewing((v) => v && { ...v, index })}
          onClose={() => setViewing(null)}
        />
      )}
    </li>
  );
}

/** One plan's details: title, note, photos, popular guidelines and map link. */
function PlaceView({
  place,
  compact = false,
  onViewImage,
}: {
  place: Place;
  /** Only the title row (used once the activity is visited). */
  compact?: boolean;
  onViewImage: (index: number) => void;
}) {
  const hasLink = place.mapUrl && isSafeUrl(place.mapUrl);
  const titleRow = (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words font-medium leading-snug">{place.title}</p>
        <a
          href={hasLink ? place.mapUrl : mapsSearchUrl(place.title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open Map: ${place.title}`}
          className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-medium text-baby-ink hover:bg-baby"
        >
          📍 Open Map
        </a>
      </div>
  );
  if (compact) return titleRow;
  return (
    <>
      {titleRow}
      {place.note && <p className="mt-1 text-sm text-ink-soft">{place.note}</p>}

      {place.images.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {place.images.map((src, i) => (
            <button
              key={`${i}-${src.slice(-16)}`}
              onClick={() => onViewImage(i)}
              aria-label={`ดูรูปที่ ${i + 1} ของ ${place.title}`}
              className="shrink-0 overflow-hidden rounded-lg border border-line"
            >
              {/* User-supplied URLs and data URLs from any host, so next/image optimization doesn't apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}

      {place.guidelines.length > 0 && <TipsGuide title={place.title} tips={place.guidelines} />}
    </>
  );
}

/** Popular things to do at a place, as a small numbered guide card that folds like the sub-activity list. */
function TipsGuide({ title, tips }: { title: string; tips: string[] }) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <section aria-label={`Tips Guide: ${title}`} className="mt-2 rounded-xl border border-baby-ink/15 bg-baby/60 px-2.5 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center gap-1.5 rounded-lg text-left text-xs font-semibold"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-3 w-3 shrink-0 text-baby-ink transition-transform ${open ? "rotate-90" : ""}`}
          fill="currentColor"
        >
          <path d="M7 4l7 6-7 6V4z" />
        </svg>
        <span aria-hidden>💡</span>
        <span className="text-baby-ink">Tips Guide</span>
        <span className="font-medium text-ink-soft">{tips.length} ข้อ</span>
      </button>
      <ol id={listId} hidden={!open} className="mt-1.5 space-y-1">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-snug">
            <span
              aria-hidden
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-baby-ink text-[10px] font-bold text-white"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 break-words">{tip}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- Form ----------

const pickPlace = (f: Place): Place => ({
  title: f.title,
  note: f.note,
  mapUrl: f.mapUrl,
  images: f.images,
  guidelines: f.guidelines,
  subtasks: f.subtasks,
  subtaskOrder: f.subtaskOrder,
  booking: f.booking,
});

const cleanPlace = (p: Place): Place => ({
  ...p,
  title: p.title.trim(),
  mapUrl: p.mapUrl.trim(),
  booking: cleanBooking(p.booking),
  guidelines: p.guidelines.map((g) => g.trim()).filter(Boolean),
});

function ActivityForm({
  draft,
  days,
  categories,
  members,
  currentMemberId,
  near,
  onCancel,
  onSubmit,
}: {
  draft: Draft;
  days: Day[];
  /** Place search ranks results near here first. */
  near: LatLng | null;
  categories: Category[];
  members: Member[];
  currentMemberId: string;
  onCancel: () => void;
  onSubmit: (a: Activity) => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));
  const timeSlot = form.time ? SLOTS.find((s) => s.id === slotFromTime(form.time)) : undefined;
  const start = activityStart(days.find((d) => d.id === form.dayId)?.date ?? "", form.time);
  // Tab per plan: 0 = main, 1..n = backups.
  const [tab, setTab] = useState(0);
  // Stable React keys for backup panels, so removing one doesn't reuse another's field state.
  const [backupKeys, setBackupKeys] = useState(() => draft.backups.map(() => uid()));
  const plans = [pickPlace(form), ...form.backups];

  const updatePlan =
    (i: number): PlaceUpdate =>
    (update) =>
      setForm((f) =>
        i === 0 ? { ...f, ...update(pickPlace(f)) } : { ...f, backups: f.backups.map((p, j) => (j === i - 1 ? update(p) : p)) },
      );

  const addBackup = () => {
    setForm((f) => ({ ...f, backups: [...f.backups, { ...EMPTY_PLACE }] }));
    setBackupKeys((k) => [...k, uid()]);
    setTab(form.backups.length + 1);
  };

  const removeBackup = (i: number) => {
    setForm((f) => ({
      ...f,
      backups: f.backups.filter((_, j) => j !== i - 1),
      // Keep pointing at the same plan; fall back to main if the plan in use was removed.
      planIndex: f.planIndex === i ? 0 : f.planIndex > i ? f.planIndex - 1 : f.planIndex,
    }));
    setBackupKeys((k) => k.filter((_, j) => j !== i - 1));
    setTab(i - 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const main = cleanPlace(pickPlace(form));
    const backups = form.backups.map(cleanPlace);
    // Show the error and jump to the tab that needs fixing.
    const fail = (message: string, inTab?: number) => {
      setError(message);
      if (inTab !== undefined) setTab(inTab);
    };
    if (!/^\d{2}:\d{2}$/.test(form.time)) return fail("เลือกเวลาก่อนนะ");
    const all = [main, ...backups];
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const name = planName(i, backups.length);
      if (!p.title) return fail(i === 0 ? "ใส่ชื่อสถานที่ของแผนหลักก่อนนะ" : `ใส่ชื่อสถานที่ของ${name} หรือกดลบแผนนี้`, i);
      if (p.mapUrl && !isSafeUrl(p.mapUrl)) return fail(`ลิงก์ Google Maps ของ${name}ต้องขึ้นต้นด้วย https://`, i);
      const bookingError = validateBooking(p.booking, members);
      if (bookingError) return fail(`${name}: ${bookingError}`, i);
    }
    onSubmit({
      ...form,
      ...main,
      id: form.id ?? uid(),
      slot: slotFromTime(form.time),
      backups,
      planIndex: form.planIndex <= backups.length ? form.planIndex : 0,
    });
  };

  return (
    <Modal title={draft.id ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-5">
        <div>
          <span className={labelClass}>ประเภท</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => set("category", c.id)}
                aria-pressed={form.category === c.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  form.category === c.id ? `${categoryBadge(c)} ring-2 ring-ink/20` : "bg-surface text-ink-soft"
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">เพิ่ม/แก้ไข/ลบประเภทได้ที่การ์ด “ประเภทกิจกรรม”</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="day">วัน</label>
            <select id="day" className={inputClass} value={form.dayId} onChange={(e) => set("dayId", e.target.value)}>
              {days.map((d, i) => (
                <option key={d.id} value={d.id}>
                  Day {i + 1} · {formatDayLabel(d.date)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="time">เวลา</label>
            <input
              id="time"
              type="time"
              required
              className={inputClass}
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
            {timeSlot && (
              <p className="mt-1 text-[11px] text-ink-soft">
                อยู่ในช่วง {timeSlot.icon} {timeSlot.label} ({timeSlot.hint})
              </p>
            )}
          </div>
        </div>

        {/* Plans: one tab for the main plan and one per backup */}
        <div className="rounded-2xl border border-line">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line p-1.5">
            <div role="tablist" aria-label="แผน" className="flex flex-1 gap-1">
              {plans.map((_, i) => {
                const inUse = form.backups.length > 0 && form.planIndex === i;
                return (
                  <button
                    type="button"
                    key={i === 0 ? "main" : backupKeys[i - 1]}
                    role="tab"
                    id={`plan-tab-${i}`}
                    aria-selected={tab === i}
                    aria-controls={`plan-panel-${i}`}
                    onClick={() => setTab(i)}
                    className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                      tab === i ? "bg-ink text-white shadow" : "text-ink-soft hover:bg-surface"
                    }`}
                  >
                    {planName(i, form.backups.length)}
                    {inUse && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === i ? "bg-surface/20" : "bg-baby text-baby-ink"}`}>
                        ใช้อยู่
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <IconButton icon="add" label="เพิ่มแผนสำรอง" onClick={addBackup} />
          </div>

          {/* Every panel stays mounted (hidden when inactive) so in-progress uploads and focus aren't lost. */}
          {plans.map((place, i) => (
            <div
              key={i === 0 ? "main" : backupKeys[i - 1]}
              role="tabpanel"
              id={`plan-panel-${i}`}
              aria-labelledby={`plan-tab-${i}`}
              hidden={tab !== i}
              className="space-y-4 p-4"
            >
              {form.backups.length > 0 && (
                <PlanInUseBar inUse={form.planIndex === i} onUse={() => set("planIndex", i)}>
                  {i > 0 && (
                    <DeleteButton label={`ลบ${planName(i, form.backups.length)}`} onConfirm={() => removeBackup(i)} />
                  )}
                </PlanInUseBar>
              )}
              {i === 0 && form.backups.length === 0 && (
                <p className="text-[11px] text-ink-soft">กดไอคอน + ด้านบนเพื่อเพิ่มแผนสำรอง เผื่อฝนตก / คิวยาว / ปิด — เพิ่มได้หลายแผน</p>
              )}
              <PlaceFields
                idPrefix={i === 0 ? "main" : `backup-${backupKeys[i - 1]}`}
                place={place}
                onUpdate={updatePlan(i)}
                members={members}
                currentMemberId={currentMemberId}
                start={start}
                near={near}
                autoFocus={i === 0}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={form.visited} onChange={(e) => set("visited", e.target.checked)} />
            ไปแล้ว
          </label>
        </div>

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

/** Top of a plan tab: shows whether this plan is the one in use, with a button to switch to it. */
function PlanInUseBar({ inUse, onUse, children }: { inUse: boolean; onUse: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface/70 px-3 py-2 text-xs">
      {inUse ? (
        <span className="rounded-full bg-baby px-2.5 py-1 font-medium text-baby-ink">✓ กำลังใช้แผนนี้</span>
      ) : (
        <button type="button" onClick={onUse} className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-soft shadow-sm hover:text-baby-ink">
          ใช้แผนนี้แทน
        </button>
      )}
      <span className="ml-auto">{children}</span>
    </div>
  );
}

function PlaceFields({
  idPrefix,
  place,
  onUpdate,
  members,
  currentMemberId,
  start,
  near,
  autoFocus,
}: {
  idPrefix: string;
  place: Place;
  onUpdate: PlaceUpdate;
  members: Member[];
  currentMemberId: string;
  start: Date | null;
  near: LatLng | null;
  autoFocus?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const setField = <K extends keyof Place>(k: K, v: Place[K]) => onUpdate((p) => ({ ...p, [k]: v }));

  return (
    <>
      <div>
        <label className={labelClass} htmlFor={id("title")}>ชื่อสถานที่ / กิจกรรม</label>
        <input
          id={id("title")}
          autoFocus={autoFocus}
          className={inputClass}
          value={place.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="เช่น teamLab Planets"
        />
      </div>

      <MapPlaceField
        id={id("map")}
        value={place.mapUrl}
        near={near}
        onChange={(mapUrl) => setField("mapUrl", mapUrl)}
        onPick={(p) => onUpdate((x) => (x.title.trim() ? x : { ...x, title: p.name }))}
      />

      <div>
        <label className={labelClass} htmlFor={id("note")}>โน้ต</label>
        <textarea
          id={id("note")}
          rows={2}
          className={inputClass}
          value={place.note}
          onChange={(e) => setField("note", e.target.value)}
          placeholder="จองล่วงหน้า, เมนูเด็ด, เวลาเปิด-ปิด…"
        />
      </div>

      <ImagePicker
        idPrefix={idPrefix}
        allowUrl={false}
        images={place.images}
        onUpdate={(update) => onUpdate((p) => ({ ...p, images: update(p.images) }))}
      />

      <div>
        <label className={labelClass} htmlFor={id("guidelines")}>Tips! (บรรทัดละ 1 ข้อ)</label>
        <textarea
          id={id("guidelines")}
          rows={3}
          className={inputClass}
          value={place.guidelines.join("\n")}
          onChange={(e) => setField("guidelines", e.target.value.split("\n"))}
          placeholder={"ถ่ายรูปมุมประตูหน้า\nลองชิมไอติมมัทฉะ\nไปก่อน 9 โมงคนน้อย"}
        />
      </div>

      <BookingFields
        idPrefix={idPrefix}
        booking={place.booking}
        members={members}
        currentMemberId={currentMemberId}
        start={start}
        onUpdate={(update) => onUpdate((p) => ({ ...p, booking: update(p.booking) }))}
      />
    </>
  );
}
