"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browser } from "react-dom";
import { useCloudSync, type SyncStatus } from "@/lib/useCloudSync";
import { checkPin, pinHashOf } from "@/lib/pin";
import { ImageUploadProvider, inlineImages, makeUploader, replaceStrings } from "@/lib/imageUpload";
import { ReadOnlyProvider } from "./ReadOnly";
import { PinPad } from "./PinPad";
import { Itinerary } from "./Itinerary";
import { Expenses } from "./Expenses";
import { Checklist } from "./Checklist";
import { Categories } from "./Categories";
import { GUEST, ProfileSelect, ProfileSwitcher } from "./ProfileSelect";
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
  formatDateRange,
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
  wishesToBuyByActivity,
  type Activity,
  type Category,
  type Day,
  type Member,
  type WishItem,
  type WishTag,
  type TripData,
} from "@/lib/trip";

const STORAGE_KEY = "tokyo-trip-planner:v1";

const BACKUP_KEY = "tokyo-trip-planner:backup";
/** The value if it's an array, else the fallback (a broken list in saved data shouldn't fail the load). */
function list<T>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

/** Saved data that couldn't be read is copied here first, so the auto-save can never wipe it out. */
let loadFailed = false;

/** Turn saved trip JSON (from this browser or the server) into a complete, current-format trip. */
function normalizeTrip(parsedValue: unknown): TripData {
  const parsed = (parsedValue ?? {}) as Partial<TripData>;
  const has = (k: keyof TripData) => k in parsed;
  // A missing or broken list falls back to empty instead of failing the whole load.
  const trip = {
    ...SAMPLE_TRIP,
    ...parsed,
    days: list<TripData["days"][number]>(parsed.days),
    activities: list<TripData["activities"][number]>(parsed.activities),
    expenses: list<TripData["expenses"][number]>(parsed.expenses),
  };
  const members = migrateMembers(list(parsed.members, SAMPLE_TRIP.members));
  return {
    ...trip,
    name: typeof trip.name === "string" && trip.name.trim() ? trip.name : DEFAULT_TRIP_NAME,
    members,
    checklist: normalizeChecklist(trip.checklist, members),
    days: sortDays(trip.days.map(normalizeDay)),
    categories: normalizeCategories(trip.categories),
    activities: trip.activities.map(normalizeActivity),
    // Trips saved before the Wishlist existed start with an empty list and the default tags.
    wishlist: has("wishlist") ? normalizeWishlist(trip.wishlist) : [],
    wishTags: normalizeWishTags(trip.wishTags),
    // Saves from before flights/hotels existed start with none (not the sample ones).
    flights: has("flights") ? normalizeFlights(trip.flights, members) : [],
    hotels: has("hotels") ? normalizeHotels(trip.hotels, members) : [],
    // Saves from before "who has paid" ticks existed start with nothing ticked.
    paidShares: has("paidShares") ? normalizePaidShares(trip.paidShares) : {},
  };
}

/** Whether this browser had its own saved trip when the page opened. */
let hadLocalSave = false;

