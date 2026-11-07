// Types, constants, sample data and helpers for the Tokyo trip planner.

export type Slot = "morning" | "afternoon" | "evening" | "night";

export const SLOTS: { id: Slot; label: string; icon: string; hint: string }[] = [
  { id: "morning", label: "เช้า", icon: "🌅", hint: "ก่อน 12:00" },
  { id: "afternoon", label: "บ่าย", icon: "☀️", hint: "12:00–16:59" },
  { id: "evening", label: "เย็น", icon: "🌇", hint: "17:00–19:59" },
  { id: "night", label: "ค่ำ", icon: "🌙", hint: "20:00 เป็นต้นไป" },
];

/** Preset badge colours. Class names are spelled out in full so Tailwind can see them. */
export const CATEGORY_COLORS = {
  baby: { label: "Baby Blue", badge: "bg-baby text-baby-ink", swatch: "bg-baby" },
  sky: { label: "ฟ้าเข้ม", badge: "bg-sky text-sky-ink", swatch: "bg-sky" },
  black: { label: "ดำ", badge: "bg-ink text-white", swatch: "bg-ink" },
  grey: { label: "เทา", badge: "bg-grey text-grey-ink", swatch: "bg-grey" },
  silver: { label: "เทาอ่อน", badge: "bg-surface text-ink-soft", swatch: "bg-surface" },
  white: { label: "ขาว", badge: "bg-white text-ink ring-1 ring-line", swatch: "bg-white" },
} as const;

// Colour keys from the earlier pastel theme, mapped onto the current palette when loading saved data.
const LEGACY_CATEGORY_COLORS: Record<string, CategoryColor> = {
  ice: "baby",
  sakura: "sky",
  lavender: "black",
  yuzu: "grey",
  matcha: "white",
  neutral: "silver",
};

export type CategoryColor = keyof typeof CATEGORY_COLORS;

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: CategoryColor;
}

// Ids match the fixed categories of earlier versions, so saved activities keep their category.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "sightseeing", label: "Sightseeing", icon: "⛩️", color: "sky" },
  { id: "food", label: "Food", icon: "🍜", color: "grey" },
  { id: "shopping", label: "Shopping", icon: "🛍️", color: "black" },
  { id: "transport", label: "Drive/Transport", icon: "🚗", color: "baby" },
  { id: "photo", label: "Photo Spot", icon: "📸", color: "white" },
];

const UNKNOWN_CATEGORY: Category = { id: "", label: "ไม่ระบุประเภท", icon: "🏷️", color: "silver" };

export function findCategory(categories: Category[], id: string): Category {
  return categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY;
}

export function categoryBadge(c: Category): string {
  return (CATEGORY_COLORS[c.color] ?? CATEGORY_COLORS.silver).badge;
}

/** Keep only well-formed categories from storage; fall back to the defaults if none survive. */
export function normalizeCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORIES;
  const valid = value.filter(
    (c): c is Category =>
      typeof c?.id === "string" && c.id !== "" && typeof c.label === "string" && typeof c.icon === "string",
  );
  const toColor = (color: string): CategoryColor =>
    color in CATEGORY_COLORS ? (color as CategoryColor) : (LEGACY_CATEGORY_COLORS[color] ?? "silver");
  const list = valid.map((c) => ({ ...c, color: toColor(String(c.color)) }));
  return list.length > 0 ? list : DEFAULT_CATEGORIES;
}

export type Currency = "JPY" | "THB";

export interface Member {
  id: string;
  name: string;
  emoji: string;
}

export interface Day {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  ootd: Ootd;
}

/** Outfit of the day: a dress-code theme for the group plus example pictures. */
export interface Ootd {
  theme: string;
  images: string[];
}

export const EMPTY_OOTD: Ootd = { theme: "", images: [] };

/** Fill in fields added later (OOTD) so older saved days keep working. */
export function normalizeDay(d: Omit<Day, "ootd"> & { ootd?: Partial<Ootd> | null }): Day {
  const images = Array.isArray(d.ootd?.images) ? d.ootd.images : [];
  return {
    ...d,
    ootd: {
      theme: typeof d.ootd?.theme === "string" ? d.ootd.theme : "",
      images: images.filter((x): x is string => typeof x === "string" && isSafeImageSrc(x)),
    },
  };
}

export type SubTaskPriority = "must" | "nice";

export const SUBTASK_PRIORITIES: { id: SubTaskPriority; label: string }[] = [
  { id: "must", label: "Must" },
  { id: "nice", label: "Nice" },
];

/** A spot or mini-activity to tick off within an activity (e.g. "Kaminarimon gate" at Senso-ji). */
export interface SubTask {
  id: string;
  title: string;
  note: string;
  images: string[];
  priority: SubTaskPriority;
  done: boolean;
}

function normalizeSubTasks(v: unknown): SubTask[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object" && typeof t.title === "string")
    .map((t) => ({
      id: typeof t.id === "string" && t.id ? t.id : uid(),
      title: t.title as string,
      note: typeof t.note === "string" ? t.note : "",
      images: Array.isArray(t.images) ? t.images.filter((x): x is string => typeof x === "string").filter(isSafeImageSrc) : [],
      priority: t.priority === "nice" ? "nice" : "must",
      done: t.done === true,
    }));
}

/** The place-specific part of a plan; used for both the main plan and the backup plan. */
export interface Place {
  title: string;
  note: string;
  mapUrl: string;
  images: string[]; // http(s) URLs or downscaled data:image URLs
  guidelines: string[]; // things people popularly do there
  subtasks: SubTask[]; // spots / mini-activities to tick off there
  booking: Booking; // each plan (main/backups) has its own reservation
}

export interface Activity extends Place {
  id: string;
  dayId: string;
  slot: Slot;
  time: string; // HH:MM
  category: string; // Category id
  backups: Place[]; // alternative plans (rain, long queue, closed…)
  planIndex: number; // plan in use: 0 = main, 1..n = backups[n - 1]
  visited: boolean;
}

export type PriceType = "total" | "perPerson";

export interface BookingPayment {
  required: boolean;
  amount: number; // per person or the whole bill, depending on priceType
  priceType: PriceType;
  currency: Currency;
  /** true: everyone pays their own share (no debts). false: paidBy pays first, the others pay them back. */
  selfPaid: boolean;
  paidBy: string; // member id who pays first (ignored when selfPaid)
  splitAmong: string[]; // member ids
  date: string; // YYYY-MM-DD the payment is made (or due); "" if unknown
}

/**
 * - none: no booking needed
 * - anytime: can be booked in advance any time
 * - window: booking only opens X hours/days before the activity
 * - walkin: no reservations taken; queue on the day
 */
export type BookingKind = "none" | "anytime" | "window" | "walkin";
export type WindowUnit = "hours" | "days";

