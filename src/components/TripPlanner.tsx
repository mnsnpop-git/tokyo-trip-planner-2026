"use client";

import { use, useEffect, useState } from "react";
import { browser } from "react-dom";
import { Itinerary } from "./Itinerary";
import { Expenses } from "./Expenses";
import { Checklist } from "./Checklist";
import { Categories } from "./Categories";
import { ProfileSelect, ProfileSwitcher } from "./ProfileSelect";
import { TripSummary } from "./TripSummary";
import { HamburgerNav, type MenuItem } from "./MainMenu";
import { Members } from "./Members";
import { Bookings } from "./Bookings";
import { IconButton } from "./Icons";
import { Wishlist } from "./Wishlist";
import {
  DEFAULT_MEMBERS,
  DEFAULT_TRIP_NAME,
  EMPTY_OOTD,
  TRIP_NAME_MAX,
  SAMPLE_TRIP,
  addDays,
  formatDate,
  formatDayTab,
  memberUsage,
  expensesByActivity,
  migrateMembers,
  normalizeActivity,
  normalizeDay,
  normalizeCategories,
  normalizeChecklist,
  normalizeWishTags,
  normalizeWishlist,
  normalizePaidShares,
  normalizeFlights,
  normalizeHotels,
  sortDays,
  uid,
  type Activity,
  type Category,
  type Day,
  type Member,
  type WishItem,
  type WishTag,
  type TripData,
} from "@/lib/trip";

const STORAGE_KEY = "tokyo-trip-planner:v1";

function loadTrip(): TripData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const trip = { ...SAMPLE_TRIP, ...(JSON.parse(raw) as Partial<TripData>) };
      const members = migrateMembers(trip.members);
      return {
        ...trip,
        name: typeof trip.name === "string" && trip.name.trim() ? trip.name : DEFAULT_TRIP_NAME,
        members,
        checklist: normalizeChecklist(trip.checklist, members),
        days: sortDays(trip.days.map(normalizeDay)),
        categories: normalizeCategories(trip.categories),
        activities: trip.activities.map(normalizeActivity),
        // Trips saved before the Wishlist existed start with an empty list and the default tags.
        wishlist: raw.includes('"wishlist"') ? normalizeWishlist(trip.wishlist) : [],
        wishTags: normalizeWishTags(trip.wishTags),
        // Saves from before "who has paid" ticks existed start with nothing ticked.
        // Saves from before flights/hotels existed start with none (not the sample ones).
        flights: raw.includes('"flights"') ? normalizeFlights(trip.flights, members) : [],
        hotels: raw.includes('"hotels"') ? normalizeHotels(trip.hotels, members) : [],
        paidShares: raw.includes('"paidShares"') ? normalizePaidShares(trip.paidShares) : {},
      };
    }
  } catch {
    // ignore unreadable storage and fall back to the sample trip
  }
  return SAMPLE_TRIP;
}

type View = "plan" | "bookings" | "wishlist" | "expenses" | "members" | "categories" | "checklist";

const MENU: MenuItem<View>[] = [
  { id: "plan", label: "Trip Planner", icon: "🗓️" },
  { id: "bookings", label: "Reservations", icon: "🎫" },
  { id: "wishlist", label: "Wishlist", icon: "🛍️" },
  { id: "expenses", label: "Budget", icon: "💴" },
  { id: "members", label: "Travelers", icon: "👥" },
  { id: "categories", label: "Activity Type", icon: "🏷️" },
  { id: "checklist", label: "Checklist", icon: "🎒" },
];

// Menu order is a per-device preference, like the chosen profile.
const MENU_ORDER_KEY = "tokyo-trip-planner:menu-order";

/** Saved menu order, ignoring unknown ids and appending any menu added since it was saved. */
function loadMenuOrder(): View[] {
  const ids = MENU.map((m) => m.id);
  try {
    const saved = JSON.parse(localStorage.getItem(MENU_ORDER_KEY) ?? "[]") as unknown;
    if (Array.isArray(saved)) {
      const known = saved.filter((id): id is View => ids.includes(id as View));
      return [...new Set([...known, ...ids])];
    }
  } catch {
    // unreadable storage: use the default order
  }
  return ids;
}

