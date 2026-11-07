"use client";

import { useState } from "react";
import {
  activePlace,
  allExpenses,
  baht,
  computeBalances,
  expensesByActivity,
  formatDate,
  formatDayTab,
  hasPaidShare,
  settle,
  shareOf,
  sumJpy,
  toJpy,
  uid,
  yen,
  type Currency,
  type Expense,
  type Member,
  type TripData,
} from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { paymentSummary } from "./Booking";
import { PayerField } from "./PayerField";
import { DeleteButton, IconButton } from "./Icons";

type Tab = "overview" | "list";
type StatusFilter = "all" | "unpaid" | "paid";

const money = (amount: number, c: Currency) => (c === "JPY" ? yen(amount) : baht(amount));

/** Formatters for yen totals in the chosen display unit, plus the other unit for reference. */
function unitFormat(unit: Currency, thbPerJpy: number) {
  return {
    fmt: (jpy: number) => (unit === "JPY" ? yen(jpy) : baht(jpy * thbPerJpy)),
    other: (jpy: number) => (unit === "JPY" ? baht(jpy * thbPerJpy) : yen(jpy)),
  };
}

/** Where a derived expense comes from, and where to edit it. */
function sourceOf(e: Expense): { icon: string; hint: string } {
  if (e.id.startsWith("flight-")) return { icon: "✈️", hint: "ตั๋วเครื่องบิน · แก้ที่ Trip Planner > All" };
  if (e.id.startsWith("hotel-")) return { icon: "🏨", hint: "ที่พัก · แก้ที่ Trip Planner > All" };
  if (e.id.startsWith("booking-")) return { icon: "🎫", hint: "ค่าจอง · แก้ที่กิจกรรม" };
  if (e.wishId) return { icon: "🛍️", hint: "Wishlist · แก้ที่เมนู Wishlist" };
  if (e.checklistId) return { icon: "🎒", hint: "Checklist · แก้ที่เมนู Checklist" };
  return { icon: "💴", hint: "" };
}