export const BOOKING_KINDS: { id: BookingKind; label: string; icon: string }[] = [
  { id: "none", label: "ไม่ต้องจอง", icon: "—" },
  { id: "anytime", label: "จองได้เลย", icon: "🎫" },
  { id: "window", label: "รอเปิดจอง", icon: "🕒" },
  { id: "walkin", label: "Walk-in", icon: "🚶" },
];

/** Reservation info for a plan. Its payment feeds the Expenses page (see bookingExpenses). */
export interface Booking {
  kind: BookingKind;
  windowAmount: number; // for kind "window": how far ahead booking opens…
  windowUnit: WindowUnit; // …in hours or days
  booked: boolean;
  method: string; // how to book
  url: string; // where to book
  details: string; // confirmation number, number of people, etc.
  images: string[]; // confirmation screenshots, QR codes, tickets
  bookedBy: string; // member id, "" if not set
  payment: BookingPayment;
}

export const EMPTY_BOOKING: Booking = {
  kind: "none",
  windowAmount: 0,
  windowUnit: "days",
  booked: false,
  method: "",
  url: "",
  details: "",
  images: [],
  bookedBy: "",
  payment: { required: false, amount: 0, priceType: "total", currency: "JPY", selfPaid: false, paidBy: "", splitAmong: [], date: "" },
};

/** Kinds where someone has to make a reservation (walk-in and none don't). */
export const requiresBooking = (b: Booking) => b.kind === "anytime" || b.kind === "window";

/** True when the plan in use needs booking but nobody has booked it yet. */
export const needsBooking = (a: Activity) => {
  const b = activePlace(a).booking;
  return requiresBooking(b) && !b.booked;
};

/** What the whole group pays: per-person prices are multiplied by the number of people splitting. */
export function paymentTotal(p: Pick<BookingPayment, "amount" | "priceType" | "splitAmong">): number {
  return p.priceType === "perPerson" ? p.amount * p.splitAmong.length : p.amount;
}

