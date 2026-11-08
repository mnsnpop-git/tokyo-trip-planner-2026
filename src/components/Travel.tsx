"use client";

import { useState } from "react";
import {
  AIRLINES,
  EMPTY_TRAVEL_COST,
  FLIGHT_DIRECTIONS,
  airlineLogoUrl,
  baht,
  formatDate,
  hotelNights,
  isSafeUrl,
  mapsSearchUrl,
  flightLegs,
  packagedHotels,
  staysOn,
  travelTotal,
  uid,
  yen,
  type Currency,
  type Flight,
  type FlightLeg,
  type Hotel,
  type Member,
  type TravelCost,
  type TravelPriceType,
  type TripData,
} from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { PayerField } from "./PayerField";
import { DeleteButton, IconButton } from "./Icons";

const money = (n: number, c: Currency) => (c === "JPY" ? yen(n) : baht(n));

/** Airport label: big for a short code, smaller for a typed-in name. */
function AirportName({ value }: { value: string }) {
  const short = value.length <= 4;
  return (
    <p className={`max-w-[8rem] break-words font-bold leading-tight ${short ? "text-lg" : "text-sm"}`}>{value || "—"}</p>
  );
}

/** Airline logo by IATA code; shows the code in a badge if the image can't load. */
export function AirlineLogo({ code, name, size = "md" }: { code: string; name: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = size === "sm" ? "h-6 w-12" : "h-9 w-[4.5rem]";
  if (!code || failed === code) {
    return (
      <span
        aria-label={name || code || "สายการบิน"}
        className={`${box} flex shrink-0 items-center justify-center rounded-lg bg-baby text-xs font-bold text-baby-ink`}
      >
        {code || "✈️"}
      </span>
    );
  }
  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-line`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={airlineLogoUrl(code)}
        alt={name || code}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(code)}
        className="max-h-full max-w-full object-contain p-0.5"
      />
    </span>
  );
}

function costLine(c: TravelCost, people: number, nights: number): string {
  const total = travelTotal(c, people, nights);
  if (c.priceType === "perPerson") return `${money(c.amount, c.currency)}/คน × ${people} = ${money(total, c.currency)}`;
  if (c.priceType === "perNight") return `${money(c.amount, c.currency)}/คืน × ${nights} = ${money(total, c.currency)}`;
  return `รวม ${money(total, c.currency)}${people > 1 ? ` · คนละ ${money(total / people, c.currency)}` : ""}`;
}

function BookedBadge({ booked }: { booked: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${booked ? "bg-done text-done-ink" : "bg-alert text-alert-ink"}`}
    >
      {booked ? "✅ จองแล้ว" : "⏳ ยังไม่จอง"}
    </span>
  );
}