// The chosen profile is per device, so it lives apart from the shared trip data.
const PROFILE_KEY = "tokyo-trip-planner:profile";

function loadProfile(): string | null {
  try {
    return localStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
}

export function TripPlanner() {
  use(browser("The trip plan is stored in this browser's localStorage."));

  const [trip, setTrip] = useState<TripData>(loadTrip);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(loadProfile);
  const [view, setView] = useState<View>("plan");
  const [menuOrder, setMenuOrder] = useState<View[]>(loadMenuOrder);

  useEffect(() => {
    let failed = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    } catch {
      // storage full (usually too many uploaded photos) or blocked; the app still works for this session
      failed = true;
    }
    // Reports the outcome of the external write; React bails out when the value is unchanged.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(failed);
  }, [trip]);

  // Keep the browser tab title in step with the trip name.
  useEffect(() => {
    document.title = trip.name;
  }, [trip.name]);

  const patch = (p: Partial<TripData>) => setTrip((t) => ({ ...t, ...p }));

  const menu = menuOrder.map((id) => MENU.find((m) => m.id === id)!);
  const saveMenuOrder = (order: View[]) => {
    setMenuOrder(order);
    try {
      localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(order));
    } catch {
      // storage blocked; the order still holds for this session
    }
  };

  const selectProfile = (id: string | null) => {
    setProfileId(id);
    try {
      if (id) localStorage.setItem(PROFILE_KEY, id);
      else localStorage.removeItem(PROFILE_KEY);
    } catch {
      // storage blocked; the choice still holds for this session
    }
  };

  const saveActivity = (a: Activity) =>
    setTrip((t) => ({
      ...t,
      activities: t.activities.some((x) => x.id === a.id)
        ? t.activities.map((x) => (x.id === a.id ? a : x))
        : [...t.activities, a],
    }));

  const deleteActivity = (id: string) =>
    setTrip((t) => ({
      ...t,
      activities: t.activities.filter((a) => a.id !== id),
      // Wishes bought "at" this activity stay on the list, just unlinked.
      wishlist: t.wishlist.map((w) => (w.activityId === id ? { ...w, activityId: "" } : w)),
    }));

  const saveCategory = (c: Category) =>
    setTrip((t) => ({
      ...t,
      categories: t.categories.some((x) => x.id === c.id)
        ? t.categories.map((x) => (x.id === c.id ? c : x))
        : [...t.categories, c],
    }));

  /** Remove a category and move any activities that used it to `moveTo`. */
  const deleteCategory = (id: string, moveTo: string) =>
    setTrip((t) => ({
      ...t,
      categories: t.categories.filter((c) => c.id !== id),
      activities: t.activities.map((a) => (a.category === id ? { ...a, category: moveTo } : a)),
    }));

  const saveWish = (w: WishItem) =>
    setTrip((t) => ({
      ...t,
      wishlist: t.wishlist.some((x) => x.id === w.id) ? t.wishlist.map((x) => (x.id === w.id ? w : x)) : [...t.wishlist, w],
    }));

  const deleteWish = (id: string) => setTrip((t) => ({ ...t, wishlist: t.wishlist.filter((w) => w.id !== id) }));

  const saveWishTag = (tag: WishTag) =>
    setTrip((t) => ({
      ...t,
      wishTags: t.wishTags.some((x) => x.id === tag.id) ? t.wishTags.map((x) => (x.id === tag.id ? tag : x)) : [...t.wishTags, tag],
    }));

  /** Remove a tag and strip it from every wish that used it. */
  const deleteWishTag = (id: string) =>
    setTrip((t) => ({
      ...t,
      wishTags: t.wishTags.filter((x) => x.id !== id),
      wishlist: t.wishlist.map((w) => (w.tags.includes(id) ? { ...w, tags: w.tags.filter((x) => x !== id) } : w)),
    }));

  const saveMember = (m: Member) =>
    setTrip((t) => ({
      ...t,
      members: t.members.some((x) => x.id === m.id) ? t.members.map((x) => (x.id === m.id ? m : x)) : [...t.members, m],
    }));

  const deleteMember = (id: string) => setTrip((t) => ({ ...t, members: t.members.filter((m) => m.id !== id) }));

  /** Save a day's name/date, keeping days in date order so Day numbers follow the calendar. */
  const updateDay = (day: Day) =>
    setTrip((t) => ({ ...t, days: sortDays(t.days.map((d) => (d.id === day.id ? day : d))) }));

  const deleteDay = (id: string) => {
    setTrip((t) => ({
      ...t,
      days: t.days.filter((d) => d.id !== id),
      activities: t.activities.filter((a) => a.dayId !== id),
    }));
    if (selectedDay === id) setSelectedDay("all");
  };

  const addDay = () => {
    const last = trip.days[trip.days.length - 1];
    const day = { id: uid(), date: last ? addDays(last.date, 1) : "2026-12-12", title: "วันใหม่ · ยังไม่ได้ตั้งชื่อ", ootd: EMPTY_OOTD };
    patch({ days: [...trip.days, day] });
    setSelectedDay(day.id);
  };

  const me = trip.members.find((m) => m.id === profileId);
  // Year of the first trip day, e.g. "2026 Trip"; follows the dates if they change.
  const tripYear = trip.days[0]?.date.slice(0, 4) || String(new Date().getFullYear());
  if (!me) {
    return (
      <ProfileSelect
        tripName={trip.name}
        tripYear={tripYear}
        members={trip.members}
        onSelect={selectProfile}
        onRestoreDefaults={() => patch({ members: DEFAULT_MEMBERS })}
      />
    );
  }


  return (
    <div className="min-h-dvh">
      {/* Header + hamburger stay frozen at the top while the page scrolls. */}
      <div className="sticky top-0 z-40 shadow-[0_1px_8px_rgba(17,20,24,0.06)]">
      <header className="relative border-b border-line bg-white bg-gradient-to-b from-baby/70 via-white to-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden text-baby-ink/15">
          <span className="absolute left-[6%] top-3 text-3xl">❄</span>
          <span className="absolute left-[30%] top-10 text-xl">❄</span>
          <span className="absolute right-[12%] top-4 text-4xl">❄</span>
          <span className="absolute right-[38%] top-12 text-lg">❄</span>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-4 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-sm font-medium tracking-[0.2em] text-baby-ink">{tripYear} Trip</p>
            <ProfileSwitcher
              me={me}
              members={trip.members}
              onSelect={selectProfile}
              onSignOut={() => {
                selectProfile(null);
                setView("plan");
                window.scrollTo({ top: 0 });
              }}
            />
          </div>
          <TripName name={trip.name} onChange={(name) => patch({ name })} />
        </div>

      </header>

      {/* Main menu (hamburger) */}
      <HamburgerNav items={menu} active={view} onSelect={setView} onReorder={saveMenuOrder} embedded />
      </div>

      {view === "plan" && (
        <nav aria-label="เลือกวัน" className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <DayTab active={selectedDay === "all"} onClick={() => setSelectedDay("all")}>
              All
            </DayTab>
            {trip.days.map((d, i) => (
              <DayTab
                key={d.id}
                active={selectedDay === d.id}
                onClick={() => setSelectedDay(d.id)}
                label={`Day ${i + 1} · ${formatDate(d.date)} · ${d.title}`}
              >
                <span className="font-mono tracking-wide">{formatDayTab(d.date)}</span>
              </DayTab>
            ))}
            <IconButton icon="add" label="เพิ่มวัน" onClick={addDay} className="self-center" />
          </div>
        </nav>
      )}

      {saveFailed && (
        <p role="alert" className="mx-auto mt-4 max-w-6xl rounded-2xl bg-alert/60 px-4 py-2 text-sm text-alert-ink sm:mx-6 lg:mx-auto">
          ⚠️ บันทึกลงเบราว์เซอร์ไม่ได้ (พื้นที่อาจเต็มเพราะรูปเยอะเกินไป) — ลองลบรูปที่อัปโหลด หรือใช้ลิงก์รูปแทน
        </p>
      )}

      <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${view === "plan" ? "max-w-4xl" : "max-w-2xl"}`}>
        {view === "plan" && (
          <div className="min-w-0 space-y-4">
            {selectedDay === "all" ? (
              <TripSummary
                days={trip.days}
                activities={trip.activities}
                categories={trip.categories}
                costs={expensesByActivity(trip)}
                thbPerJpy={trip.thbPerJpy}
                flights={trip.flights}
                hotels={trip.hotels}
                members={trip.members}
                onTravelChange={patch}
                onOpenDay={(id) => {
                  setSelectedDay(id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ) : (
              <Itinerary
                days={trip.days}
                activities={trip.activities}
                categories={trip.categories}
                members={trip.members}
                currentMemberId={me.id}
                selectedDayId={selectedDay}
                costs={expensesByActivity(trip)}
                thbPerJpy={trip.thbPerJpy}
                flights={trip.flights}
                hotels={trip.hotels}
                onSave={saveActivity}
                onDelete={deleteActivity}
                onUpdateDay={updateDay}
                onDeleteDay={deleteDay}
              />
            )}
          </div>
        )}

        {view === "bookings" && (
          <Bookings
            days={trip.days}
            activities={trip.activities}
            members={trip.members}
            currentMemberId={me.id}
            onSave={saveActivity}
            onOpenDay={(id) => {
              setView("plan");
              setSelectedDay(id);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {view === "wishlist" && (
          <Wishlist
            items={trip.wishlist}
            tags={trip.wishTags}
            members={trip.members}
            days={trip.days}
            activities={trip.activities}
            currentMemberId={me.id}
            onSaveItem={saveWish}
            onDeleteItem={deleteWish}
            onSaveTag={saveWishTag}
            onDeleteTag={deleteWishTag}
          />
        )}
        {view === "expenses" && <Expenses data={trip} currentMemberId={me.id} onChange={patch} />}
        {view === "members" && (
          <Members
            members={trip.members}
            currentMemberId={me.id}
            usage={(id) => memberUsage(trip, id)}
            onSave={saveMember}
            onDelete={deleteMember}
          />
        )}
        {view === "categories" && (
          <Categories
            categories={trip.categories}
            activities={trip.activities}
            onSave={saveCategory}
            onDelete={deleteCategory}
          />
        )}
        {view === "checklist" && <Checklist
            items={trip.checklist}
            members={trip.members}
            currentMemberId={me.id}
            onChange={(checklist) => patch({ checklist })} />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center text-xs text-ink-soft sm:px-6">
        ข้อมูลบันทึกอัตโนมัติในเบราว์เซอร์นี้ ·{" "}
        {confirmReset ? (
          <>
            <button
              onClick={() => {
                setTrip(SAMPLE_TRIP);
                setSelectedDay("all");
                setConfirmReset(false);
              }}
              className="font-medium text-alert-ink underline"
            >
              ยืนยันล้างและโหลดข้อมูลตัวอย่าง
            </button>{" "}
            <button onClick={() => setConfirmReset(false)} className="underline">ยกเลิก</button>
          </>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="underline hover:text-ink">
            รีเซ็ตเป็นข้อมูลตัวอย่าง
          </button>
        )}
      </footer>
    </div>
  );
}

function DayTab({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Full description for screen readers and the hover tooltip. */
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-ink text-white shadow" : "bg-surface text-ink-soft hover:bg-baby hover:text-baby-ink"
      }`}
    >
      {children}
    </button>
  );
}

function TripName({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const start = () => {
    setDraft(name);
    setEditing(true);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (next) onChange(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="mt-1 flex flex-wrap items-center gap-2">
        <input
          aria-label="ชื่อทริป"
          autoFocus
          maxLength={TRIP_NAME_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          placeholder="เช่น Japlanning with OurIce"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-white/90 px-3 py-1 text-xl font-bold outline-none focus:border-baby-ink focus:ring-2 focus:ring-baby sm:text-2xl"
        />
        <span className="flex gap-1">
          <IconButton icon="close" label="ยกเลิก" onClick={() => setEditing(false)} />
          <IconButton type="submit" icon="confirm" tone="solid" label="บันทึกชื่อทริป" disabled={!draft.trim()} />
        </span>
      </form>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">
        {name}
      </h1>
      <IconButton icon="edit" label="แก้ไขชื่อทริป" onClick={start} />
    </div>
  );
}
