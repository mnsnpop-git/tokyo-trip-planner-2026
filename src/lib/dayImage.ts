import {
  activePlace,
  findCategory,
  flightLegs,
  formatDayLabel,
  hotelNights,
  needsBooking,
  staysOn,
  type Activity,
  type Category,
  type Day,
  type Flight,
  type Hotel,
} from "./trip";

/*
 * Draws one day of the trip as a PNG to share (e.g. to a LINE group).
 * Drawn straight onto a canvas, so it needs no extra library and no outside images
 * (outside images such as airline logos would block exporting the canvas).
 * Always the light palette: the picture is read in a chat, not in the app's theme.
 */

const C = {
  bg: "#ffffff",
  surface: "#f4f6f8",
  line: "#e3e7ec",
  ink: "#111418",
  soft: "#6b7280",
  baby: "#dff1fc",
  babyInk: "#1d6fa5",
  alt: "#f1f3f5",
  altInk: "#4b5563",
  pending: "#fdeceb",
  pendingInk: "#c2413b",
  visited: "#e4f5e8",
  visitedInk: "#2f8a4c",
};

const W = 540; // drawing width in CSS px; exported at 2× for sharp text
const SCALE = 2;
const PAD = 24;

export interface DayImageInput {
  tripName: string;
  day: Day;
  dayNumber: number;
  activities: Activity[]; // this day's, in order
  categories: Category[];
  flights: Flight[];
  hotels: Hotel[];
}

/** The app's font (Prompt via next/font) with emoji fallbacks for the category icons. */
function fontStack() {
  const body = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "";
  return `${body || "sans-serif"}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
}

/** Splits text into lines that fit `max` px; Thai has no spaces, so it breaks between words. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines = 3): string[] {
  const words =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map((s) => s.segment)
      : text.split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur + w;
    if (ctx.measureText(next).width <= max || !cur) {
      cur = next;
      continue;
    }
    lines.push(cur.trimEnd());
    cur = w.trimStart();
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur.trimEnd());
  else if (lines.length === maxLines && cur) {
    // Out of room: end the last line with "…".
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** A small rounded badge; returns its width. */
function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, font: string) {
  ctx.font = `500 11px ${font}`;
  const w = ctx.measureText(text).width + 14;
  roundRect(ctx, x, y, w, 19, 9.5, bg);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 7, y + 10);
  ctx.textBaseline = "alphabetic";
  return w;
}

/** The flights and hotel lines for that date, as in the day card's travel strip. */
function travelLines(date: string, flights: Flight[], hotels: Hotel[]) {
  const lines: { text: string; bg: string }[] = [];
  flights
    .flatMap((f) => flightLegs(f).map(({ leg }) => ({ f, leg })))
    .filter(({ leg }) => leg.departDate === date || leg.arriveDate === date)
    .sort((a, b) => (a.leg.departTime || "").localeCompare(b.leg.departTime || ""))
    .forEach(({ f, leg }) =>
      lines.push({
        text: `✈️ ${leg.flightNo || f.airlineName}  ${leg.from} ${leg.departTime} → ${leg.to} ${leg.arriveTime}`,
        bg: C.baby,
      }),
    );
  for (const h of hotels.filter((x) => staysOn(x, date))) {
    const night = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${h.checkIn}T00:00:00Z`)) / 86_400_000) + 1;
    const checkIn = h.checkIn === date && h.checkInTime ? ` · เช็กอิน ${h.checkInTime}` : "";
    lines.push({ text: `🏨 พักที่ ${h.name}${checkIn} · คืนที่ ${night}/${hotelNights(h)}`, bg: C.alt });
  }
  for (const h of hotels.filter((x) => x.checkOut === date && !staysOn(x, date))) {
    lines.push({ text: `🧳 เช็กเอาต์ ${h.name}${h.checkOutTime ? ` · ${h.checkOutTime}` : ""}`, bg: C.surface });
  }
  return lines;
}