/** Local date-time an activity starts, or null if the date/time is unusable. */
export function activityStart(date: string, time: string): Date | null {
  const d = new Date(`${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "00:00"}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** When booking opens for a "window" booking (activity start minus the window); null otherwise. */
export function bookingOpensAt(b: Booking, start: Date | null): Date | null {
  if (b.kind !== "window" || !start || !(b.windowAmount > 0)) return null;
  const ms = b.windowAmount * (b.windowUnit === "hours" ? 3_600_000 : 86_400_000);
  return new Date(start.getTime() - ms);
}

type LooseBooking = Omit<Partial<Booking>, "payment"> & { required?: boolean; payment?: Partial<BookingPayment> };

function normalizeBooking(b: LooseBooking | null | undefined): Booking {
  const p: Partial<BookingPayment> = b?.payment ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const amount = Number(p.amount);
  const windowAmount = Number(b?.windowAmount);
  const kinds = BOOKING_KINDS.map((k) => k.id);
  // Earlier versions only had a "required" flag: treat it as "book anytime".
  const kind: BookingKind = kinds.includes(b?.kind as BookingKind) ? (b!.kind as BookingKind) : b?.required ? "anytime" : "none";
  return {
    kind,
    windowAmount: Number.isFinite(windowAmount) && windowAmount > 0 ? windowAmount : 0,
    windowUnit: b?.windowUnit === "hours" ? "hours" : "days",
    booked: Boolean(b?.booked),
    method: str(b?.method),
    url: str(b?.url),
    details: str(b?.details),
    images: Array.isArray(b?.images) ? b.images.filter((x): x is string => typeof x === "string" && isSafeImageSrc(x)) : [],
    bookedBy: str(b?.bookedBy),
    payment: {
      required: Boolean(p.required),
      amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      priceType: p.priceType === "perPerson" ? "perPerson" : "total",
      currency: p.currency === "THB" ? "THB" : "JPY",
      selfPaid: Boolean(p.selfPaid),
      paidBy: str(p.paidBy),
      splitAmong: Array.isArray(p.splitAmong) ? p.splitAmong.filter((x): x is string => typeof x === "string") : [],
      date: str(p.date),
    },
  };
}

/** Return a copy of the activity with one plan's booking changed (0 = main, 1..n = backups). */
export function updatePlanBooking(a: Activity, planIndex: number, update: (b: Booking) => Booking): Activity {
  if (planIndex === 0) return { ...a, booking: update(a.booking) };
  return {
    ...a,
    backups: a.backups.map((p, i) => (i === planIndex - 1 ? { ...p, booking: update(p.booking) } : p)),
  };
}

/** Return a copy of the activity with one plan changed (0 = main, 1..n = backups). */
export function updatePlace(a: Activity, planIndex: number, update: (p: Place) => Place): Activity {
  if (planIndex === 0) return { ...a, ...update(a) };
  return { ...a, backups: a.backups.map((p, i) => (i === planIndex - 1 ? update(p) : p)) };
}

/** All plans of an activity: the main plan first, then the backups. */
export function plansOf(a: Activity): Place[] {
  return [a, ...a.backups];
}

/** "📍 แผนหลัก", "🔁 แผนสำรอง" (only one) or "🔁 สำรอง 2". */
export function planName(index: number, backupCount: number): string {
  if (index === 0) return "📍 แผนหลัก";
  return backupCount === 1 ? "🔁 แผนสำรอง" : `🔁 สำรอง ${index}`;
}

export const MAX_IMAGES = 8;

export const EMPTY_PLACE: Place = { title: "", note: "", mapUrl: "", images: [], guidelines: [], subtasks: [], booking: EMPTY_BOOKING };

/** The plan currently in use: the selected backup if it exists, otherwise the main plan. */
export function activePlace(a: Activity): Place {
  return (a.planIndex > 0 && a.backups[a.planIndex - 1]) || a;
}

/** A place as it may come from storage or sample data: any field can be missing. */
type LoosePlace = Omit<Partial<Place>, "booking" | "subtasks"> & { booking?: LooseBooking | null; subtasks?: unknown };

function normalizePlace(p: LoosePlace | null | undefined): Place {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    title: typeof p?.title === "string" ? p.title : "",
    note: typeof p?.note === "string" ? p.note : "",
    mapUrl: typeof p?.mapUrl === "string" ? p.mapUrl : "",
    images: strings(p?.images).filter(isSafeImageSrc),
    guidelines: strings(p?.guidelines),
    subtasks: normalizeSubTasks(p?.subtasks),
    booking: normalizeBooking(p?.booking),
  };
}

/** Fill in fields added after v1 so older saved trips keep working. */
export function normalizeActivity(
  a: Omit<Partial<Activity>, "backups" | "booking"> &
    Pick<Activity, "id" | "dayId" | "time" | "category"> & {
      backups?: LoosePlace[];
      booking?: LooseBooking | null;
      // Older saves had a single backup plan and a flag for using it.
      backup?: LoosePlace | null;
      useBackup?: boolean;
    },
): Activity {
  const { backup, useBackup, ...rest } = a;
  const backups = Array.isArray(a.backups) ? a.backups.map(normalizePlace) : backup ? [normalizePlace(backup)] : [];
  const wanted = typeof a.planIndex === "number" ? Math.floor(a.planIndex) : useBackup ? 1 : 0;
  return {
    ...rest,
    ...normalizePlace(a),
    slot: slotFromTime(a.time), // the time of day always follows the chosen time
    backups,
    planIndex: wanted >= 0 && wanted <= backups.length ? wanted : 0,
    visited: Boolean(a.visited),
  };
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  paidBy: string; // member id
  splitAmong: string[]; // member ids
  date?: string; // YYYY-MM-DD
  activityId?: string; // the activity this cost belongs to (bookings, linked expenses, wishes bought there)
  wishId?: string; // set on expenses derived from a bought wishlist item
  checklistId?: string; // set on expenses derived from a fully paid checklist item
  /** Everyone paid their own share: counts in totals but creates no debts (paidBy is ""). */
  selfPaid?: boolean;
}

/** Optional cost of a checklist item (e.g. camera rental), split equally. */
export interface ChecklistCost {
  amount: number; // full price
  currency: Currency;
  splitAmong: string[]; // member ids sharing the cost equally
  selfPaid: boolean; // everyone pays their own share (no debts)
  paidBy: string; // member id paying the shop first (ignored when selfPaid)
  deposit: number; // already paid as a deposit
  fullyPaid: boolean; // once paid in full, it appears in Expenses
}

/**
 * Something to prepare before the trip. Each assignee prepares it for themselves,
 * so "done" is tracked per profile.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  note: string;
  assignees: string[]; // member ids who need to prepare it
  doneBy: string[]; // member ids who have done it
  cost: ChecklistCost | null;
}

export const EMPTY_CHECKLIST_COST: ChecklistCost = {
  amount: 0,
  currency: "JPY",
  splitAmong: [],
  selfPaid: false,
  paidBy: "",
  deposit: 0,
  fullyPaid: false,
};

/** Amount still to pay (0 once fully paid). */
export const checklistRemaining = (c: ChecklistCost) => (c.fullyPaid ? 0 : Math.max(0, c.amount - c.deposit));

/**
 * Migrates older items: the shared `done` flag counts as done for everyone, and
 * items without assignees are for every member.
 */
export function normalizeChecklist(value: unknown, members: Member[]): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const everyone = members.map((m) => m.id);
  return value
    .filter((c) => typeof c?.id === "string" && typeof c?.label === "string")
    .map((c) => {
      const cost = c.cost && typeof c.cost === "object" ? c.cost : null;
      return {
        id: c.id,
        label: c.label,
        note: typeof c.note === "string" ? c.note : "",
        assignees: Array.isArray(c.assignees) ? strings(c.assignees) : everyone,
        doneBy: Array.isArray(c.doneBy) ? strings(c.doneBy) : c.done ? everyone : [],
        cost: cost && {
          amount: num(cost.amount),
          currency: cost.currency === "THB" ? "THB" : "JPY",
          splitAmong: strings(cost.splitAmong),
          selfPaid: Boolean(cost.selfPaid),
          paidBy: typeof cost.paidBy === "string" ? cost.paidBy : "",
          deposit: num(cost.deposit),
          fullyPaid: Boolean(cost.fullyPaid),
        },
      } satisfies ChecklistItem;
    });
}

/** Checklist items paid in full become expenses, split equally among the people sharing them. */
export function checklistExpenses(data: Pick<TripData, "checklist">): Expense[] {
  return data.checklist.flatMap((c): Expense[] => {
    const k = c.cost;
    if (!k || !k.fullyPaid || !(k.amount > 0) || (!k.selfPaid && !k.paidBy)) return [];
    return [
      {
        id: `check-${c.id}`,
        title: c.label,
        amount: k.amount,
        currency: k.currency,
        paidBy: k.selfPaid ? "" : k.paidBy,
        splitAmong: k.splitAmong.length ? k.splitAmong : k.selfPaid ? c.assignees : [k.paidBy],
        checklistId: c.id,
        ...(k.selfPaid && { selfPaid: true }),
      },
    ];
  });
}

// ---------- Flights & hotels ----------

export interface Airline {
  code: string; // IATA code, e.g. "TG"
  name: string;
}

/** Airlines commonly flown between Thailand and Japan (others can be typed in). */
export const AIRLINES: Airline[] = [
  { code: "TG", name: "Thai Airways" },
  { code: "XJ", name: "Thai AirAsia X" },
  { code: "FD", name: "Thai AirAsia" },
  { code: "VZ", name: "Thai Vietjet" },
  { code: "SL", name: "Thai Lion Air" },
  { code: "NH", name: "ANA" },
  { code: "JL", name: "Japan Airlines" },
  { code: "ZG", name: "ZIPAIR" },
  { code: "MM", name: "Peach" },
  { code: "GK", name: "Jetstar Japan" },
  { code: "TR", name: "Scoot" },
  { code: "CX", name: "Cathay Pacific" },
  { code: "VN", name: "Vietnam Airlines" },
  { code: "SQ", name: "Singapore Airlines" },
];

/** Logo image for an airline's IATA code (falls back to the code itself when it fails to load). */
export const airlineLogoUrl = (code: string) => `https://pics.avs.io/120/60/${encodeURIComponent(code.toUpperCase())}.png`;

export type FlightDirection = "outbound" | "return" | "other";

export const FLIGHT_DIRECTIONS: { id: FlightDirection; label: string; icon: string }[] = [
  { id: "outbound", label: "ขาไป", icon: "🛫" },
  { id: "return", label: "ขากลับ", icon: "🛬" },
  { id: "other", label: "เที่ยวบินอื่น", icon: "✈️" },
];

export type TravelPriceType = "total" | "perPerson" | "perNight";

/** Cost of a flight or hotel; split among its passengers / guests. */
export interface TravelCost {
  amount: number;
  priceType: TravelPriceType;
  currency: Currency;
  selfPaid: boolean;
  paidBy: string;
}

export const EMPTY_TRAVEL_COST: TravelCost = { amount: 0, priceType: "total", currency: "THB", selfPaid: false, paidBy: "" };

/** One flight segment: number, airports (free text) and local times. */
export interface FlightLeg {
  flightNo: string;
  from: string;
  to: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
}

export interface Flight {
  id: string;
  /** Return leg of a round-trip ticket (one ticket, one price); null = one-way. */
  returnLeg: FlightLeg | null;
  direction: FlightDirection;
  airline: string; // IATA code
  airlineName: string;
  flightNo: string;
  from: string;
  to: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  bookingRef: string;
  booked: boolean;
  note: string;
  passengers: string[];
  cost: TravelCost | null;
  /** Hotels whose stay is included in this ticket's price (a flight + hotel package); empty = hotel paid separately. */
  packageHotelIds: string[];
}

export interface Hotel {
  id: string;
  name: string;
  address: string;
  mapUrl: string;
  url: string;
  checkIn: string; // date of the first night
  checkOut: string; // date you leave
  checkInTime: string;
  checkOutTime: string;
  bookingRef: string;
  booked: boolean;
  note: string;
  guests: string[];
  cost: TravelCost | null;
}

/** Number of nights between check-in and check-out (0 if the dates are unusable). */
export function hotelNights(h: Pick<Hotel, "checkIn" | "checkOut">): number {
  const a = Date.parse(`${h.checkIn}T00:00:00Z`);
  const b = Date.parse(`${h.checkOut}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? Math.round((b - a) / 86_400_000) : 0;
}

/** Whether the hotel is where you sleep on the night of `date`. */
export const staysOn = (h: Hotel, date: string) => h.checkIn <= date && date < h.checkOut;

/** What the whole group pays for a cost split among `people`, staying `nights` nights. */
export function travelTotal(c: TravelCost, people: number, nights = 1): number {
  if (c.priceType === "perPerson") return c.amount * people;
  if (c.priceType === "perNight") return c.amount * nights;
  return c.amount;
}

/** Hotel id → the flight whose (priced) package includes that stay. */
export function packagedHotels(flights: Flight[]): Map<string, Flight> {
  const map = new Map<string, Flight>();
  for (const f of flights) if (f.cost) for (const id of f.packageHotelIds) if (!map.has(id)) map.set(id, f);
  return map;
}

/** The segments of a ticket: the outbound leg, plus the return leg of a round trip. */
export function flightLegs(f: Flight): { leg: FlightLeg; kind: "outbound" | "return" | "other" }[] {
  const first = { leg: f as FlightLeg, kind: f.returnLeg ? ("outbound" as const) : f.direction };
  return f.returnLeg ? [first, { leg: f.returnLeg, kind: "return" }] : [first];
}

export function flightTitle(f: Flight): string {
  const name = f.flightNo || f.airlineName || f.airline;
  if (f.returnLeg) {
    const nums = [f.flightNo, f.returnLeg.flightNo].filter(Boolean).join(" / ") || name;
    return [nums, f.from && f.to ? `${f.from} ⇄ ${f.to}` : ""].filter(Boolean).join(" · ");
  }
  return [name, f.from && f.to ? `${f.from} → ${f.to}` : ""].filter(Boolean).join(" · ");
}

function travelExpense(id: string, title: string, c: TravelCost | null, split: string[], nights: number, date: string): Expense[] {
  if (!c || !(c.amount > 0) || split.length === 0) return [];
  return [
    {
      id,
      title,
      amount: travelTotal(c, split.length, nights),
      currency: c.currency,
      paidBy: c.selfPaid ? "" : c.paidBy,
      splitAmong: split,
      date,
      ...(c.selfPaid && { selfPaid: true }),
    },
  ];
}

/** Flight tickets and hotel stays with a cost, as expenses (ids "flight-…" / "hotel-…"). */
export function travelExpenses(data: Pick<TripData, "flights" | "hotels">): Expense[] {
  const packaged = packagedHotels(data.flights);
  const hotelName = new Map(data.hotels.map((h) => [h.id, h.name]));
  return [
    ...data.flights.flatMap((f) => {
      const stays = f.packageHotelIds.map((id) => hotelName.get(id)).filter(Boolean);
      const title = `${f.returnLeg ? "ตั๋วไป-กลับ" : "ตั๋ว"} ${flightTitle(f)}${stays.length ? ` + ที่พัก ${stays.join(", ")}` : ""}`;
      return travelExpense(`flight-${f.id}`, title, f.cost, f.passengers, 1, f.departDate);
    }),
    // Stays included in a flight package are paid through the ticket, so they add nothing here.
    ...data.hotels.filter((h) => !packaged.has(h.id)).flatMap((h) =>
      travelExpense(`hotel-${h.id}`, `${h.name} (${hotelNights(h)} คืน)`, h.cost, h.guests, hotelNights(h), h.checkIn),
    ),
  ];
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const ids = (v: unknown, fallback: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : fallback);

function normalizeTravelCost(v: unknown): TravelCost | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<TravelCost>;
  return {
    amount: Number.isFinite(Number(c.amount)) ? Math.max(0, Number(c.amount)) : 0,
    priceType: c.priceType === "perPerson" || c.priceType === "perNight" ? c.priceType : "total",
    currency: c.currency === "JPY" ? "JPY" : "THB",
    selfPaid: c.selfPaid === true,
    paidBy: str(c.paidBy),
  };
}

function normalizeLeg(v: unknown): FlightLeg | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  return {
    flightNo: str(l.flightNo),
    from: str(l.from),
    to: str(l.to),
    departDate: str(l.departDate),
    departTime: str(l.departTime),
    arriveDate: str(l.arriveDate),
    arriveTime: str(l.arriveTime),
  };
}

export function normalizeFlights(value: unknown, members: Member[]): Flight[] {
  if (!Array.isArray(value)) return [];
  const all = members.map((m) => m.id);
  return value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: str(f.id) || uid(),
      direction: f.direction === "return" || f.direction === "other" ? f.direction : "outbound",
      airline: str(f.airline).toUpperCase(),
      returnLeg: normalizeLeg(f.returnLeg),
      packageHotelIds: ids(f.packageHotelIds, []),
      airlineName: str(f.airlineName),
      flightNo: str(f.flightNo),
      from: str(f.from),
      to: str(f.to),
      departDate: str(f.departDate),
      departTime: str(f.departTime),
      arriveDate: str(f.arriveDate),
      arriveTime: str(f.arriveTime),
      bookingRef: str(f.bookingRef),
      booked: f.booked === true,
      note: str(f.note),
      passengers: ids(f.passengers, all),
      cost: normalizeTravelCost(f.cost),
    }));
}

export function normalizeHotels(value: unknown, members: Member[]): Hotel[] {
  if (!Array.isArray(value)) return [];
  const all = members.map((m) => m.id);
  return value
    .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
    .map((h) => ({
      id: str(h.id) || uid(),
      name: str(h.name),
      address: str(h.address),
      mapUrl: str(h.mapUrl),
      url: str(h.url),
      checkIn: str(h.checkIn),
      checkOut: str(h.checkOut),
      checkInTime: str(h.checkInTime),
      checkOutTime: str(h.checkOutTime),
      bookingRef: str(h.bookingRef),
      booked: h.booked === true,
      note: str(h.note),
      guests: ids(h.guests, all),
      cost: normalizeTravelCost(h.cost),
    }));
}

export interface TripData {
  name: string;
  members: Member[];
  categories: Category[];
  days: Day[];
  activities: Activity[];
  expenses: Expense[];
  checklist: ChecklistItem[];
  wishlist: WishItem[];
  wishTags: WishTag[];
  flights: Flight[];
  hotels: Hotel[];
  /** Per expense id: member ids who have paid their share (paid the payer back, or paid their own). */
  paidShares: Record<string, string[]>;
  thbPerJpy: number;
}

// ---------- Wishlist ----------

export type WishLevel = 1 | 2 | 3;

export const WISH_LEVELS: { id: WishLevel; label: string; stars: string }[] = [
  { id: 3, label: "Must buy", stars: "⭐⭐⭐" },
  { id: 2, label: "Want", stars: "⭐⭐" },
  { id: 1, label: "Nice to have", stars: "⭐" },
];

/** Item type, e.g. food / clothes / cosmetics. Managed on the Wishlist page. */
export interface WishTag {
  id: string;
  label: string;
  icon: string;
}

export const DEFAULT_WISH_TAGS: WishTag[] = [
  { id: "food", label: "ของกิน", icon: "🍡" },
  { id: "clothes", label: "เสื้อผ้า", icon: "👕" },
  { id: "jewelry", label: "เครื่องประดับ", icon: "💍" },
  { id: "cosmetics", label: "เครื่องสำอางค์", icon: "💄" },
  { id: "souvenir", label: "ของฝาก", icon: "🎁" },
];

export interface WishItem {
  id: string;
  name: string;
  note: string;
  level: WishLevel;
  tags: string[]; // WishTag ids
  wantedBy: string[]; // member ids; they share the cost once bought
  activityId: string; // where to buy it; "" when not linked to an activity
  /** Who has got it, per wanter: member id → member id who paid for theirs. */
  gotBy: Record<string, string>;
  selfPaid: boolean; // everyone pays for their own (no debts)
  price: number; // per person or for everything, depending on priceType
  priceType: PriceType;
  currency: Currency;
}

export const hasGot = (w: WishItem, memberId: string) => memberId in w.gotBy;

/** Done for this profile: they got theirs, or (if they don't want it) every wanter got theirs. */
export function wishDoneFor(w: WishItem, memberId: string): boolean {
  if (w.wantedBy.includes(memberId)) return hasGot(w, memberId);
  return w.wantedBy.length > 0 && w.wantedBy.every((id) => hasGot(w, id));
}

export const EMPTY_WISH: Omit<WishItem, "id"> = {
  name: "",
  note: "",
  level: 2,
  tags: [],
  wantedBy: [],
  activityId: "",
  gotBy: {},
  selfPaid: false,
  price: 0,
  priceType: "perPerson",
  currency: "JPY",
};

/** What the group pays for a wish: per-person prices × number of people who want it. */
export function wishTotal(w: Pick<WishItem, "price" | "priceType" | "wantedBy">): number {
  return w.priceType === "perPerson" ? w.price * Math.max(1, w.wantedBy.length) : w.price;
}

export function normalizeWishTags(value: unknown): WishTag[] {
  if (!Array.isArray(value)) return DEFAULT_WISH_TAGS;
  return value.filter(
    (t): t is WishTag => typeof t?.id === "string" && t.id !== "" && typeof t.label === "string" && typeof t.icon === "string",
  );
}

export function normalizeWishlist(value: unknown): WishItem[] {
  if (!Array.isArray(value)) return [];
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return value
    .filter((w) => typeof w?.id === "string" && typeof w?.name === "string")
    .map((w) => {
      const price = Number(w.price);
      const wantedBy = strings(w.wantedBy);
      let gotBy: Record<string, string> = {};
      if (w.gotBy && typeof w.gotBy === "object" && !Array.isArray(w.gotBy)) {
        gotBy = Object.fromEntries(
          Object.entries(w.gotBy as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
        ) as Record<string, string>;
      } else if (w.got) {
        // Older saves had one shared "got" flag and a single buyer: everyone who wanted it has it.
        const payer = str(w.buyer);
        gotBy = Object.fromEntries((wantedBy.length ? wantedBy : [payer]).filter(Boolean).map((id) => [id, payer || id]));
      }
      return {
        id: w.id,
        name: w.name,
        note: str(w.note),
        level: [1, 2, 3].includes(w.level) ? w.level : 2,
        tags: strings(w.tags),
        wantedBy,
        activityId: str(w.activityId),
        gotBy,
        selfPaid: Boolean(w.selfPaid),
        price: Number.isFinite(price) && price > 0 ? price : 0,
        priceType: w.priceType === "total" ? "total" : "perPerson",
        currency: w.currency === "THB" ? "THB" : "JPY",
      } satisfies WishItem;
    });
}

/**
 * Wishlist items people have got become expenses automatically.
 * - Per person: each payer covers the people they bought for (price × people), split among those people.
 * - Total: one shared purchase once anyone has it, paid by the first payer, split among everyone who wants it.
 */
export function wishlistExpenses(data: Pick<TripData, "wishlist">): Expense[] {
  return data.wishlist.flatMap((w): Expense[] => {
    const entries = Object.entries(w.gotBy);
    if (!(w.price > 0) || entries.length === 0) return [];
    const base = { title: w.name, currency: w.currency, wishId: w.id, activityId: w.activityId || undefined };
    if (w.selfPaid) {
      const people = entries.map(([member]) => member);
      const total = w.priceType === "total";
      return [
        {
          ...base,
          id: `wish-${w.id}`,
          amount: total ? w.price : w.price * people.length,
          paidBy: "",
          splitAmong: total && w.wantedBy.length ? w.wantedBy : people,
          selfPaid: true,
        },
      ];
    }
    if (w.priceType === "total") {
      const payer = entries[0][1];
      return [{ ...base, id: `wish-${w.id}`, amount: w.price, paidBy: payer, splitAmong: w.wantedBy.length ? w.wantedBy : [payer] }];
    }
    const byPayer = new Map<string, string[]>();
    for (const [member, payer] of entries) byPayer.set(payer, [...(byPayer.get(payer) ?? []), member]);
    return [...byPayer].map(([payer, people]) => ({
      ...base,
      id: `wish-${w.id}-${payer}`,
      amount: w.price * people.length,
      paidBy: payer,
      splitAmong: people,
    }));
  });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Days in calendar order; Day 1, Day 2… are numbered by this order. */
export function sortDays(days: Day[]): Day[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

export function slotFromTime(time: string): Slot {
  const hour = Number(time.split(":")[0]);
  if (Number.isNaN(hour)) return "morning";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
}

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSafeImageSrc(src: string): boolean {
  return isSafeUrl(src) || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(src);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

/** Compact day label for tabs, e.g. "WED 09". */
export function formatDayTab(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  return `${weekday} ${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("en-US")}`;
export const baht = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;

export function toJpy(e: Pick<Expense, "amount" | "currency">, thbPerJpy: number): number {
  return e.currency === "JPY" ? e.amount : e.amount / thbPerJpy;
}

/** Every cost tied to an activity (its booking, expenses linked to it, wishes bought there), keyed by activity id. */
export function expensesByActivity(data: ExpenseSources): Map<string, Expense[]> {
  const ids = new Set(data.activities.map((a) => a.id));
  const map = new Map<string, Expense[]>();
  for (const e of allExpenses(data)) {
    if (!e.activityId || !ids.has(e.activityId)) continue;
    map.set(e.activityId, [...(map.get(e.activityId) ?? []), e]);
  }
  return map;
}

/** Sum of expenses in yen. */
export const sumJpy = (list: Expense[], thbPerJpy: number) => list.reduce((s, e) => s + toJpy(e, thbPerJpy), 0);

export interface Transfer {
  from: string;
  to: string;
  amountJpy: number;
}

/**
 * Expenses derived from activities whose booking needs payment. They live on the activity
 * (single source of truth) and are merged into the expense list, totals and settlement.
 */
export function bookingExpenses(data: Pick<TripData, "activities">): Expense[] {
  // Only the plan in use counts, so switching plans switches which payment is in the budget.
  return data.activities.flatMap((a) => {
    const place = activePlace(a);
    const { kind, payment: p } = place.booking;
    // Walk-in costs count too (paid at the door); "none" means no booking info at all.
    if (kind === "none" || !p.required || !(p.amount > 0)) return [];
    return [
      {
        id: `booking-${a.id}`,
        title: place.title,
        amount: paymentTotal(p),
        currency: p.currency,
        paidBy: p.selfPaid ? "" : p.paidBy,
        splitAmong: p.splitAmong,
        date: p.date,
        activityId: a.id,
        ...(p.selfPaid && { selfPaid: true }),
      },
    ];
  });
}

/** Manual expenses plus booking payments. */
type ExpenseSources = Pick<TripData, "activities" | "expenses" | "wishlist" | "checklist" | "flights" | "hotels">;

export function allExpenses(data: ExpenseSources): Expense[] {
  return [
    ...travelExpenses(data),
    ...bookingExpenses(data),
    ...wishlistExpenses(data),
    ...checklistExpenses(data),
    ...data.expenses,
  ];
}

/** Net balance per member in JPY: positive = should receive, negative = owes. */
/** One person's share of an expense, in the expense's currency. */
export const shareOf = (e: Expense) => (e.splitAmong.length ? e.amount / e.splitAmong.length : 0);

/** Whether a member has paid their share: the payer has by definition; others once ticked. */
export function hasPaidShare(data: Pick<TripData, "paidShares">, e: Expense, memberId: string): boolean {
  if (!e.selfPaid && memberId === e.paidBy) return true;
  return (data.paidShares[e.id] ?? []).includes(memberId);
}

/**
 * Net balance per member in yen (+ = gets money back, − = still owes).
 * Shares already paid back (ticked on the expense list) no longer count as owed.
 */
export function computeBalances(data: TripData): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const m of data.members) bal[m.id] = 0;
  for (const e of allExpenses(data)) {
    // Each person already paid their own share, so nobody owes anybody for it.
    if (e.selfPaid) continue;
    const split = e.splitAmong.filter((id) => id in bal);
    if (split.length === 0 || !(e.paidBy in bal)) continue;
    const share = toJpy(e, data.thbPerJpy) / split.length;
    for (const id of split) {
      if (hasPaidShare(data, e, id)) continue;
      bal[e.paidBy] += share;
      bal[id] -= share;
    }
  }
  return bal;
}

export function normalizePaidShares(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).filter((x): x is string => typeof x === "string")]),
  );
}

/** Greedy settlement: fewest practical transfers to zero all balances. */
export function settle(balances: Record<string, number>): Transfer[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.5)
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.5)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((a, b) => b.v - a.v);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    if (pay > 0.5) transfers.push({ from: debtors[i].id, to: creditors[j].id, amountJpy: pay });
    debtors[i].v -= pay;
    creditors[j].v -= pay;
    if (debtors[i].v <= 0.5) i++;
    if (creditors[j].v <= 0.5) j++;
  }
  return transfers;
}

// ---------- Members / profiles ----------

/** How many expenses/bookings reference a member; such members can't be removed without breaking the split. */
export function memberUsage(data: ExpenseSources, id: string): number {
  const inExpenses = allExpenses(data).filter((e) => e.paidBy === id || e.splitAmong.includes(id)).length;
  // Count references in both plans' bookings, including the plan not currently in use.
  const inBookings = data.activities
    .flatMap((a) => plansOf(a).map((p) => p.booking))
    .filter((b) => b.bookedBy === id || b.payment.paidBy === id || b.payment.splitAmong.includes(id)).length;
  const inWishlist = data.wishlist.filter(
    (w) => w.wantedBy.includes(id) || id in w.gotBy || Object.values(w.gotBy).includes(id),
  ).length;
  const inChecklist = data.checklist.filter(
    (c) => c.assignees.includes(id) || (c.cost && (c.cost.paidBy === id || c.cost.splitAmong.includes(id))),
  ).length;
  const inTravel =
    data.flights.filter((f) => f.passengers.includes(id) || f.cost?.paidBy === id).length +
    data.hotels.filter((h) => h.guests.includes(id) || h.cost?.paidBy === id).length;
  return inExpenses + inBookings + inWishlist + inChecklist + inTravel;
}

export const DEFAULT_MEMBERS: Member[] = [
  { id: "m1", name: "Pop", emoji: "🍿" },
  { id: "m2", name: "Ice", emoji: "❄️" },
  { id: "m3", name: "Bom", emoji: "💣" },
  { id: "m4", name: "Icefrozen", emoji: "🧊" },
];

// Members of the earlier sample trip, renamed to the default profiles on load.
const LEGACY_SAMPLE_NAMES: Record<string, string> = { m1: "มิ้นท์", m2: "บอส", m3: "แพร", m4: "ต้น" };

/** Rename untouched old sample members to the default profiles; leave anything the user changed alone. */
export function migrateMembers(members: Member[]): Member[] {
  const untouchedSample =
    members.length === DEFAULT_MEMBERS.length && members.every((m) => LEGACY_SAMPLE_NAMES[m.id] === m.name);
  return untouchedSample ? DEFAULT_MEMBERS : members;
}

// ---------- Sample trip ----------

const ALL = ["m1", "m2", "m3", "m4"];

export const DEFAULT_TRIP_NAME = "Tokyo with the Gang";
export const TRIP_NAME_MAX = 60;

export const SAMPLE_TRIP: TripData = {
  name: DEFAULT_TRIP_NAME,
  thbPerJpy: 0.22,
  categories: DEFAULT_CATEGORIES,
  members: DEFAULT_MEMBERS,
  days: [
    { id: "d1", date: "2026-12-12", title: "ถึงโตเกียว · Asakusa", ootd: { theme: "Winter Layering · โทนขาว-ฟ้า", images: [] } },
    { id: "d2", date: "2026-12-13", title: "Harajuku · Shibuya", ootd: { theme: "Street Style · ดำ-เทา", images: [] } },
    { id: "d3", date: "2026-12-14", title: "ขับรถเที่ยวฟูจิ · Kawaguchiko", ootd: { theme: "Cozy Outdoor · โค้ทยาว + บูท", images: [] } },
  ],
  activities: ([
    // Day 1
    { id: "a1", dayId: "d1", slot: "morning", time: "08:30", title: "Narita Express → Tokyo Station", category: "transport", note: "ซื้อตั๋ว N'EX ไป-กลับ ถูกกว่า", mapUrl: mapsSearchUrl("Narita Airport Terminal 1 Station") },
    { id: "a2", subtasks: [
      { id: "s1", title: "ประตูคามินาริมง (Kaminarimon)", note: "ถ่ายรูปกับโคมแดงยักษ์", images: [], priority: "must", done: false },
      { id: "s2", title: "เสี่ยงเซียมซี (Omikuji)", note: "100 เยน ถ้าได้ใบร้ายให้ผูกไว้ที่วัด", images: [], priority: "nice", done: false },
      { id: "s3", title: "เจดีย์ 5 ชั้น", note: "", images: [], priority: "nice", done: false },
    ], dayId: "d1", slot: "morning", time: "11:00", title: "วัดเซ็นโซจิ (Senso-ji)", category: "sightseeing", note: "ถ่ายรูปหน้าประตูคามินาริมง 🏮", mapUrl: mapsSearchUrl("Senso-ji Temple Asakusa"), guidelines: ["ล้างมือที่โชซุยะก่อนไหว้", "เสี่ยงเซียมซีโอมิคุจิ 100 เยน", "ไหว้ควันธูปที่กระถางหน้าวิหาร"] },
    { id: "a3", dayId: "d1", slot: "afternoon", time: "12:30", title: "ของกินถนนนากามิเซะ", category: "food", note: "เมนจิคัตสึ + ขนมนิงเกียวยากิ", mapUrl: mapsSearchUrl("Nakamise Shopping Street") },
    { id: "a4", dayId: "d1", slot: "afternoon", time: "15:30", title: "Tokyo Skytree", category: "photo", note: "ขึ้นจุดชมวิวตอนพระอาทิตย์ตก", mapUrl: mapsSearchUrl("Tokyo Skytree"), guidelines: ["ขึ้น Tembo Galleria ชั้น 450", "ถ่ายรูปพื้นกระจกชั้น 340"], backups: [{ title: "Tokyo Tower", note: "ถ้าคิว Skytree ยาวเกินไป", mapUrl: mapsSearchUrl("Tokyo Tower"), images: [], guidelines: ["ถ่ายรูปจากสวน Shiba Park"] }, { title: "Roppongi Hills Tokyo City View", note: "วิวเห็นทั้ง Tokyo Tower และ Skytree ในรูปเดียว", mapUrl: mapsSearchUrl("Tokyo City View Roppongi Hills"), images: [], guidelines: ["ซื้อตั๋วรวม Sky Deck ดาดฟ้าเปิดโล่ง"] }], booking: { kind: "anytime", booked: false, method: "ซื้อตั๋วออนไลน์ล่วงหน้า ถูกกว่าซื้อหน้างาน และไม่ต้องต่อคิว", url: "https://www.tokyo-skytree.jp/en/", details: "", bookedBy: "", payment: { required: true, amount: 3100, priceType: "perPerson", currency: "JPY", paidBy: "m1", splitAmong: ALL, date: "2026-12-01" } } },
    { id: "a5", dayId: "d1", slot: "evening", time: "18:30", title: "ซูชิมื้อเย็นที่ Tsukiji", category: "food", note: "", mapUrl: mapsSearchUrl("Tsukiji Outer Market") },
    { id: "a6", dayId: "d1", slot: "night", time: "20:30", title: "เดินเล่นริมแม่น้ำสุมิดะ", category: "photo", note: "วิว Skytree เปิดไฟสีฤดูหนาว ✨", mapUrl: mapsSearchUrl("Sumida Park") },
    // Day 2
    { id: "a7", dayId: "d2", slot: "morning", time: "09:00", title: "ศาลเจ้าเมจิ (Meiji Jingu)", category: "sightseeing", note: "เขียนป้ายเอมะขอพร", mapUrl: mapsSearchUrl("Meiji Jingu") },
    { id: "a8", dayId: "d2", slot: "morning", time: "11:00", title: "Takeshita Street", category: "shopping", note: "เครปสายรุ้ง 🌈", mapUrl: mapsSearchUrl("Takeshita Street Harajuku") },
    { id: "a9", dayId: "d2", slot: "afternoon", time: "13:30", title: "Harajuku Gyoza Lou", category: "food", note: "คิวยาว ไปก่อนเที่ยงครึ่ง", mapUrl: mapsSearchUrl("Harajuku Gyoza Lou"), booking: { kind: "walkin", method: "ไม่รับจอง ต่อคิวหน้าร้าน ได้บัตรคิวแล้วเดินเล่นรอได้" } },
    { id: "a10", dayId: "d2", slot: "afternoon", time: "15:00", title: "Shibuya Parco / Nintendo Tokyo", category: "shopping", note: "", mapUrl: mapsSearchUrl("Shibuya Parco") },
    { id: "a11", dayId: "d2", slot: "evening", time: "17:30", title: "Shibuya Sky", category: "photo", note: "จองตั๋วล่วงหน้า 4 สัปดาห์!", mapUrl: mapsSearchUrl("Shibuya Sky"), guidelines: ["ถ่ายรูปมุม Sky Edge ตอนพระอาทิตย์ตก", "ฝากของในล็อกเกอร์ก่อนขึ้นดาดฟ้า"], backups: [{ title: "Shibuya Scramble Crossing จาก Starbucks Tsutaya", note: "ถ้าจองตั๋วไม่ทัน / ฝนตก", mapUrl: mapsSearchUrl("Starbucks Shibuya Tsutaya"), images: [], guidelines: [] }], booking: { kind: "window", windowAmount: 28, windowUnit: "days", booked: true, method: "จองบนเว็บ Shibuya Sky เปิดขายล่วงหน้า 4 สัปดาห์ เลือกรอบก่อนพระอาทิตย์ตก", url: "https://www.shibuya-scramble-square.com/sky/", details: "รอบ 17:20 · 3 คน · เลขยืนยัน SKY-482913 (QR อยู่ในอีเมลแพร)", bookedBy: "m3", payment: { required: true, amount: 2500, priceType: "perPerson", currency: "JPY", paidBy: "m3", splitAmong: ["m1", "m2", "m3"], date: "2026-11-15" } } },
    { id: "a12", dayId: "d2", slot: "night", time: "20:00", title: "อิซากายะ Nonbei Yokocho", category: "food", note: "ยากิโทริ + ไฮบอล 🍻", mapUrl: mapsSearchUrl("Nonbei Yokocho Shibuya") },
    // Day 3
    { id: "a13", dayId: "d3", slot: "morning", time: "07:30", title: "รับรถเช่า → ขับไป Kawaguchiko", category: "transport", note: "ใช้ใบขับขี่สากล + ETC card", mapUrl: mapsSearchUrl("Toyota Rent a Car Shinjuku") },
    { id: "a14", dayId: "d3", slot: "morning", time: "10:30", title: "Chureito Pagoda", category: "photo", note: "บันได 398 ขั้น วิวฟูจิ 🗻", mapUrl: mapsSearchUrl("Chureito Pagoda"), guidelines: ["ถ่ายรูปเจดีย์ห้าชั้นคู่ฟูจิจากจุดชมวิวด้านบน", "มาก่อน 9 โมง คนน้อยและฟ้าใส"], backups: [{ title: "Kawaguchiko Music Forest", note: "ถ้าเมฆบังฟูจิ", mapUrl: mapsSearchUrl("Kawaguchiko Music Forest Museum"), images: [], guidelines: [] }] },
    { id: "a15", dayId: "d3", slot: "afternoon", time: "13:00", title: "Hoto Fudou", category: "food", note: "อุด้งหม้อร้อน เหมาะกับหน้าหนาว", mapUrl: mapsSearchUrl("Hoto Fudou Kawaguchiko") },
    { id: "a16", dayId: "d3", slot: "afternoon", time: "15:00", title: "Oishi Park", category: "sightseeing", note: "", mapUrl: mapsSearchUrl("Oishi Park Fujikawaguchiko") },
    { id: "a17", dayId: "d3", slot: "evening", time: "18:00", title: "ขับรถกลับโตเกียว + คืนรถ", category: "transport", note: "", mapUrl: "" },
    { id: "a18", dayId: "d3", slot: "night", time: "21:00", title: "Don Quijote Shinjuku", category: "shopping", note: "ช้อปของฝาก tax-free", mapUrl: mapsSearchUrl("Don Quijote Shinjuku") },
  ] satisfies Parameters<typeof normalizeActivity>[0][]).map(normalizeActivity),
  expenses: [
    { id: "e2", title: "Narita Express x4", amount: 12280, currency: "JPY", paidBy: "m2", splitAmong: ALL },
    { id: "e3", title: "eSIM 4 คน", amount: 1200, currency: "THB", paidBy: "m3", splitAmong: ALL },
    { id: "e4", title: "ซูชิ Tsukiji", amount: 18400, currency: "JPY", paidBy: "m2", splitAmong: ALL },
    { id: "e6", title: "เช่ารถ + น้ำมัน + ทางด่วน", amount: 28000, currency: "JPY", paidBy: "m4", splitAmong: ALL },
  ],
  wishTags: DEFAULT_WISH_TAGS,
  flights: [
    {
      id: "f1", direction: "outbound", airline: "TG", airlineName: "Thai Airways", flightNo: "TG 676",
      from: "BKK", to: "NRT", departDate: "2026-12-11", departTime: "23:55", arriveDate: "2026-12-12", arriveTime: "07:50",
      returnLeg: { flightNo: "TG 677", from: "NRT", to: "BKK", departDate: "2026-12-15", departTime: "10:30", arriveDate: "2026-12-15", arriveTime: "15:30" },
      bookingRef: "", booked: true, note: "โหลดกระเป๋า 30 kg", passengers: ALL, packageHotelIds: [],
      cost: { amount: 22400, priceType: "perPerson", currency: "THB", selfPaid: true, paidBy: "" },
    },
  ],
  hotels: [
    {
      id: "h1", name: "Airbnb Asakusa", address: "Asakusa, Taito City, Tokyo", mapUrl: "", url: "",
      checkIn: "2026-12-12", checkOut: "2026-12-15", checkInTime: "15:00", checkOutTime: "10:00",
      bookingRef: "", booked: true, note: "ฝากกระเป๋าก่อนเช็กอินได้", guests: ALL,
      cost: { amount: 32000, priceType: "perNight", currency: "JPY", selfPaid: false, paidBy: "m1" },
    },
  ],
  paidShares: { "booking-a11": ["m1"] }, // Pop already paid Bom back for Shibuya Sky
  wishlist: [
    { ...EMPTY_WISH, id: "w1", name: "Tokyo Banana", level: 3, tags: ["food", "souvenir"], wantedBy: ALL, note: "ซื้อที่สนามบินขากลับได้" },
    { ...EMPTY_WISH, id: "w2", name: "KitKat รสมัทฉะ", level: 2, tags: ["food", "souvenir"], wantedBy: ["m1", "m3"], activityId: "a18" },
    { ...EMPTY_WISH, id: "w3", name: "กันแดด Anessa", level: 3, tags: ["cosmetics"], wantedBy: ["m1", "m3"], activityId: "a18", gotBy: { m1: "m3", m3: "m3" }, price: 2480 },
    { ...EMPTY_WISH, id: "w4", name: "Heattech Ultra Warm", level: 2, tags: ["clothes"], wantedBy: ["m2", "m4"], note: "ไซส์ L ทั้งคู่" },
    { ...EMPTY_WISH, id: "w5", name: "ต่างหูจาก Takeshita", level: 1, tags: ["jewelry"], wantedBy: ["m1"], activityId: "a8" },
  ],
  checklist: normalizeChecklist(
    [
      { id: "c1", label: "🛂 Passport (อายุเหลือ > 6 เดือน)", doneBy: ["m1", "m2", "m3", "m4"] },
      { id: "c2", label: "🎫 JR Pass / บัตร Suica", note: "ซื้อ Suica ใน Apple Wallet ได้", doneBy: ["m2"] },
      { id: "c3", label: "📶 eSIM ญี่ปุ่น", doneBy: ["m1", "m2", "m3", "m4"] },
      { id: "c4", label: "🔌 ปลั๊กแปลง Type A", assignees: ["m2", "m3"], doneBy: ["m2", "m3"] },
      { id: "c5", label: "🪪 ใบขับขี่สากล (IDP)", doneBy: [] },
      { id: "c6", label: "📱 QR Visit Japan Web", doneBy: [] },
      { id: "c7", label: "🧥 เสื้อกันหนาว + ฮีทเทค + ถุงมือ", doneBy: [] },
      { id: "c8", label: "💴 เงินเยนสด", doneBy: ["m1", "m2", "m3", "m4"] },
      { id: "c9", label: "🔋 Power bank", doneBy: [] },
      { id: "c10", label: "🩹 ประกันการเดินทาง", doneBy: ["m1", "m2", "m3", "m4"] },
      {
        id: "c11",
        label: "📷 เช่ากล้อง Fuji X100V",
        note: "รับที่ร้านวันก่อนบิน 1 วัน คืนภายใน 3 วันหลังกลับ",
        assignees: ["m1"],
        doneBy: [],
        cost: { amount: 3600, currency: "THB", splitAmong: ALL, paidBy: "m1", deposit: 1000, fullyPaid: false },
      },
    ],
    DEFAULT_MEMBERS,
  ),
};