/** Backup keys, newest first. */
function backupKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${BACKUP_KEY}:`)) keys.push(k);
  }
  return keys.sort((a, b) => Number(b.split(":").pop()) - Number(a.split(":").pop()));
}

/** Drop all but the newest `keep` backups (each is a full copy of the trip, photos included). */
function pruneBackups(keep: number) {
  try {
    backupKeys().slice(keep).forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage blocked
  }
}

function backupTrip(raw: string) {
  pruneBackups(1); // keep the newest older one plus this new one
  try {
    localStorage.setItem(`${BACKUP_KEY}:${Date.now()}`, raw);
  } catch {
    // storage full or blocked; nothing more we can do here
  }
}

function loadTrip(): TripData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const trip = normalizeTrip(JSON.parse(raw));
      hadLocalSave = true;
      return trip;
    }
  } catch {
    // Unreadable save: keep a copy before the sample trip's auto-save replaces it.
    if (raw) {
      loadFailed = true;
      backupTrip(raw);
    }
  }
  return SAMPLE_TRIP;
}

type View = "plan" | "bookings" | "wishlist" | "expenses" | "members" | "categories" | "checklist";

/** A page plus the element to scroll to there (and the day to show, for the Trip Planner). */
export type GoTo = { view: View; elementId: string; day?: string };

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
const SESSION_KEY = "tokyo-trip-planner:session";
const OLD_PROFILE_KEY = "tokyo-trip-planner:profile";

/**
 * Who is using this browser: a member (with the PIN they entered, kept so saves can prove it to
 * the server — `prevPin` covers the save that changes their own PIN) or a view-only guest.
 */
type Session = { memberId: string; pin: string; prevPin?: string } | { guest: true };

function loadSession(): Session | null {
  try {
    // Profiles chosen before PINs existed have to enter their PIN once.
    localStorage.removeItem(OLD_PROFILE_KEY);
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    if (s && ("guest" in s ? s.guest === true : typeof s.memberId === "string" && typeof s.pin === "string")) return s;
  } catch {
    // unreadable: ask again
  }
  return null;
}

export function TripPlanner() {
  use(browser("The trip plan is stored in this browser's localStorage."));

  const [trip, setTripState] = useState<TripData>(loadTrip);
  const [session, setSession] = useState<Session | null>(loadSession);
  // Profile chosen from the header menu, waiting for its PIN.
  const [switchTo, setSwitchTo] = useState<Member | null>(null);
  const isGuest = !!session && "guest" in session;
  // Guests can't change anything: every trip update is dropped here, whatever control triggered it.
  const readOnlyRef = useRef(isGuest);
  useEffect(() => {
    readOnlyRef.current = isGuest;
  }, [isGuest]);
  const setTrip = useCallback<typeof setTripState>((update) => {
    if (!readOnlyRef.current) setTripState(update);
  }, []);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [saveFailed, setSaveFailed] = useState(false);
  // Read once on mount: whether the saved trip couldn't be loaded (and was backed up).
  const [loadError, setLoadError] = useState(() => loadFailed);
  const memberAuth = session && !("guest" in session) ? session : null;
  const sync = useCloudSync({
    trip,
    setTrip: setTripState, // the server's copy always applies, guests included
    auth: memberAuth,
    readOnly: isGuest,
    parse: normalizeTrip,
    hadLocalSave,
    backupLocal: (t) => backupTrip(JSON.stringify(t)),
  });
  const uploadImage = useMemo(
    () => makeUploader(memberAuth && { memberId: memberAuth.memberId, pin: memberAuth.pin }),
    [memberAuth?.memberId, memberAuth?.pin], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Photos added before cloud storage were kept inline in the trip data; move them to the cloud once.
  const migrating = useRef(false);
  useEffect(() => {
    if (sync.status !== "synced" || !memberAuth || migrating.current) return;
    const inline = inlineImages(trip);
    if (inline.length === 0) return;
    migrating.current = true;
    void (async () => {
      const map = new Map<string, string>();
      for (const src of inline) {
        try {
          const url = await uploadImage(await (await fetch(src)).blob());
          if (!url) break; // no server storage
          map.set(src, url);
        } catch {
          break; // offline or refused: retry next time the trip syncs
        }
      }
      if (map.size > 0) setTrip((t) => replaceStrings(t, map));
      migrating.current = false;
    })();
  }, [sync.status, trip, memberAuth, uploadImage, setTrip]);

  const [view, setViewState] = useState<View>("plan");
  /** Activity whose wishes the Wishlist should point at (set by the "มีของที่ต้องซื้อ" badge). */
  const [wishFocus, setWishFocus] = useState<string | null>(null);
  const setView = (v: View) => {
    setWishFocus(null);
    setViewState(v);
  };
  const openWishlistAt = (activityId: string) => {
    setViewState("wishlist");
    setWishFocus(activityId);
  };
  /** Element to scroll to (and flash) once its page is showing, e.g. "activity-…" or "wish-…". */
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  /** Open a page at one item: used by links such as a wish's activity or Budget's "edit at …". */
  const goTo = (target: GoTo) => {
    setView(target.view);
    if (target.day) setSelectedDay(target.day);
    setScrollTarget(target.elementId);
  };
  const openActivity = (activityId: string) => {
    const a = trip.activities.find((x) => x.id === activityId);
    if (a) goTo({ view: "plan", day: a.dayId, elementId: `activity-${a.id}` });
  };
  useEffect(() => {
    if (!scrollTarget) return;
    // Wait a frame so the newly opened page is in the DOM.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(scrollTarget);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.animate([{ boxShadow: "0 0 0 3px var(--color-baby-ink)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1600 });
      setScrollTarget(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollTarget, view]);
  const [menuOrder, setMenuOrder] = useState<View[]>(loadMenuOrder);

  useEffect(() => {
    let failed = false;
    const raw = JSON.stringify(trip);
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // Storage full: old backups are the usual culprit, so drop them and try once more.
      pruneBackups(0);
      try {
        localStorage.setItem(STORAGE_KEY, raw);
      } catch {
        // still full (inline photos) or blocked; the app still works for this session
        failed = true;
      }
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

  const saveSession = (s: Session | null) => {
    setSession(s);
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // storage blocked; the choice still holds for this session
    }
  };
  const signIn = (memberId: string, pin: string) => saveSession({ memberId, pin });
  const signOut = () => {
    saveSession(null);
    setView("plan");
    window.scrollTo({ top: 0 });
  };

  /** Change the signed-in member's own PIN (the old one stays valid for the save that carries it). */
  const changeMyPin = (newPin: string) => {
    if (!session || "guest" in session) return;
    setTrip((t) => ({
      ...t,
      members: t.members.map((m) => (m.id === session.memberId ? { ...m, pinHash: pinHashOf(m.id, newPin) } : m)),
    }));
    saveSession({ memberId: session.memberId, pin: newPin, prevPin: session.pin });
  };
  /** Put a member back on the default PIN (when they forgot theirs). */
  const resetPin = (memberId: string) =>
    setTrip((t) => ({
      ...t,
      members: t.members.map((m) => {
        if (m.id !== memberId) return m;
        const rest = { ...m };
        delete rest.pinHash;
        return rest;
      }),
    }));

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
    const day = { id: uid(), date: last ? addDays(last.date, 1) : new Date().toLocaleDateString("sv-SE") /* today, YYYY-MM-DD */, title: "วันใหม่ · ยังไม่ได้ตั้งชื่อ", ootd: EMPTY_OOTD };
    patch({ days: [...trip.days, day] });
    setSelectedDay(day.id);
  };

  // A member session only counts while its PIN still matches (it may have been changed elsewhere).
  const member = session && !("guest" in session) ? trip.members.find((m) => m.id === session.memberId) : undefined;
  const me = isGuest ? GUEST : member && session && !("guest" in session) && checkPin(member, session.pin) ? member : undefined;
  // Year of the first trip day, e.g. "2026 Trip"; follows the dates if they change.
  const tripYear = trip.days[0]?.date.slice(0, 4) || String(new Date().getFullYear());
  if (!me) {
    return (
      <ProfileSelect
        tripName={trip.name}
        tripYear={tripYear}
        tripDates={formatDateRange(trip.days.map((d) => d.date))}
        members={trip.members}
        // Until the shared trip has loaded, the members are only this browser's copy (or the default).
        loading={sync.status === "connecting"}
        onSelect={signIn}
        onGuest={() => saveSession({ guest: true })}
        onRestoreDefaults={() => patch({ members: DEFAULT_MEMBERS })}
      />
    );
  }


  return (
    <ReadOnlyProvider value={isGuest}>
    <ImageUploadProvider value={uploadImage}>
    <div className="min-h-dvh">
      {switchTo && (
        <PinPad
          title={`${switchTo.emoji} ${switchTo.name}`}
          avatar={switchTo.emoji}
          subtitle={`ใส่ PIN 4 หลักของ ${switchTo.name}`}
          check={(pin) => checkPin(switchTo, pin)}
          onSuccess={(pin) => {
            signIn(switchTo.id, pin);
            setSwitchTo(null);
          }}
          onCancel={() => setSwitchTo(null)}
        />
      )}
      {isGuest && (
        <p className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-white">
          Guest Mode · ดูอย่างเดียว — เข้าโปรไฟล์ด้วย PIN เพื่อแก้ไข
        </p>
      )}
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
            <div className="min-w-0">
              <p className="font-sans text-sm font-medium tracking-[0.2em] text-baby-ink">{tripYear} Trip</p>
              <SyncBadge status={sync.status} updatedAt={sync.updatedAt} guest={isGuest} />
            </div>
            <ProfileSwitcher
              me={me}
              members={trip.members}
              onSelect={(id) => {
                const m = trip.members.find((x) => x.id === id);
                if (m) setSwitchTo(m);
              }}
              onGuest={() => saveSession({ guest: true })}
              onSignOut={signOut}
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

      {sync.replaced && !isGuest && (
        <div role="status" className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-2 rounded-2xl bg-baby px-4 py-2 text-sm text-baby-ink sm:mx-6 lg:mx-auto">
          <p className="min-w-0 flex-1">เปิดข้อมูลล่าสุดที่ทุกคนใช้ร่วมกันแล้ว — ข้อมูลเดิมในเครื่องนี้สำรองไว้</p>
          <button
            onClick={sync.restoreReplaced}
            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-baby-ink shadow-sm hover:bg-white/80"
          >
            ใช้ข้อมูลในเครื่องนี้แทน
          </button>
          <IconButton icon="close" size="sm" label="ปิดข้อความ" onClick={sync.dismissReplaced} />
        </div>
      )}

      {loadError && (
        <div role="alert" className="mx-auto mt-4 flex max-w-6xl items-start gap-2 rounded-2xl bg-alert/60 px-4 py-2 text-sm text-alert-ink sm:mx-6 lg:mx-auto">
          <p className="flex-1">
            ⚠️ อ่านข้อมูลที่บันทึกไว้ไม่ได้ เลยเปิดทริปว่างแทน — ข้อมูลเดิมถูกสำรองไว้ในเบราว์เซอร์แล้ว (ไม่ได้หาย)
          </p>
          <IconButton icon="close" size="sm" label="ปิดข้อความ" onClick={() => setLoadError(false)} />
        </div>
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
                wishesToBuy={wishesToBuyByActivity(trip.wishlist)}
                onOpenWishlist={openWishlistAt}
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
            thbPerJpy={trip.thbPerJpy}
            focusActivityId={wishFocus}
            startOnEveryone={!!scrollTarget?.startsWith("wish-")}
            onOpenActivity={openActivity}
            onSaveItem={saveWish}
            onDeleteItem={deleteWish}
            onSaveTag={saveWishTag}
            onDeleteTag={deleteWishTag}
          />
        )}
        {view === "expenses" && <Expenses data={trip} currentMemberId={me.id} onChange={patch} onGoTo={goTo} />}
        {view === "members" && (
          <Members
            members={trip.members}
            currentMemberId={me.id}
            usage={(id) => memberUsage(trip, id)}
            onSave={saveMember}
            onDelete={deleteMember}
            onChangeMyPin={changeMyPin}
            onResetPin={resetPin}
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
            startOnEveryone={!!scrollTarget?.startsWith("check-")}
            onChange={(checklist) => patch({ checklist })} />}
      </main>

      {!isGuest && (
      <footer className="mx-auto max-w-6xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center text-xs text-ink-soft sm:px-6">
        ข้อมูลบันทึกอัตโนมัติ
      </footer>
      )}
    </div>
    </ImageUploadProvider>
    </ReadOnlyProvider>
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

const SYNC_TEXT: Record<SyncStatus, string> = {
  connecting: "กำลังโหลดข้อมูลล่าสุด…",
  local: "", // no database connected: show nothing
  synced: "ซิงก์แล้ว",
  saving: "กำลังบันทึก…",
  offline: "⚠️ ออฟไลน์ — จะซิงก์ให้เมื่อต่อเน็ตได้",
  tooLarge: "⚠️ ข้อมูลใหญ่เกิน (รูปเยอะ) — ซิงก์ไม่ได้",
  denied: "⚠️ บันทึกไม่ได้: PIN ไม่ถูกต้อง — ออกจากระบบแล้วเข้าใหม่",
};

/** Small line under "2026 Trip" showing whether changes reached the shared copy. */
function SyncBadge({ status, updatedAt, guest }: { status: SyncStatus; updatedAt: string | null; guest: boolean }) {
  const time =
    status === "synced" && updatedAt
      ? ` · ${new Date(updatedAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
      : "";
  const warn = status === "offline" || status === "tooLarge" || status === "denied";
  if (status === "local") return null;
  return (
    <p
      aria-live="polite"
      className={`truncate text-[11px] ${warn ? "font-medium text-alert-ink" : "text-ink-soft"}`}
    >
      {guest && status === "synced" ? "ดูอย่างเดียว · อัปเดตอัตโนมัติ" : SYNC_TEXT[status]}
      {time}
    </p>
  );
}