/** Draws the day; with `ctx` null it only measures and returns the height needed. */
function draw(ctx: CanvasRenderingContext2D, input: DayImageInput, font: string): number {
  const { tripName, day, dayNumber, activities, categories, flights, hotels } = input;
  const inner = W - PAD * 2;
  let y = PAD;

  // Header: trip name, DAY n pill + date, day title.
  ctx.font = `600 12px ${font}`;
  ctx.fillStyle = C.babyInk;
  ctx.fillText(tripName.toUpperCase(), PAD, y + 12);
  y += 24;

  ctx.font = `600 12px ${font}`;
  const dayTag = `DAY ${dayNumber}`;
  const tagW = ctx.measureText(dayTag).width + 20;
  roundRect(ctx, PAD, y, tagW, 24, 12, C.ink);
  ctx.fillStyle = C.bg;
  ctx.textBaseline = "middle";
  ctx.fillText(dayTag, PAD + 10, y + 12.5);
  ctx.font = `500 13px ${font}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(formatDayLabel(day.date), PAD + tagW + 10, y + 12.5);
  ctx.textBaseline = "alphabetic";
  y += 34;

  if (day.title) {
    ctx.font = `700 22px ${font}`;
    ctx.fillStyle = C.ink;
    for (const l of wrap(ctx, day.title, inner, 2)) {
      ctx.fillText(l, PAD, y + 22);
      y += 30;
    }
  }
  y += 8;

  // Flights / hotel.
  ctx.font = `400 12px ${font}`;
  for (const t of travelLines(day.date, flights, hotels)) {
    const [line] = wrap(ctx, t.text, inner - 20, 1);
    roundRect(ctx, PAD, y, inner, 28, 10, t.bg);
    ctx.font = `400 12px ${font}`;
    ctx.fillStyle = C.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(line, PAD + 10, y + 14.5);
    ctx.textBaseline = "alphabetic";
    y += 34;
  }
  if (y > PAD + 100) y += 4;

  // Activities: time · icon · title, then a short line of details.
  if (activities.length === 0) {
    ctx.font = `400 14px ${font}`;
    ctx.fillStyle = C.soft;
    ctx.fillText("ยังไม่มีกิจกรรม", PAD, y + 20);
    y += 36;
  }
  activities.forEach((a, i) => {
    const place = activePlace(a);
    const cat = findCategory(categories, a.category);
    if (i > 0) {
      ctx.fillStyle = C.line;
      ctx.fillRect(PAD, y, inner, 1);
    }
    y += 12;
    const textX = PAD + 76;
    const textW = inner - 76;

    ctx.font = `600 14px ${font}`;
    ctx.fillStyle = a.visited ? C.soft : C.babyInk;
    ctx.fillText(a.time || "--:--", PAD, y + 17);
    ctx.font = `400 16px ${font}`;
    ctx.fillText(cat.icon, PAD + 48, y + 18);

    ctx.font = `600 15px ${font}`;
    ctx.fillStyle = a.visited ? C.soft : C.ink;
    const titleLines = wrap(ctx, place.title || "(ไม่มีชื่อ)", textW, 2);
    titleLines.forEach((l, j) => ctx.fillText(l, textX, y + 17 + j * 22));
    y += 22 * titleLines.length;

    // Badges: category, backup plan in use, still to book, visited.
    let x = textX;
    const badges: [string, string, string][] = [[cat.label, C.surface, C.soft]];
    if (a.planIndex > 0) badges.push(["แผนสำรอง", C.alt, C.altInk]);
    if (needsBooking(a)) badges.push(["ยังไม่จอง", C.pending, C.pendingInk]);
    if (a.visited) badges.push(["ไปแล้ว", C.visited, C.visitedInk]);
    for (const [t, bg, fg] of badges) x += pill(ctx, t, x, y + 2, bg, fg, font) + 6;
    y += 26;

    if (place.note) {
      ctx.font = `400 12px ${font}`;
      ctx.fillStyle = C.soft;
      for (const l of wrap(ctx, place.note.replace(/\s+/g, " "), textW, 2)) {
        ctx.fillText(l, textX, y + 13);
        y += 18;
      }
    }
    y += 8;
  });

  // Footer.
  y += 8;
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y, inner, 1);
  y += 22;
  ctx.font = `400 11px ${font}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(`${activities.length} กิจกรรม`, PAD, y);
  const brand = "Tokyo Trip Planner";
  ctx.fillText(brand, W - PAD - ctx.measureText(brand).width, y);
  return y + PAD - 4;
}

/** Renders the day to a PNG blob. */
export async function renderDayImage(input: DayImageInput): Promise<Blob> {
  await document.fonts?.ready;
  const font = fontStack();
  // First pass on a scratch canvas to find the height, then draw for real.
  const scratch = document.createElement("canvas").getContext("2d")!;
  const height = Math.ceil(draw(scratch, input, font));

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, height);
  draw(ctx, input, font);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