export function Expenses({
  data,
  currentMemberId,
  onChange,
}: {
  data: TripData;
  /** The signed-in profile, used as the default payer for new expenses. */
  currentMemberId?: string;
  onChange: (patch: Partial<TripData>) => void;
}) {
  const { members, expenses } = data;
  const memberById = Object.fromEntries(members.map((m) => [m.id, m])) as Record<string, Member>;
  const name = (id: string) => (memberById[id] ? `${memberById[id].emoji} ${memberById[id].name}` : "?");

  const [tab, setTab] = useState<Tab>("overview");
  // Display unit for totals; baht by default.
  const [unit, setUnit] = useState<Currency>("THB");
  const [adding, setAdding] = useState(false);

  // All expenses: ones added here first (newest first), then those derived from bookings, wishes, checklist.
  const manualIds = new Set(expenses.map((e) => e.id));
  const all = allExpenses(data);
  const ordered = [...expenses, ...all.filter((e) => !manualIds.has(e.id))];

  const activityById = new Map(data.activities.map((a) => [a.id, a]));
  const dayIndex = new Map(data.days.map((d, i) => [d.id, i]));
  const activityGroups = data.days.map((d, i) => ({
    day: d,
    index: i,
    acts: data.activities.filter((a) => a.dayId === d.id).sort((a, b) => a.time.localeCompare(b.time)),
  }));
  const activityLabel = (id: string | undefined) => {
    const a = id ? activityById.get(id) : undefined;
    const di = a ? dayIndex.get(a.dayId) : undefined;
    return a && di !== undefined ? `DAY ${di + 1} · ${a.time} · ${activePlace(a).title}` : "";
  };

  return (
    <section aria-label="หารค่าใช้จ่าย" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">💰 หารค่าใช้จ่าย</h2>
        <IconButton icon="add" label="ลงรายการใหม่" onClick={() => setAdding(true)} />
        <div role="radiogroup" aria-label="หน่วยเงินที่แสดง" className="ml-auto flex overflow-hidden rounded-full border border-line text-sm">
          {(
            [
              ["THB", "฿ บาท"],
              ["JPY", "¥ เยน"],
            ] as const
          ).map(([c, label]) => (
            <button
              key={c}
              role="radio"
              aria-checked={unit === c}
              onClick={() => setUnit(c)}
              className={`px-3 py-1.5 font-medium transition ${unit === c ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="หน้าค่าใช้จ่าย" className="mb-4 flex rounded-full bg-surface p-1">
        {(
          [
            ["overview", "📊 ภาพรวม"],
            ["list", `🧾 รายการ (${ordered.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === id ? "bg-ink text-white shadow" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <Overview data={data} all={all} unit={unit} name={name} activityLabel={activityLabel} onChange={onChange} />
      ) : (
        <ExpenseList
          data={data}
          unit={unit}
          ordered={ordered}
          manualIds={manualIds}
          name={name}
          activityLabel={activityLabel}
          activityGroups={activityGroups}
          onChange={onChange}
        />
      )}

      {adding && (
        <NewExpense
          members={members}
          currentMemberId={currentMemberId}
          activityGroups={activityGroups}
          onCancel={() => setAdding(false)}
          onAdd={(e) => {
            onChange({ expenses: [e, ...expenses] });
            setAdding(false);
            setTab("list");
          }}
        />
      )}
    </section>
  );
}

// ---------- Overview tab ----------

function Overview({
  data,
  all,
  unit,
  name,
  activityLabel,
  onChange,
}: {
  data: TripData;
  all: Expense[];
  unit: Currency;
  name: (id: string) => string;
  activityLabel: (id: string) => string;
  onChange: (patch: Partial<TripData>) => void;
}) {
  const { members, thbPerJpy } = data;
  const { fmt, other } = unitFormat(unit, thbPerJpy);
  const totalJpy = sumJpy(all, thbPerJpy);
  const perHead = members.length ? totalJpy / members.length : 0;
  const balances = computeBalances(data);
  const transfers = settle(balances);
  const shareJpyOf = (e: Expense) => toJpy({ ...e, amount: shareOf(e) }, thbPerJpy);
  // What the trip costs this member: their share of every expense they're in.
  const ownJpy = (id: string) => all.filter((e) => e.splitAmong.includes(id)).reduce((s, e) => s + shareJpyOf(e), 0);
  // What this member paid up front for other people (others' shares on items they paid first).
  const advancedJpy = (id: string) =>
    all
      .filter((e) => !e.selfPaid && e.paidBy === id)
      .reduce((s, e) => s + shareJpyOf(e) * e.splitAmong.filter((x) => x !== id).length, 0);

  const costsByActivity = expensesByActivity(data);
  const activityTotals = data.days.flatMap((d) =>
    data.activities
      .filter((a) => a.dayId === d.id && costsByActivity.has(a.id))
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((a) => ({ a, list: costsByActivity.get(a.id)! })),
  );

  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-soft">
        อัตราแลกเปลี่ยน 1 เยน ={" "}
        <input
          type="number"
          step="0.001"
          min="0.001"
          aria-label="บาทต่อ 1 เยน"
          value={thbPerJpy}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v > 0) onChange({ thbPerJpy: v });
          }}
          className="w-20 rounded-md border border-line bg-surface/60 px-1 py-0.5 text-center text-base sm:w-16 sm:text-xs"
        />{" "}
        บาท (แก้ได้)
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-baby p-3">
          <p className="text-xs text-baby-ink">รวมทั้งทริป</p>
          <p className="text-xl font-bold text-baby-ink">{fmt(totalJpy)}</p>
          <p className="text-xs text-baby-ink/80">≈ {other(totalJpy)}</p>
        </div>
        <div className="rounded-2xl bg-alert p-3">
          <p className="text-xs text-alert-ink">เฉลี่ยต่อคน</p>
          <p className="text-xl font-bold text-alert-ink">{fmt(perHead)}</p>
          <p className="text-xs text-alert-ink/80">≈ {other(perHead)}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">ยอดของแต่ละคน</h3>
        <ul className="space-y-2">
          {members.map((m) => {
            const b = balances[m.id] ?? 0;
            const own = ownJpy(m.id);
            const advanced = advancedJpy(m.id);
            return (
              <li key={m.id} className="rounded-2xl bg-surface/70 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span>{m.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      b > 0.5 ? "bg-done text-done-ink" : b < -0.5 ? "bg-alert text-alert-ink" : "bg-white text-ink-soft"
                    }`}
                  >
                    {b > 0.5 ? `ได้คืน ${fmt(b)}` : b < -0.5 ? `ต้องจ่าย ${fmt(-b)}` : "เคลียร์แล้ว"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-white px-1.5 py-1.5">
                    <dt className="text-[10px] leading-tight text-ink-soft">รวมค่าใช้จ่าย</dt>
                    <dd className="mt-0.5 font-semibold">{fmt(own + advanced)}</dd>
                  </div>
                  <div className="rounded-xl bg-white px-1.5 py-1.5">
                    <dt className="text-[10px] leading-tight text-ink-soft">ค่าใช้จ่ายตนเอง</dt>
                    <dd className="mt-0.5 font-semibold">{fmt(own)}</dd>
                  </div>
                  <div className="rounded-xl bg-white px-1.5 py-1.5">
                    <dt className="text-[10px] leading-tight text-ink-soft">ค่าใช้จ่ายให้คนอื่นก่อน</dt>
                    <dd className="mt-0.5 font-semibold">{fmt(advanced)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          รวม = ส่วนของตัวเอง + ที่ออกให้คนอื่นก่อน · ได้คืน/ต้องจ่าย คิดจากรายการที่ยังไม่ได้ติ๊กว่าจ่ายแล้ว
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-done-ink/40 bg-done/40 p-3">
        <h3 className="mb-0.5 text-sm font-semibold text-done-ink">🤝 ใครต้องโอนให้ใคร</h3>
        <p className="mb-2 text-[11px] text-done-ink/80">คิดจากยอดที่ยังไม่ได้ติ๊กว่าจ่ายแล้วในแท็บรายการ</p>
        {transfers.length === 0 ? (
          <p className="text-sm text-done-ink">ทุกคนเคลียร์กันหมดแล้ว 🎉</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {transfers.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{name(t.from)}</span>
                <span className="text-ink-soft">→</span>
                <span className="font-medium">{name(t.to)}</span>
                <span className="ml-auto font-semibold">
                  {fmt(t.amountJpy)} <span className="text-xs font-normal text-ink-soft">({other(t.amountJpy)})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activityTotals.length > 0 && (
        <details className="rounded-2xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            📍 สรุปตามกิจกรรม ({activityTotals.length}) · {fmt(activityTotals.reduce((s, { list }) => s + sumJpy(list, thbPerJpy), 0))}
          </summary>
          <ul className="mt-2 divide-y divide-line/70">
            {activityTotals.map(({ a, list }) => (
              <li key={a.id} className="py-2 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{activityLabel(a.id)}</span>
                  <span className="shrink-0 font-semibold">{fmt(sumJpy(list, thbPerJpy))}</span>
                </div>
                <ul className="mt-0.5 space-y-0.5 pl-3 text-xs text-ink-soft">
                  {list.map((e) => (
                    <li key={e.id} className="flex gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {sourceOf(e).icon} {e.title}
                      </span>
                      <span className="shrink-0">{money(e.amount, e.currency)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------- List tab ----------

type ActivityGroup = { day: TripData["days"][number]; index: number; acts: TripData["activities"] };

function ExpenseList({
  data,
  unit,
  ordered,
  manualIds,
  name,
  activityLabel,
  activityGroups,
  onChange,
}: {
  data: TripData;
  unit: Currency;
  ordered: Expense[];
  manualIds: Set<string>;
  name: (id: string) => string;
  activityLabel: (id: string) => string;
  activityGroups: ActivityGroup[];
  onChange: (patch: Partial<TripData>) => void;
}) {
  const { members, expenses, thbPerJpy } = data;
  const { fmt, other } = unitFormat(unit, thbPerJpy);
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const paid = (e: Expense, id: string) => hasPaidShare(data, e, id);
  /** Settled for the chosen person, or for everyone in the split. */
  const settled = (e: Expense) =>
    person === "all" ? e.splitAmong.every((id) => paid(e, id)) : paid(e, person);

  const shown = ordered
    .filter((e) => person === "all" || e.splitAmong.includes(person))
    .filter((e) => status === "all" || (status === "paid" ? settled(e) : !settled(e)));

  // The chosen person's totals across everything they share in.
  const theirs = person === "all" ? [] : ordered.filter((e) => e.splitAmong.includes(person));
  const theirTotal = theirs.reduce((s, e) => s + toJpy({ ...e, amount: shareOf(e) }, thbPerJpy), 0);
  const theirPaid = theirs.filter((e) => paid(e, person)).reduce((s, e) => s + toJpy({ ...e, amount: shareOf(e) }, thbPerJpy), 0);

  const togglePaid = (e: Expense, id: string) => {
    const list = data.paidShares[e.id] ?? [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    const paidShares = { ...data.paidShares };
    if (next.length) paidShares[e.id] = next;
    else delete paidShares[e.id];
    onChange({ paidShares });
  };

  const removeExpense = (e: Expense) => {
    const paidShares = { ...data.paidShares };
    delete paidShares[e.id];
    onChange({ expenses: expenses.filter((x) => x.id !== e.id), paidShares });
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
      active ? "bg-ink text-white" : "bg-surface text-ink-soft hover:bg-baby hover:text-baby-ink"
    }`;

  return (
    <div className="space-y-3">
      {/* Filter: who has to pay */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="คนที่ต้องจ่าย">
        <button onClick={() => setPerson("all")} aria-pressed={person === "all"} className={chip(person === "all")}>
          👥 ทุกคน
        </button>
        {members.map((m) => (
          <button key={m.id} onClick={() => setPerson(m.id)} aria-pressed={person === m.id} className={chip(person === m.id)}>
            {m.emoji} {m.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" role="group" aria-label="สถานะการจ่าย">
        {(
          [
            ["all", "ทั้งหมด"],
            ["unpaid", "⏳ ยังจ่ายไม่ครบ"],
            ["paid", "✅ จ่ายครบแล้ว"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} aria-pressed={status === id} className={chip(status === id)}>
            {label}
          </button>
        ))}
      </div>

      {person !== "all" && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface/70 p-3 text-center">
          <div>
            <p className="text-[11px] text-ink-soft">ส่วนที่ต้องจ่าย</p>
            <p className="font-semibold">{fmt(theirTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-soft">จ่ายแล้ว</p>
            <p className="font-semibold text-done-ink">{fmt(theirPaid)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-soft">ค้างจ่าย</p>
            <p className={`font-semibold ${theirTotal - theirPaid > 0.5 ? "text-alert-ink" : "text-ink-soft"}`}>
              {fmt(Math.max(0, theirTotal - theirPaid))}
            </p>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">
          {ordered.length === 0 ? "ยังไม่มีรายการ — กด + ข้างหัวข้อเพื่อเพิ่ม" : "ไม่มีรายการที่ตรงกับตัวกรอง"}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => {
            const src = sourceOf(e);
            const isManual = manualIds.has(e.id);
            const activity = e.activityId ? activityById(data, e.activityId) : undefined;
            const booking = e.id.startsWith("booking-") && activity ? activePlace(activity).booking : undefined;
            const paidCount = e.splitAmong.filter((id) => paid(e, id)).length;
            const share = shareOf(e);
            return (
              <li key={e.id} className="rounded-2xl border border-line bg-white p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0">
                    {src.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{e.title}</p>
                    <p className="text-xs text-ink-soft">
                      {e.selfPaid ? "👥 จ่ายกันเอง" : `🙋 ${name(e.paidBy)} จ่ายแทนก่อน`} · หาร {e.splitAmong.length} คน
                      {e.date && ` · ${formatDate(e.date)}`}
                    </p>
                    {booking?.payment.priceType === "perPerson" && (
                      <p className="text-xs text-ink-soft">{paymentSummary(booking.payment)}</p>
                    )}
                    {!isManual && e.activityId && activityLabel(e.activityId) && (
                      <p className="truncate text-xs text-baby-ink">📍 {activityLabel(e.activityId)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{money(e.amount, e.currency)}</p>
                    <p className="text-[11px] text-ink-soft">
                      ≈ {e.currency === unit ? other(toJpy(e, thbPerJpy)) : fmt(toJpy(e, thbPerJpy))}
                    </p>
                  </div>
                  {isManual && <DeleteButton size="sm" label={`ลบ ${e.title}`} onConfirm={() => removeExpense(e)} />}
                </div>

                {/* Who has paid their share — tap to tick */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-ink-soft">
                    จ่ายแล้ว {paidCount}/{e.splitAmong.length} · คนละ {money(share, e.currency)}
                  </span>
                  {e.splitAmong.map((id) => {
                    const m = members.find((x) => x.id === id);
                    if (!m) return null;
                    const isPayer = !e.selfPaid && id === e.paidBy;
                    const done = paid(e, id);
                    const focus = person === id;
                    return isPayer ? (
                      <span
                        key={id}
                        title="คนจ่ายแทนก่อน"
                        className={`rounded-full bg-done px-2 py-0.5 text-[11px] font-medium text-done-ink ${focus ? "ring-2 ring-ink/40" : ""}`}
                      >
                        {m.emoji} {m.name} · ออกก่อน
                      </span>
                    ) : (
                      <button
                        key={id}
                        onClick={() => togglePaid(e, id)}
                        aria-pressed={done}
                        aria-label={`${m.name} ${done ? "จ่ายแล้ว" : "ยังไม่จ่าย"} — แตะเพื่อเปลี่ยน`}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                          done ? "bg-done text-done-ink" : "bg-alert text-alert-ink hover:brightness-95"
                        } ${focus ? "ring-2 ring-ink/40" : ""}`}
                      >
                        {m.emoji} {m.name} {done ? "✓" : "○"}
                      </button>
                    );
                  })}
                </div>

                {isManual ? (
                  <ActivitySelect
                    groups={activityGroups}
                    value={e.activityId && data.activities.some((a) => a.id === e.activityId) ? e.activityId : ""}
                    onChange={(id) =>
                      onChange({
                        expenses: expenses.map((x) => {
                          if (x.id !== e.id) return x;
                          const next: Expense = { ...x, activityId: id };
                          if (!id) delete next.activityId;
                          return next;
                        }),
                      })
                    }
                    ariaLabel={`กิจกรรมของ ${e.title}`}
                    className={`mt-2 max-w-full truncate rounded-lg border px-1.5 py-0.5 text-base sm:text-xs ${
                      e.activityId && data.activities.some((a) => a.id === e.activityId)
                        ? "border-baby-ink/30 bg-baby text-baby-ink"
                        : "border-dashed border-line bg-white text-ink-soft"
                    }`}
                    emptyLabel="🔗 ผูกกับกิจกรรม…"
                  />
                ) : (
                  <p className="mt-2 text-[11px] text-ink-soft">{src.hint}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const activityById = (data: TripData, id: string) => data.activities.find((a) => a.id === id);

// ---------- New expense ----------

function NewExpense({
  members,
  currentMemberId,
  activityGroups,
  onCancel,
  onAdd,
}: {
  members: Member[];
  currentMemberId?: string;
  activityGroups: ActivityGroup[];
  onCancel: () => void;
  onAdd: (e: Expense) => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("JPY");
  const [paidBy, setPaidBy] = useState(
    currentMemberId && members.some((m) => m.id === currentMemberId) ? currentMemberId : (members[0]?.id ?? ""),
  );
  const [split, setSplit] = useState<string[]>(members.map((m) => m.id));
  const [activityId, setActivityId] = useState("");
  const [selfPaid, setSelfPaid] = useState(false);
  const [error, setError] = useState("");

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const value = Number(amount);
    const splitAmong = split.filter((id) => members.some((m) => m.id === id));
    if (!title.trim()) return setError("ใส่ชื่อรายการก่อนนะ");
    if (!Number.isFinite(value) || value <= 0) return setError("จำนวนเงินต้องมากกว่า 0");
    if (!selfPaid && !members.some((m) => m.id === paidBy)) return setError("เลือกคนที่จ่ายแทนก่อน");
    if (splitAmong.length === 0) return setError("เลือกคนที่หารอย่างน้อย 1 คน");
    onAdd({
      id: uid(),
      title: title.trim(),
      amount: value,
      currency,
      paidBy: selfPaid ? "" : paidBy,
      splitAmong,
      ...(selfPaid && { selfPaid: true }),
      ...(activityId && { activityId }),
    });
  };

  return (
    <Modal title="ลงรายการใหม่" onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="exp-title">รายการ</label>
          <input
            id="exp-title"
            autoFocus
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น ราเมน Ichiran"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass} htmlFor="exp-amount">จำนวนเงิน</label>
            <input
              id="exp-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  className={`px-3 py-2 text-sm font-medium ${currency === c ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
                >
                  {c === "JPY" ? "¥ เยน" : "฿ บาท"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <PayerField id="exp-payer" selfPaid={selfPaid} paidBy={paidBy} members={members} onSelfPaid={setSelfPaid} onPaidBy={setPaidBy} />
        <div>
          <span className={labelClass}>หารกับใครบ้าง</span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = split.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={on}
                  onClick={() => setSplit((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
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
        <div>
          <label className={labelClass} htmlFor="exp-activity">กิจกรรม (ไม่บังคับ)</label>
          <ActivitySelect id="exp-activity" groups={activityGroups} value={activityId} onChange={setActivityId} className={inputClass} />
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

/** Activity picker grouped by day; "" means not linked. */
function ActivitySelect({
  id,
  groups,
  value,
  onChange,
  className,
  ariaLabel,
  emptyLabel = "— ไม่ผูกกับกิจกรรม —",
}: {
  id?: string;
  groups: ActivityGroup[];
  value: string;
  onChange: (id: string) => void;
  className: string;
  ariaLabel?: string;
  emptyLabel?: string;
}) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{emptyLabel}</option>
      {groups.map(({ day, index, acts }) =>
        acts.length === 0 ? null : (
          <optgroup key={day.id} label={`DAY ${index + 1} · ${formatDayTab(day.date)} · ${day.title}`}>
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.time} · {activePlace(a).title}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}