/** One leg as a boarding-pass style row: date, airports and times. */
function LegRoute({ leg, label }: { leg: FlightLeg; label: string }) {
  const nextDay = leg.arriveDate && leg.departDate && leg.arriveDate > leg.departDate;
  return (
    <div className="mt-2 rounded-xl bg-white px-3 py-2">
      <p className="mb-1 flex gap-2 text-[11px] text-ink-soft">
        {label && <span className="font-semibold text-ink">{label}</span>}
        <span>{leg.flightNo}</span>
        <span className="ml-auto">📅 {leg.departDate ? formatDate(leg.departDate) : "ยังไม่ระบุวัน"}</span>
      </p>
      <div className="flex items-center gap-2">
        <div className="min-w-0 text-center">
          <AirportName value={leg.from} />
          <p className="mt-0.5 font-mono text-xs">{leg.departTime || "--:--"}</p>
        </div>
        <div className="flex min-w-6 flex-1 items-center gap-1 text-ink-soft" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="text-sm">✈</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="min-w-0 text-center">
          <AirportName value={leg.to} />
          <p className="mt-0.5 font-mono text-xs">
            {leg.arriveTime || "--:--"}
            {nextDay && <sup className="ml-0.5 text-alert-ink">+1</sup>}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Flights on this date and where you sleep that night (or check out), under a day's header. */
export function TravelStrip({
  date,
  flights,
  hotels,
  className = "",
}: {
  date: string;
  flights: Flight[];
  hotels: Hotel[];
  className?: string;
}) {
  const dayFlights = flights
    .flatMap((f) => flightLegs(f).map(({ leg, kind }) => ({ f, leg, kind })))
    .filter(({ leg }) => leg.departDate === date || leg.arriveDate === date)
    .sort((a, b) =>
      (a.leg.departDate === date ? a.leg.departTime : a.leg.arriveTime).localeCompare(
        b.leg.departDate === date ? b.leg.departTime : b.leg.arriveTime,
      ),
    );
  const staying = hotels.filter((h) => staysOn(h, date));
  const leaving = hotels.filter((h) => h.checkOut === date && !staying.some((s) => s.id === h.id));
  if (dayFlights.length + staying.length + leaving.length === 0) return null;
  const nightNo = (h: Hotel) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${h.checkIn}T00:00:00Z`)) / 86_400_000) + 1;
  return (
    <ul className={`space-y-1.5 text-xs ${className}`}>
      {dayFlights.map(({ f, leg, kind }) => {
        const departs = leg.departDate === date;
        return (
          <li key={`${f.id}-${kind}`} className="flex items-center gap-2 rounded-xl bg-baby/50 px-2.5 py-1.5">
            <AirlineLogo code={f.airline} name={f.airlineName} size="sm" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{leg.flightNo || f.airlineName}</span> · {leg.from} {leg.departTime} → {leg.to}{" "}
              {leg.arriveTime}
            </span>
            <span className="shrink-0 text-ink-soft">{departs ? "🛫 ออก" : "🛬 ถึง"}</span>
          </li>
        );
      })}
      {staying.map((h) => (
        <li key={h.id} className="flex items-center gap-2 rounded-xl bg-alt/60 px-2.5 py-1.5">
          <span aria-hidden>🏨</span>
          <span className="min-w-0 flex-1 truncate">
            พักที่ <span className="font-semibold">{h.name}</span>
            {h.checkIn === date && h.checkInTime && ` · เช็กอิน ${h.checkInTime}`}
          </span>
          <span className="shrink-0 text-ink-soft">
            คืนที่ {nightNo(h)}/{hotelNights(h)}
          </span>
        </li>
      ))}
      {leaving.map((h) => (
        <li key={h.id} className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1.5 text-ink-soft">
          <span aria-hidden>🧳</span>
          <span className="min-w-0 flex-1 truncate">
            เช็กเอาต์ {h.name}
            {h.checkOutTime && ` · ${h.checkOutTime}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Section on the All page ----------

export function TravelSection({
  flights,
  hotels,
  members,
  defaultDate,
  defaultReturnDate,
  thbPerJpy,
  onChange,
}: {
  flights: Flight[];
  hotels: Hotel[];
  members: Member[];
  /** First trip day, used to prefill new flights/hotels. */
  defaultDate: string;
  /** Last trip day, used to prefill the return leg. */
  defaultReturnDate: string;
  thbPerJpy: number;
  onChange: (patch: Partial<Pick<TripData, "flights" | "hotels">>) => void;
}) {
  const [editingFlight, setEditingFlight] = useState<Flight | "new" | null>(null);
  const [editingHotel, setEditingHotel] = useState<Hotel | "new" | null>(null);
  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? `${m.emoji} ${m.name}` : "?";
  };
  const toThb = (n: number, c: Currency) => (c === "THB" ? n : n * thbPerJpy);

  const sortedFlights = [...flights].sort((a, b) => `${a.departDate}${a.departTime}`.localeCompare(`${b.departDate}${b.departTime}`));
  const sortedHotels = [...hotels].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const packaged = packagedHotels(flights);
  const hotelName = new Map(hotels.map((h) => [h.id, h.name]));
  const flightTotal = flights.reduce((s, f) => s + (f.cost ? toThb(travelTotal(f.cost, f.passengers.length), f.cost.currency) : 0), 0);
  const hotelTotal = hotels.reduce(
    (s, h) => s + (h.cost && !packaged.has(h.id) ? toThb(travelTotal(h.cost, h.guests.length, hotelNights(h)), h.cost.currency) : 0),
    0,
  );
  const payer = (c: TravelCost) => (c.selfPaid ? "👥 จ่ายกันเอง" : `🙋 ${name(c.paidBy)} จ่ายแทนก่อน`);

  const saveFlight = (f: Flight) =>
    onChange({ flights: flights.some((x) => x.id === f.id) ? flights.map((x) => (x.id === f.id ? f : x)) : [...flights, f] });
  const deleteHotel = (id: string) =>
    onChange({
      hotels: hotels.filter((x) => x.id !== id),
      // A deleted hotel can't stay part of a flight package.
      flights: flights.map((f) =>
        f.packageHotelIds.includes(id) ? { ...f, packageHotelIds: f.packageHotelIds.filter((x) => x !== id) } : f,
      ),
    });
  const saveHotel = (h: Hotel) =>
    onChange({ hotels: hotels.some((x) => x.id === h.id) ? hotels.map((x) => (x.id === h.id ? h : x)) : [...hotels, h] });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Flights */}
      <article className="rounded-3xl border border-line bg-white/80 p-4 shadow-sm">
        <header className="mb-3 flex items-center gap-1.5">
          <h3 className="font-semibold">✈️ เที่ยวบิน</h3>
          <IconButton icon="add" label="เพิ่มเที่ยวบิน" onClick={() => setEditingFlight("new")} />
          {flightTotal > 0 && (
            <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium">💴 {baht(flightTotal)}</span>
          )}
        </header>
        {sortedFlights.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm text-ink-soft">
            ยังไม่มีเที่ยวบิน — กด + เพื่อเพิ่มตั๋วขาไป/ขากลับ
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sortedFlights.map((f) => {
              const dir = FLIGHT_DIRECTIONS.find((d) => d.id === f.direction)!;
              return (
                <li key={f.id} className="rounded-2xl bg-surface/60 p-3">
                  <div className="flex items-start gap-2.5">
                    <AirlineLogo code={f.airline} name={f.airlineName} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                          {f.returnLeg ? "🔁 ไป-กลับ" : `${dir.icon} ${dir.label}`}
                        </span>
                        <BookedBadge booked={f.booked} />
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{f.airlineName || f.airline}</p>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0">
                      <IconButton icon="edit" size="sm" label={`แก้ไข ${f.flightNo}`} onClick={() => setEditingFlight(f)} />
                      <DeleteButton
                        size="sm"
                        label={`ลบเที่ยวบิน ${f.flightNo}`}
                        onConfirm={() => onChange({ flights: flights.filter((x) => x.id !== f.id) })}
                      />
                    </div>
                  </div>

                  {flightLegs(f).map(({ leg, kind }) => (
                    <LegRoute key={kind} leg={leg} label={f.returnLeg ? (kind === "return" ? "🛬 ขากลับ" : "🛫 ขาไป") : ""} />
                  ))}
                  <p className="mt-1.5 text-xs text-ink-soft">
                    👥 {f.passengers.length} คน{f.bookingRef && ` · รหัสจอง ${f.bookingRef}`}
                  </p>
                  {f.cost && f.cost.amount > 0 && (
                    <p className="mt-0.5 text-xs">
                      💴 <span className="font-medium">{costLine(f.cost, f.passengers.length, 1)}</span>
                      <span className="text-ink-soft"> · {payer(f.cost)}</span>
                    </p>
                  )}
                  {f.cost && (
                    <p className="mt-0.5 text-xs">
                      {f.packageHotelIds.length > 0 ? (
                        <span className="rounded-full bg-alt px-2 py-0.5 font-medium text-alt-ink">
                          ✈️+🏨 รวมที่พักด้วย: {f.packageHotelIds.map((id) => hotelName.get(id)).filter(Boolean).join(", ")}
                        </span>
                      ) : (
                        <span className="text-ink-soft">✈️ ค่าตั๋วอย่างเดียว (แยกที่พัก)</span>
                      )}
                    </p>
                  )}
                  {f.note && <p className="mt-0.5 text-xs text-ink-soft">📝 {f.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </article>

      {/* Hotels */}
      <article className="rounded-3xl border border-line bg-white/80 p-4 shadow-sm">
        <header className="mb-3 flex items-center gap-1.5">
          <h3 className="font-semibold">🏨 ที่พัก</h3>
          <IconButton icon="add" label="เพิ่มที่พัก" onClick={() => setEditingHotel("new")} />
          {hotelTotal > 0 && (
            <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium">💴 {baht(hotelTotal)}</span>
          )}
        </header>
        {sortedHotels.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm text-ink-soft">
            ยังไม่มีที่พัก — กด + เพื่อเพิ่ม
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sortedHotels.map((h) => {
              const nights = hotelNights(h);
              // The attached map link; without one, the address (or name) is searched on Google Maps.
              const attached = h.mapUrl && isSafeUrl(h.mapUrl) ? h.mapUrl : "";
              const map = attached || (h.address || h.name ? mapsSearchUrl(h.address || h.name) : "");
              return (
                <li key={h.id} className="rounded-2xl bg-surface/60 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">🏨 {h.name || "ที่พัก"}</span>
                        <BookedBadge booked={h.booked} />
                      </p>
                      {map && (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-medium text-baby-ink hover:underline"
                        >
                          <span aria-hidden>📍</span>
                          <span className="truncate">{h.address || "Open Map"}</span>
                          <span aria-hidden>↗</span>
                        </a>
                      )}
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0">
                      <IconButton icon="edit" size="sm" label={`แก้ไข ${h.name}`} onClick={() => setEditingHotel(h)} />
                      <DeleteButton
                        size="sm"
                        label={`ลบที่พัก ${h.name}`}
                        onConfirm={() => deleteHotel(h.id)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-white px-3 py-2 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-ink-soft">เช็กอิน</p>
                      <p className="font-semibold">{h.checkIn ? formatDate(h.checkIn) : "—"}</p>
                      {h.checkInTime && <p className="font-mono text-ink-soft">{h.checkInTime}</p>}
                    </div>
                    <span className="rounded-full bg-baby px-2 py-0.5 text-[11px] font-semibold text-baby-ink">🌙 {nights} คืน</span>
                    <div>
                      <p className="text-[10px] text-ink-soft">เช็กเอาต์</p>
                      <p className="font-semibold">{h.checkOut ? formatDate(h.checkOut) : "—"}</p>
                      {h.checkOutTime && <p className="font-mono text-ink-soft">{h.checkOutTime}</p>}
                    </div>
                  </div>
                  {packaged.has(h.id) ? (
                    <p className="mt-1.5 text-xs">
                      <span className="rounded-full bg-alt px-2 py-0.5 font-medium text-alt-ink">
                        💴 รวมในค่าตั๋ว {packaged.get(h.id)!.flightNo || packaged.get(h.id)!.airlineName} แล้ว
                      </span>
                    </p>
                  ) : h.cost && h.cost.amount > 0 && (
                    <p className="mt-1.5 text-xs">
                      💴 <span className="font-medium">{costLine(h.cost, h.guests.length, nights)}</span>
                      <span className="text-ink-soft"> · {payer(h.cost)}</span>
                    </p>
                  )}
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                    <span>👥 {h.guests.length} คน</span>
                    {h.bookingRef && <span>รหัสจอง {h.bookingRef}</span>}
                    {h.url && isSafeUrl(h.url) && (
                      <a href={h.url} target="_blank" rel="noreferrer" className="font-medium text-baby-ink hover:underline">
                        🔗 การจอง
                      </a>
                    )}
                  </p>
                  {h.note && <p className="mt-0.5 text-xs text-ink-soft">📝 {h.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </article>

      {editingFlight && (
        <FlightForm
          initial={editingFlight === "new" ? null : editingFlight}
          members={members}
          hotels={sortedHotels}
          defaultDate={defaultDate}
          defaultReturnDate={defaultReturnDate}
          onCancel={() => setEditingFlight(null)}
          onSave={(f) => {
            saveFlight(f);
            setEditingFlight(null);
          }}
        />
      )}
      {editingHotel && (
        <HotelForm
          initial={editingHotel === "new" ? null : editingHotel}
          includedIn={editingHotel === "new" ? undefined : packaged.get(editingHotel.id)}
          members={members}
          defaultDate={defaultDate}
          onCancel={() => setEditingHotel(null)}
          onSave={(h) => {
            saveHotel(h);
            setEditingHotel(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Shared form parts ----------

function PeopleChips({ label, members, value, onChange }: { label: string; members: Member[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => {
          const on = value.includes(m.id);
          return (
            <button
              type="button"
              key={m.id}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                on ? "bg-baby text-baby-ink" : "bg-white text-ink-soft line-through ring-1 ring-line"
              }`}
            >
              {m.emoji} {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Segmented<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-xl border border-line text-sm">
      {options.map(([v, text]) => (
        <button
          type="button"
          key={String(v)}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 px-2 py-2 font-medium transition ${value === v ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Optional booking cost: amount, how it's priced, currency and who pays. */
function CostFields({
  id,
  cost,
  onChange,
  members,
  priceTypes,
  people,
  nights,
}: {
  id: string;
  cost: TravelCost | null;
  onChange: (c: TravelCost | null) => void;
  members: Member[];
  priceTypes: readonly (readonly [TravelPriceType, string])[];
  people: number;
  nights: number;
}) {
  const set = (p: Partial<TravelCost>) => cost && onChange({ ...cost, ...p });
  return (
    <div className="space-y-3 rounded-2xl border border-line p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={!!cost}
          onChange={(e) =>
            onChange(e.target.checked ? { ...EMPTY_TRAVEL_COST, priceType: priceTypes[0][0], paidBy: members[0]?.id ?? "" } : null)
          }
          className="h-4 w-4 accent-ink"
        />
        💴 มีค่าจอง (เข้า Budget อัตโนมัติ)
      </label>
      {cost && (
        <>
          <Segmented label="คิดราคาแบบ" options={priceTypes} value={cost.priceType} onChange={(priceType) => set({ priceType })} />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass} htmlFor={`${id}-amount`}>
                {cost.priceType === "perPerson" ? "ราคาต่อคน" : cost.priceType === "perNight" ? "ราคาต่อคืน" : "ราคารวม"}
              </label>
              <input
                id={`${id}-amount`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className={inputClass}
                value={cost.amount || ""}
                onChange={(e) => set({ amount: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="0"
              />
            </div>
            <div>
              <span className={labelClass}>สกุลเงิน</span>
              <Segmented
                label="สกุลเงิน"
                options={[
                  ["THB", "฿"],
                  ["JPY", "¥"],
                ] as const}
                value={cost.currency}
                onChange={(currency) => set({ currency })}
              />
            </div>
          </div>
          {cost.amount > 0 && <p className="text-xs text-ink-soft">{costLine(cost, people, nights)}</p>}
          <PayerField
            id={`${id}-payer`}
            selfPaid={cost.selfPaid}
            paidBy={cost.paidBy}
            members={members}
            onSelfPaid={(selfPaid) => set({ selfPaid })}
            onPaidBy={(paidBy) => set({ paidBy })}
          />
        </>
      )}
    </div>
  );
}

function BookedToggle({ booked, onChange }: { booked: boolean; onChange: (b: boolean) => void }) {
  return (
    <div>
      <span className={labelClass}>สถานะ</span>
      <Segmented
        label="สถานะการจอง"
        options={[
          [false, "⏳ ยังไม่จอง"],
          [true, "✅ จองแล้ว"],
        ] as const}
        value={booked}
        onChange={onChange}
      />
    </div>
  );
}

/** Save/cancel bar pinned to the bottom of the sheet, with the reason saving failed right above it. */
function FormButtons({ error, onCancel }: { error: string; onCancel: () => void }) {
  return (
    <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 -mx-5 space-y-2 border-t border-line/60 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:-bottom-6 sm:-mx-6 sm:px-6 sm:pb-6">
      {error && (
        <p role="alert" className="rounded-xl bg-alert px-3 py-2 text-sm font-medium text-alert-ink">
          ⚠️ {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface">
          ยกเลิก
        </button>
        <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90">
          บันทึก
        </button>
      </div>
    </div>
  );
}

const EMPTY_LEG: FlightLeg = { flightNo: "", from: "", to: "", departDate: "", departTime: "", arriveDate: "", arriveTime: "" };

/** Flight number, airports (typed freely), and departure/arrival date-times of one leg. */
function LegFields({ id, title, leg, onChange }: { id: string; title: string; leg: FlightLeg; onChange: (p: Partial<FlightLeg>) => void }) {
  return (
    <fieldset className="grid grid-cols-2 gap-2 rounded-2xl bg-surface/60 p-2.5">
      <legend className="sr-only">{title}</legend>
      <p className="col-span-2 text-sm font-semibold">{title}</p>
      <div className="col-span-2">
        <label className={labelClass} htmlFor={`${id}-no`}>เลขเที่ยวบิน</label>
        <input id={`${id}-no`} className={`${inputClass} uppercase`} value={leg.flightNo} onChange={(e) => onChange({ flightNo: e.target.value })} placeholder="เช่น TG 676" />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-from`}>สนามบินต้นทาง</label>
        <input id={`${id}-from`} type="text" autoComplete="off" className={inputClass} value={leg.from} onChange={(e) => onChange({ from: e.target.value })} placeholder="เช่น สุวรรณภูมิ" />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-to`}>สนามบินปลายทาง</label>
        <input id={`${id}-to`} type="text" autoComplete="off" className={inputClass} value={leg.to} onChange={(e) => onChange({ to: e.target.value })} placeholder="เช่น นาริตะ" />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-dd`}>วันออก</label>
        <input
          id={`${id}-dd`}
          type="date"
          className={inputClass}
          value={leg.departDate}
          onChange={(e) => onChange({ departDate: e.target.value, ...(!leg.arriveDate || leg.arriveDate < e.target.value ? { arriveDate: e.target.value } : {}) })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-dt`}>เวลาออก</label>
        <input id={`${id}-dt`} type="time" className={inputClass} value={leg.departTime} onChange={(e) => onChange({ departTime: e.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-ad`}>วันถึง</label>
        <input id={`${id}-ad`} type="date" className={inputClass} value={leg.arriveDate} onChange={(e) => onChange({ arriveDate: e.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-at`}>เวลาถึง</label>
        <input id={`${id}-at`} type="time" className={inputClass} value={leg.arriveTime} onChange={(e) => onChange({ arriveTime: e.target.value })} />
      </div>
    </fieldset>
  );
}

function legError(leg: FlightLeg, name: string): string {
  if (!leg.from.trim() || !leg.to.trim()) return `${name}: ใส่สนามบินต้นทางและปลายทาง`;
  if (!leg.departDate) return `${name}: ใส่วันออก`;
  if (leg.arriveDate && leg.arriveDate < leg.departDate) return `${name}: วันถึงต้องไม่ก่อนวันออก`;
  return "";
}

const trimLeg = (l: FlightLeg): FlightLeg => ({
  ...l,
  flightNo: l.flightNo.trim().toUpperCase(),
  from: l.from.trim(),
  to: l.to.trim(),
  arriveDate: l.arriveDate || l.departDate,
});

function costError(c: TravelCost | null, people: number): string {
  if (!c) return "";
  if (!(c.amount > 0)) return "ใส่ราคามากกว่า 0 หรือเอาติ๊ก “มีค่าจอง” ออก";
  if (people === 0) return "เลือกคนอย่างน้อย 1 คนเพื่อหารค่าใช้จ่าย";
  if (!c.selfPaid && !c.paidBy) return "เลือกคนที่จ่ายแทนก่อน";
  return "";
}

// ---------- Flight form ----------

function FlightForm({
  initial,
  members,
  hotels,
  defaultDate,
  defaultReturnDate,
  onCancel,
  onSave,
}: {
  initial: Flight | null;
  members: Member[];
  hotels: Hotel[];
  defaultDate: string;
  defaultReturnDate: string;
  onCancel: () => void;
  onSave: (f: Flight) => void;
}) {
  const [f, setF] = useState<Flight>(
    () =>
      initial ?? {
        id: uid(),
        direction: "outbound",
        airline: "",
        airlineName: "",
        flightNo: "",
        from: "",
        to: "",
        departDate: defaultDate,
        departTime: "",
        arriveDate: defaultDate,
        arriveTime: "",
        // Round trip by default.
        returnLeg: { ...EMPTY_LEG, departDate: defaultReturnDate, arriveDate: defaultReturnDate },
        bookingRef: "",
        booked: false,
        note: "",
        passengers: members.map((m) => m.id),
        cost: null,
        packageHotelIds: [],
      },
  );
  const [error, setError] = useState("");
  const set = (p: Partial<Flight>) => setF((x) => ({ ...x, ...p }));
  // Remember the return leg while toggled to one-way, so switching back doesn't lose it.
  const [savedReturn, setSavedReturn] = useState<FlightLeg | null>(null);
  const roundTrip = !!f.returnLeg;
  const setRoundTrip = (on: boolean) => {
    if (on === roundTrip) return;
    if (on) {
      set({
        direction: "outbound",
        returnLeg: savedReturn ?? { ...EMPTY_LEG, from: f.to, to: f.from, departDate: defaultReturnDate, arriveDate: defaultReturnDate },
      });
    } else {
      setSavedReturn(f.returnLeg);
      set({ returnLeg: null });
    }
  };
  // "รวมที่พักด้วย" chosen; kept separately so switching it on before picking a hotel works.
  const [withHotel, setWithHotel] = useState(f.packageHotelIds.length > 0);
  const known = AIRLINES.find((a) => a.code === f.airline);

  const fail = setError;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.airline.trim() && !f.flightNo.trim()) return fail("เลือกสายการบินหรือใส่เลขเที่ยวบิน");
    const le = legError(f, roundTrip ? "ขาไป" : "เที่ยวบิน") || (f.returnLeg ? legError(f.returnLeg, "ขากลับ") : "");
    if (le) return fail(le);
    if (f.returnLeg && f.returnLeg.departDate < f.departDate) return fail("ขากลับต้องไม่ก่อนขาไป");
    if (f.passengers.length === 0) return fail("เลือกคนที่บินอย่างน้อย 1 คน");
    const ce = costError(f.cost, f.passengers.length);
    if (ce) return fail(ce);
    if (f.cost && withHotel && f.packageHotelIds.length === 0)
      return fail(hotels.length ? "เลือกที่พักที่รวมอยู่ในตั๋ว หรือเปลี่ยนเป็น “แยกที่พัก”" : "ยังไม่มีที่พัก — เปลี่ยนเป็น “แยกที่พัก” หรือเพิ่มที่พักก่อน");
    onSave({
      ...f,
      ...trimLeg(f),
      returnLeg: f.returnLeg ? trimLeg(f.returnLeg) : null,
      packageHotelIds: f.cost && withHotel ? f.packageHotelIds.filter((id) => hotels.some((h) => h.id === id)) : [],
      airline: f.airline.trim().toUpperCase(),
      airlineName: f.airlineName.trim() || known?.name || "",
      bookingRef: f.bookingRef.trim(),
      note: f.note.trim(),
    });
  };

  return (
    <Modal title={initial ? "แก้ไขเที่ยวบิน" : "เพิ่มเที่ยวบิน"} onClose={onCancel}>
      {/* noValidate: the browser's own checks block saving silently on iPhone; ours explain why. */}
      <form noValidate onSubmit={submit} onChange={() => error && setError("")} className="space-y-3">
        <div>
          <span className={labelClass}>ประเภทตั๋ว</span>
          <Segmented
            label="ประเภทตั๋ว"
            options={[
              [true, "🔁 ไป-กลับ (Round Trip)"],
              [false, "➡️ เที่ยวเดียว"],
            ] as const}
            value={roundTrip}
            onChange={setRoundTrip}
          />
          {!roundTrip && (
            <div className="mt-2">
              <Segmented
                label="เที่ยวนี้คือ"
                options={FLIGHT_DIRECTIONS.map((d) => [d.id, `${d.icon} ${d.label}`] as const)}
                value={f.direction}
                onChange={(direction) => set({ direction })}
              />
            </div>
          )}
        </div>

        <div>
          <span className={labelClass}>สายการบิน</span>
          <div className="flex items-center gap-2">
            <AirlineLogo code={f.airline} name={f.airlineName} />
            <select
              aria-label="เลือกสายการบิน"
              className={inputClass}
              value={known ? f.airline : f.airline ? "__custom" : ""}
              onChange={(e) => {
                const a = AIRLINES.find((x) => x.code === e.target.value);
                if (a) set({ airline: a.code, airlineName: a.name });
                else if (e.target.value === "__custom") set({ airline: f.airline || "", airlineName: "" });
                else set({ airline: "", airlineName: "" });
              }}
            >
              <option value="">— เลือกสายการบิน —</option>
              {AIRLINES.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} ({a.code})
                </option>
              ))}
              <option value="__custom">อื่น ๆ (พิมพ์เอง)</option>
            </select>
          </div>
          {!known && (
            <div className="mt-2 flex gap-2">
              <input
                aria-label="รหัสสายการบิน 2 ตัว"
                maxLength={3}
                className={`${inputClass} w-24 uppercase`}
                value={f.airline}
                onChange={(e) => set({ airline: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                placeholder="รหัส เช่น KE"
              />
              <input
                aria-label="ชื่อสายการบิน"
                className={inputClass}
                value={f.airlineName}
                onChange={(e) => set({ airlineName: e.target.value })}
                placeholder="ชื่อสายการบิน"
              />
            </div>
          )}
          <p className="mt-1 text-[11px] text-ink-soft">โลโก้ดึงจากรหัสสายการบิน 2 ตัว (IATA)</p>
        </div>

        <LegFields id="fl-out" title={roundTrip ? "🛫 ขาไป" : "✈️ เที่ยวบิน"} leg={f} onChange={set} />
        {f.returnLeg && (
          <LegFields
            id="fl-ret"
            title="🛬 ขากลับ"
            leg={f.returnLeg}
            onChange={(p) => setF((x) => ({ ...x, returnLeg: x.returnLeg && { ...x.returnLeg, ...p } }))}
          />
        )}

        <div>
          <label className={labelClass} htmlFor="fl-ref">รหัสจอง (PNR)</label>
          <input id="fl-ref" className={`${inputClass} uppercase`} value={f.bookingRef} onChange={(e) => set({ bookingRef: e.target.value })} placeholder="ไม่บังคับ" />
        </div>

        <BookedToggle booked={f.booked} onChange={(booked) => set({ booked })} />
        <PeopleChips label="ใครบินเที่ยวนี้" members={members} value={f.passengers} onChange={(passengers) => set({ passengers })} />
        <CostFields
          id="fl-cost"
          cost={f.cost}
          onChange={(cost) => set({ cost })}
          members={members}
          priceTypes={[
            ["perPerson", "ราคาต่อคน"],
            ["total", "ราคารวม"],
          ] as const}
          people={f.passengers.length}
          nights={1}
        />
        {f.cost && (
          <div className="space-y-2 rounded-2xl border border-line p-3">
            <span className={labelClass}>ค่าตั๋วนี้</span>
            <Segmented
              label="ค่าตั๋วรวมที่พักไหม"
              options={[
                [false, "✈️ แยกที่พัก"],
                [true, "✈️+🏨 รวมที่พักด้วย"],
              ] as const}
              value={withHotel}
              onChange={setWithHotel}
            />
            {withHotel &&
              (hotels.length === 0 ? (
                <p className="text-xs text-alert-ink">ยังไม่มีที่พัก — เพิ่มที่พักในส่วน 🏨 ก่อน แล้วกลับมาเลือก</p>
              ) : (
                <>
                  <p className="text-[11px] text-ink-soft">เลือกที่พักที่รวมอยู่ในราคานี้ — ที่พักนั้นจะไม่คิดเงินซ้ำ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hotels.map((h) => {
                      const on = f.packageHotelIds.includes(h.id);
                      return (
                        <button
                          type="button"
                          key={h.id}
                          aria-pressed={on}
                          onClick={() =>
                            set({ packageHotelIds: on ? f.packageHotelIds.filter((x) => x !== h.id) : [...f.packageHotelIds, h.id] })
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            on ? "bg-alt text-alt-ink" : "bg-white text-ink-soft ring-1 ring-line"
                          }`}
                        >
                          🏨 {h.name} · {hotelNights(h)} คืน
                        </button>
                      );
                    })}
                  </div>
                </>
              ))}
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="fl-note">หมายเหตุ</label>
          <input id="fl-note" className={inputClass} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="เช่น โหลดกระเป๋า 20 kg, เทอร์มินัล 1" />
        </div>
        <FormButtons error={error} onCancel={onCancel} />
      </form>
    </Modal>
  );
}

// ---------- Hotel form ----------

function HotelForm({
  initial,
  includedIn,
  members,
  defaultDate,
  onCancel,
  onSave,
}: {
  initial: Hotel | null;
  /** The flight package that already pays for this stay, if any. */
  includedIn?: Flight;
  members: Member[];
  defaultDate: string;
  onCancel: () => void;
  onSave: (h: Hotel) => void;
}) {
  const [h, setH] = useState<Hotel>(
    () =>
      initial ?? {
        id: uid(),
        name: "",
        address: "",
        mapUrl: "",
        url: "",
        checkIn: defaultDate,
        checkOut: "",
        checkInTime: "15:00",
        checkOutTime: "11:00",
        bookingRef: "",
        booked: false,
        note: "",
        guests: members.map((m) => m.id),
        cost: null,
      },
  );
  const [error, setError] = useState("");
  const set = (p: Partial<Hotel>) => setH((x) => ({ ...x, ...p }));
  const nights = hotelNights(h);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!h.name.trim()) return setError("ใส่ชื่อที่พัก");
    if (!h.checkIn || !h.checkOut) return setError("ใส่วันเช็กอินและเช็กเอาต์");
    if (nights < 1) return setError("วันเช็กเอาต์ต้องหลังวันเช็กอิน");
    if (h.url && !isSafeUrl(h.url)) return setError("ลิงก์การจองต้องขึ้นต้นด้วย http:// หรือ https://");
    if (h.mapUrl && !isSafeUrl(h.mapUrl)) return setError("ลิงก์แผนที่ต้องขึ้นต้นด้วย http:// หรือ https://");
    const ce = includedIn ? "" : costError(h.cost, h.guests.length);
    if (ce) return setError(ce);
    onSave({ ...h, name: h.name.trim(), address: h.address.trim(), bookingRef: h.bookingRef.trim(), note: h.note.trim() });
  };

  return (
    <Modal title={initial ? "แก้ไขที่พัก" : "เพิ่มที่พัก"} onClose={onCancel}>
      <form noValidate onSubmit={submit} onChange={() => error && setError("")} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="ht-name">ชื่อที่พัก</label>
          <input id="ht-name" autoFocus={!initial} className={inputClass} value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="เช่น Hotel Gracery Shinjuku" />
        </div>
        <div>
          <label className={labelClass} htmlFor="ht-addr">ที่อยู่ / ย่าน</label>
          <input id="ht-addr" className={inputClass} value={h.address} onChange={(e) => set({ address: e.target.value })} placeholder="เช่น Asakusa, Taito City" />
        </div>
        <div>
          <label className={labelClass} htmlFor="ht-map">ลิงก์แผนที่ (Google Maps)</label>
          <input id="ht-map" type="url" inputMode="url" className={inputClass} value={h.mapUrl} onChange={(e) => set({ mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
          <p className="mt-1 text-[11px] text-ink-soft">แสดงใต้ชื่อที่พัก · ถ้าไม่ใส่ จะค้นหาจากที่อยู่ให้</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface/60 p-2.5">
          <p className="text-xs font-semibold">เช็กอิน</p>
          <p className="text-xs font-semibold">เช็กเอาต์</p>
          <input aria-label="วันเช็กอิน" type="date" className={inputClass} value={h.checkIn} onChange={(e) => set({ checkIn: e.target.value })} />
          <input aria-label="วันเช็กเอาต์" type="date" min={h.checkIn} className={inputClass} value={h.checkOut} onChange={(e) => set({ checkOut: e.target.value })} />
          <input aria-label="เวลาเช็กอิน" type="time" className={inputClass} value={h.checkInTime} onChange={(e) => set({ checkInTime: e.target.value })} />
          <input aria-label="เวลาเช็กเอาต์" type="time" className={inputClass} value={h.checkOutTime} onChange={(e) => set({ checkOutTime: e.target.value })} />
          <p className="col-span-2 text-center text-xs text-ink-soft">{nights > 0 ? `🌙 ${nights} คืน` : "เลือกวันเช็กเอาต์"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="ht-ref">รหัสจอง</label>
            <input id="ht-ref" className={inputClass} value={h.bookingRef} onChange={(e) => set({ bookingRef: e.target.value })} placeholder="ไม่บังคับ" />
          </div>
          <div>
            <label className={labelClass} htmlFor="ht-url">ลิงก์การจอง</label>
            <input id="ht-url" type="url" className={inputClass} value={h.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </div>
        </div>
        <BookedToggle booked={h.booked} onChange={(booked) => set({ booked })} />
        <PeopleChips label="ใครพักที่นี่" members={members} value={h.guests} onChange={(guests) => set({ guests })} />
        {includedIn ? (
          <p className="rounded-2xl bg-alt/60 p-3 text-sm text-alt-ink">
            💴 ค่าที่พักนี้รวมอยู่ในค่าตั๋ว <b>{includedIn.flightNo || includedIn.airlineName}</b> แล้ว — แก้ได้ที่เที่ยวบินนั้น
          </p>
        ) : (
        <CostFields
          id="ht-cost"
          cost={h.cost}
          onChange={(cost) => set({ cost })}
          members={members}
          priceTypes={[
            ["perNight", "ราคาต่อคืน"],
            ["total", "ราคารวม"],
            ["perPerson", "ราคาต่อคน"],
          ] as const}
          people={h.guests.length}
          nights={nights}
        />
        )}
        <div>
          <label className={labelClass} htmlFor="ht-note">หมายเหตุ</label>
          <input id="ht-note" className={inputClass} value={h.note} onChange={(e) => set({ note: e.target.value })} placeholder="เช่น ฝากกระเป๋าได้, มีเครื่องซักผ้า" />
        </div>
        <FormButtons error={error} onCancel={onCancel} />
      </form>
    </Modal>
  );
}
