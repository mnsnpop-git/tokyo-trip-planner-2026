"use client";

import { useEffect, useState } from "react";
import {
  BOOKING_KINDS,
  baht,
  bookingOpensAt,
  formatDate,
  isSafeUrl,
  paymentTotal,
  requiresBooking,
  yen,
  type Booking,
  type BookingPayment,
  type Currency,
  type Member,
  type WindowUnit,
} from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { ImagePicker } from "./Images";
import { PayerField } from "./PayerField";

type BookingUpdate = (update: (b: Booking) => Booking) => void;

// ---------- helpers ----------

export const money = (amount: number, currency: Currency) => (currency === "JPY" ? yen(amount) : baht(amount));

function memberName(members: Member[], id: string) {
  const m = members.find((x) => x.id === id);
  return m ? `${m.emoji} ${m.name}` : "";
}

/** e.g. "ศ. 13 พ.ย. 17:30" */
export function formatDateTime(d: Date): string {
  const date = d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** e.g. "อีก 3 วัน", "อีก 5 ชม.", "อีก 20 นาที" */
export function formatCountdown(ms: number): string {
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `อีก ${min} นาที`;
  const h = Math.ceil(min / 60);
  if (h < 48) return `อีก ${h} ชม.`;
  return `อีก ${Math.ceil(h / 24)} วัน`;
}

/** Current time that refreshes every minute, so "opens in…" countdowns stay current. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "¥2,500/คน × 3 = ¥7,500" or "รวม ¥7,500 · คนละ ¥2,500" */
export function paymentSummary(p: BookingPayment): string {
  const total = paymentTotal(p);
  const n = p.splitAmong.length;
  if (p.priceType === "perPerson") return `${money(p.amount, p.currency)}/คน × ${n} = ${money(total, p.currency)}`;
  return n > 0 ? `รวม ${money(total, p.currency)} · คนละ ${money(total / n, p.currency)}` : `รวม ${money(total, p.currency)}`;
}

/** "ก่อนไป 28 วัน" */
const windowText = (b: Booking) => `ก่อนไป ${b.windowAmount} ${b.windowUnit === "hours" ? "ชม." : "วัน"}`;

const kindLabel = (b: Booking) => BOOKING_KINDS.find((k) => k.id === b.kind)!;

/** Returns an error message, or "" if the booking can be saved. */
export function validateBooking(b: Booking, members: Member[]): string {
  if (b.kind === "none") return "";
  if (b.kind === "window" && !(b.windowAmount > 0)) return "ใส่จำนวนชั่วโมง/วันที่เปิดจอง";
  if (b.url.trim() && !isSafeUrl(b.url.trim())) return "ลิงก์จองต้องขึ้นต้นด้วย https://";
  const p = b.payment;
  if (!p.required) return "";
  if (!(p.amount > 0)) return "ใส่ค่าจอง (มากกว่า 0)";
  if (!p.selfPaid && !members.some((m) => m.id === p.paidBy)) return "เลือกคนที่จ่ายแทนก่อน";
  if (!p.splitAmong.some((id) => members.some((m) => m.id === id))) return "เลือกคนหารอย่างน้อย 1 คน";
  return "";
}

export function cleanBooking(b: Booking): Booking {
  return { ...b, url: b.url.trim(), method: b.method.trim(), details: b.details.trim() };
}

// ---------- Form section ----------

export function BookingFields({
  idPrefix,
  booking: b,
  members,
  currentMemberId,
  start,
  onUpdate,
}: {
  /** Keeps input ids unique when the main and backup plans both show booking fields. */
  idPrefix: string;
  booking: Booking;
  members: Member[];
  currentMemberId: string;
  /** When the activity starts; used to show when a booking window opens. */
  start: Date | null;
  onUpdate: BookingUpdate;
}) {
  const setB = <K extends keyof Booking>(k: K, v: Booking[K]) => onUpdate((x) => ({ ...x, [k]: v }));
  const setP = <K extends keyof BookingPayment>(k: K, v: BookingPayment[K]) =>
    onUpdate((x) => ({ ...x, payment: { ...x.payment, [k]: v } }));
  const id = (name: string) => `${idPrefix}-booking-${name}`;
  const fallbackMember = members.some((m) => m.id === currentMemberId) ? currentMemberId : (members[0]?.id ?? "");
  const opensAt = bookingOpensAt(b, start);
  const p = b.payment;
  const isWalkin = b.kind === "walkin";

  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-white/60 p-3">
      <legend className="px-1 text-sm font-semibold">การจอง</legend>

      <div>
        <span className={labelClass}>แบบการจอง</span>
        <div role="radiogroup" aria-label="แบบการจอง" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {BOOKING_KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              role="radio"
              aria-checked={b.kind === k.id}
              onClick={() => setB("kind", k.id)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                b.kind === k.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:bg-surface"
              }`}
            >
              {k.icon !== "—" && <span className="mr-1">{k.icon}</span>}
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {b.kind === "window" && (
        <div>
          <span className={labelClass}>เปิดจองล่วงหน้า</span>
          <div className="flex items-center gap-2 text-sm">
            <input
              aria-label="จำนวน"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className={`${inputClass} w-24`}
              value={b.windowAmount || ""}
              onChange={(e) => setB("windowAmount", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              placeholder="28"
            />
            <select
              aria-label="หน่วย"
              className={`${inputClass} w-28`}
              value={b.windowUnit}
              onChange={(e) => setB("windowUnit", e.target.value as WindowUnit)}
            >
              <option value="hours">ชั่วโมง</option>
              <option value="days">วัน</option>
            </select>
            <span className="text-ink-soft">ก่อนไป</span>
          </div>
          {opensAt && <p className="mt-1 text-[11px] text-ink-soft">→ เปิดจอง {formatDateTime(opensAt)}</p>}
        </div>
      )}

      {b.kind !== "none" && (
        <>
          {requiresBooking(b) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className={labelClass}>สถานะ</span>
                <div role="radiogroup" aria-label="สถานะการจอง" className="flex overflow-hidden rounded-xl border border-line">
                  {[false, true].map((booked) => (
                    <button
                      type="button"
                      key={String(booked)}
                      role="radio"
                      aria-checked={b.booked === booked}
                      onClick={() =>
                        onUpdate((x) => ({ ...x, booked, bookedBy: booked && !x.bookedBy ? fallbackMember : x.bookedBy }))
                      }
                      className={`flex-1 px-3 py-2 text-sm font-medium transition ${
                        b.booked === booked
                          ? booked
                            ? "bg-done text-done-ink"
                            : "bg-pending text-pending-ink"
                          : "bg-white text-ink-soft"
                      }`}
                    >
                      {booked ? "จองแล้ว" : "ยังไม่จอง"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor={id("by")}>คนจอง</label>
                <select id={id("by")} className={inputClass} value={b.bookedBy} onChange={(e) => setB("bookedBy", e.target.value)}>
                  <option value="">— ไม่ระบุ —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor={id("method")}>{isWalkin ? "วิธีต่อคิว" : "วิธีจอง"}</label>
            <textarea
              id={id("method")}
              rows={2}
              className={inputClass}
              value={b.method}
              onChange={(e) => setB("method", e.target.value)}
              placeholder={isWalkin ? "เช่น รับบัตรคิว 10:30 แล้วเดินเล่นรอได้" : "เช่น จองเว็บ, โทรจอง, Klook"}
            />
          </div>

          {!isWalkin && (
            <div>
              <label className={labelClass} htmlFor={id("url")}>ลิงก์จอง</label>
              <input
                id={id("url")}
                type="url"
                inputMode="url"
                className={inputClass}
                value={b.url}
                onChange={(e) => setB("url", e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor={id("details")}>รายละเอียด</label>
            <textarea
              id={id("details")}
              rows={2}
              className={inputClass}
              value={b.details}
              onChange={(e) => setB("details", e.target.value)}
              placeholder="เลขยืนยัน, รอบเวลา, จำนวนคน, QR อยู่กับใคร…"
            />
          </div>

          <ImagePicker
            idPrefix={`${idPrefix}-booking`}
            label="รูปการจอง (ยืนยัน, QR, ตั๋ว)"
            images={b.images}
            onUpdate={(update) => onUpdate((x) => ({ ...x, images: update(x.images) }))}
          />

          <div className="space-y-3 rounded-xl bg-surface/60 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.required}
                onChange={(e) => {
                  const required = e.target.checked;
                  onUpdate((x) => ({
                    ...x,
                    payment: {
                      ...x.payment,
                      required,
                      // Sensible defaults the first time payment is switched on.
                      paidBy: x.payment.paidBy || x.bookedBy || fallbackMember,
                      splitAmong: x.payment.splitAmong.length ? x.payment.splitAmong : members.map((m) => m.id),
                    },
                  }));
                }}
                className="h-4 w-4"
              />
              มีค่าจอง (เข้า Budget อัตโนมัติ)
            </label>

            {p.required && (
              <>
                <div>
                  <span className={labelClass}>ราคา</span>
                  <div role="radiogroup" aria-label="แบบราคา" className="flex overflow-hidden rounded-xl border border-line text-sm">
                    {(
                      [
                        ["perPerson", "ต่อคน"],
                        ["total", "รวม (ยังไม่หาร)"],
                      ] as const
                    ).map(([t, label]) => (
                      <button
                        type="button"
                        key={t}
                        role="radio"
                        aria-checked={p.priceType === t}
                        onClick={() => setP("priceType", t)}
                        className={`flex-1 px-3 py-2 font-medium transition ${
                          p.priceType === t ? "bg-ink text-white" : "bg-white text-ink-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelClass} htmlFor={id("amount")}>
                      {p.priceType === "perPerson" ? "ราคาต่อคน" : "ราคารวม"}
                    </label>
                    <input
                      id={id("amount")}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className={inputClass}
                      value={p.amount || ""}
                      onChange={(e) => setP("amount", Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <span className={labelClass}>สกุลเงิน</span>
                    <div className="flex overflow-hidden rounded-xl border border-line">
                      {(["JPY", "THB"] as Currency[]).map((c) => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setP("currency", c)}
                          aria-pressed={p.currency === c}
                          className={`px-3 py-2 text-sm font-medium ${p.currency === c ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
                        >
                          {c === "JPY" ? "¥" : "฿"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <PayerField
                  id={id("payer")}
                  selfPaid={p.selfPaid}
                  paidBy={p.paidBy}
                  members={members}
                  onSelfPaid={(v) => setP("selfPaid", v)}
                  onPaidBy={(v) => setP("paidBy", v)}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={id("date")}>วันจ่าย</label>
                    <input
                      id={id("date")}
                      type="date"
                      className={inputClass}
                      value={p.date}
                      onChange={(e) => setP("date", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span className={labelClass}>{p.priceType === "perPerson" ? "คนไป (ราคา × จำนวนคน)" : "หารกับ"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const on = p.splitAmong.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          aria-pressed={on}
                          onClick={() => setP("splitAmong", on ? p.splitAmong.filter((x) => x !== m.id) : [...p.splitAmong, m.id])}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            on ? "bg-baby text-baby-ink" : "bg-white text-ink-soft line-through"
                          }`}
                        >
                          {m.emoji} {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {p.amount > 0 && p.splitAmong.length > 0 && (
                  <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium">= {paymentSummary(p)}</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}

// ---------- Card display ----------

/** One short status line for a plan's booking, e.g. "ยังไม่จอง" or "เปิดจองอีก 8 วัน". */
export function bookingStatus(b: Booking, start: Date | null, now: number, members: Member[]): { text: string; cls: string } {
  if (b.kind === "walkin") return { text: "Walk-in", cls: "bg-white text-ink-soft" };
  if (b.booked) {
    const by = members.find((m) => m.id === b.bookedBy);
    return { text: `จองแล้ว${by ? ` · ${by.emoji}` : ""}`, cls: "bg-done/70 text-done-ink" };
  }
  const opensAt = bookingOpensAt(b, start);
  if (opensAt && opensAt.getTime() > now)
    return { text: `เปิดจอง${formatCountdown(opensAt.getTime() - now)}`, cls: "border border-dashed border-ink-soft/60 bg-white text-ink-soft" };
  return { text: "ยังไม่จอง", cls: "bg-pending text-pending-ink" };
}

/** Compact one-line booking status on an activity card; tap it for details and to mark booked. */
export function BookingInfo({
  title,
  booking: b,
  members,
  start,
  onToggleBooked,
}: {
  title: string;
  booking: Booking;
  members: Member[];
  start: Date | null;
  /** Omitted for guests (view only). */
  onToggleBooked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  if (b.kind === "none") return null;
  const st = bookingStatus(b, start, now, members);
  const p = b.payment;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`ดูการจอง ${title}`}
        className={`mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition hover:brightness-95 ${st.cls}`}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{st.text}</span>
        {p.required && p.amount > 0 && <span className="shrink-0 opacity-80">{money(paymentTotal(p), p.currency)}</span>}
        <span aria-hidden className="shrink-0 text-sm leading-none opacity-60">›</span>
      </button>
      {open && (
        <BookingModal
          title={title}
          booking={b}
          members={members}
          start={start}
          onToggleBooked={onToggleBooked}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{children}</dd>
    </>
  );
}

const dash = <span className="text-ink-soft">—</span>;

/** Full booking details. Images open large inside the same pop-up (no stacked modals). */
export function BookingModal({
  title,
  booking: b,
  members,
  start,
  onToggleBooked,
  onClose,
}: {
  title: string;
  booking: Booking;
  members: Member[];
  start: Date | null;
  /** Shown as a button in the pop-up when given. */
  onToggleBooked?: () => void;
  onClose: () => void;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const now = useNow();
  const p = b.payment;
  const by = memberName(members, b.bookedBy);
  const payer = memberName(members, p.paidBy);
  const split = p.splitAmong.map((id) => memberName(members, id)).filter(Boolean);
  const hasUrl = b.url && isSafeUrl(b.url);
  const opensAt = bookingOpensAt(b, start);
  const n = b.images.length;
  const kind = kindLabel(b);

  if (viewing !== null && b.images[viewing]) {
    const go = (d: number) => setViewing((viewing + d + n) % n);
    return (
      <Modal title={`${title} · รูป ${viewing + 1}/${n}`} onClose={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.images[viewing]} alt={`รูปการจอง ${viewing + 1}`} className="max-h-[60dvh] w-full rounded-2xl bg-[#fff] object-contain" />
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <button onClick={() => setViewing(null)} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-surface">
            ← กลับ
          </button>
          {n > 1 && (
            <span className="flex gap-2">
              <button onClick={() => go(-1)} aria-label="รูปก่อนหน้า" className="rounded-full bg-surface px-3 py-1.5 hover:bg-baby">←</button>
              <button onClick={() => go(1)} aria-label="รูปถัดไป" className="rounded-full bg-surface px-3 py-1.5 hover:bg-baby">→</button>
            </span>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`การจอง · ${title}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface px-3 py-1 font-medium">
            {kind.icon} {kind.label}
          </span>
          {requiresBooking(b) &&
            (b.booked ? (
              <span className="rounded-full bg-done px-3 py-1 font-medium text-done-ink">จองแล้ว</span>
            ) : (
              <span className="rounded-full bg-pending px-3 py-1 font-medium text-pending-ink">ยังไม่จอง</span>
            ))}
          {by && requiresBooking(b) && b.booked && <span className="text-ink-soft">โดย {by}</span>}
          {onToggleBooked && requiresBooking(b) && (
            <button
              onClick={onToggleBooked}
              className="ml-auto rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              {b.booked ? "↩︎ เปลี่ยนเป็นยังไม่จอง" : "✓ จองแล้ว"}
            </button>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {b.kind === "window" && (
            <Row label="เปิดจอง">
              {windowText(b)}
              {opensAt && (
                <span className="block text-xs text-ink-soft">
                  {formatDateTime(opensAt)}
                  {opensAt.getTime() > now ? ` · ${formatCountdown(opensAt.getTime() - now)}` : " · เปิดแล้ว"}
                </span>
              )}
            </Row>
          )}
          <Row label={b.kind === "walkin" ? "วิธีต่อคิว" : "วิธีจอง"}>{b.method || dash}</Row>
          {b.kind !== "walkin" && (
            <Row label="ลิงก์จอง">
              {hasUrl ? (
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="break-all text-baby-ink underline-offset-2 hover:underline">
                  🔗 {b.url}
                </a>
              ) : (
                dash
              )}
            </Row>
          )}
          <Row label="รายละเอียด">{b.details || dash}</Row>
          <Row label="ค่าจอง">
            {p.required && p.amount > 0 ? (
              <>
                {paymentSummary(p)}
                <span className="block text-xs text-ink-soft">
                  {p.selfPaid ? "จ่ายกันเอง" : `${payer || "ไม่ระบุ"} จ่ายแทนก่อน`}
                  {p.date && ` · ${formatDate(p.date)}`}
                </span>
                {split.length > 0 && <span className="block text-xs text-ink-soft">{split.join(", ")}</span>}
              </>
            ) : (
              <span className="text-ink-soft">ไม่มี</span>
            )}
          </Row>
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">รูปการจอง ({n})</p>
          {n === 0 ? (
            <p className="text-xs text-ink-soft">ยังไม่มีรูป — เพิ่มได้ที่ไอคอนดินสอ</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {b.images.map((src, i) => (
                <button
                  key={`${i}-${src.slice(-16)}`}
                  onClick={() => setViewing(i)}
                  aria-label={`ดูรูปการจอง ${i + 1}`}
                  className="overflow-hidden rounded-xl border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" className="aspect-square w-full bg-[#fff] object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
