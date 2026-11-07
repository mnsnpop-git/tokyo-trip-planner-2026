"use client";

import { useState } from "react";
import {
  EMPTY_CHECKLIST_COST,
  baht,
  checklistRemaining,
  uid,
  yen,
  type ChecklistCost,
  type ChecklistItem,
  type Currency,
  type Member,
} from "@/lib/trip";
import { mergeOrder, useDragReorder } from "@/lib/useDragReorder";
import { Modal, inputClass, labelClass } from "./Modal";
import { Progress } from "./Progress";
import { PayerField } from "./PayerField";
import { DeleteButton, IconButton } from "./Icons";

type Draft = Omit<ChecklistItem, "id"> & { id?: string };

const money = (n: number, c: Currency) => (c === "JPY" ? yen(n) : baht(n));

/**
 * Packing / to-prepare list. Each item lists who needs to prepare it; everyone can look at
 * a friend's list, but only the signed-in profile can tick or untick their own items.
 */
export function Checklist({
  items,
  members,
  currentMemberId,
  onChange,
}: {
  items: ChecklistItem[];
  members: Member[];
  currentMemberId: string;
  onChange: (items: ChecklistItem[]) => void;
}) {
  // Whose list is shown: a member id, or "all".
  const [viewing, setViewing] = useState<string>(currentMemberId);
  const [hideDone, setHideDone] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const viewed = viewing === "all" ? null : (memberById.get(viewing) ?? null);
  const isMine = viewing === currentMemberId;
  const isDone = (item: ChecklistItem, id: string) => item.doneBy.includes(id);
  const listOf = (id: string) => items.filter((i) => i.assignees.includes(id));

  const visible = items
    .filter((i) => !viewed || i.assignees.includes(viewed.id))
    .filter((i) => !hideDone || !(viewed ? isDone(i, viewed.id) : i.assignees.every((id) => isDone(i, id))));
  const { order, draggingId, start, move } = useDragReorder(
    visible.map((i) => i.id),
    (ids) => onChange(mergeOrder(items, ids)),
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order.map((id) => byId.get(id)).filter((i): i is ChecklistItem => Boolean(i));

  const toggleMine = (item: ChecklistItem) =>
    onChange(
      items.map((i) =>
        i.id !== item.id
          ? i
          : {
              ...i,
              doneBy: isDone(i, currentMemberId) ? i.doneBy.filter((x) => x !== currentMemberId) : [...i.doneBy, currentMemberId],
            },
      ),
    );

  const save = (d: Draft) => {
    const item: ChecklistItem = { ...d, id: d.id ?? uid() };
    onChange(items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]);
    setDraft(null);
  };

  const myItems = listOf(currentMemberId);
  const myDone = myItems.filter((i) => isDone(i, currentMemberId)).length;

  return (
    <section aria-label="ของที่ต้องเตรียม" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">🎒 ของที่ต้องเตรียม</h2>
        <IconButton
          icon="add"
          label="เพิ่มรายการ"
          onClick={() =>
            setDraft({ label: "", note: "", assignees: viewed ? [viewed.id] : members.map((m) => m.id), doneBy: [], cost: null })
          }
        />
        <span className="ml-auto text-sm text-ink-soft">
          ของฉัน {myDone}/{myItems.length}
        </span>
      </div>
      <Progress done={myDone} total={myItems.length} className="mb-3" />

      {/* Whose list */}
      <div role="tablist" aria-label="ดูรายการของ" className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {members.map((m) => {
          const list = listOf(m.id);
          const n = list.filter((i) => isDone(i, m.id)).length;
          const all = list.length > 0 && n === list.length;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={viewing === m.id}
              onClick={() => setViewing(m.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                viewing === m.id ? "bg-ink text-white" : all ? "bg-done text-done-ink" : "bg-surface text-ink-soft hover:bg-baby"
              }`}
            >
              {m.emoji} {m.id === currentMemberId ? "ของฉัน" : m.name} {n}/{list.length}
              {all && " ✓"}
            </button>
          );
        })}
        <button
          role="tab"
          aria-selected={viewing === "all"}
          onClick={() => setViewing("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            viewing === "all" ? "bg-ink text-white" : "bg-surface text-ink-soft hover:bg-baby"
          }`}
        >
          👥 ทั้งหมด {items.length}
        </button>
      </div>

      {viewed && !isMine && (
        <p className="mb-3 rounded-xl bg-surface px-3 py-2 text-xs text-ink-soft">
          👀 กำลังดูของ {viewed.emoji} {viewed.name} — ติ๊กแทนเพื่อนไม่ได้
        </p>
      )}

      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="h-4 w-4" />
        ซ่อนที่ทำแล้ว
      </label>

      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-5 text-center text-sm text-ink-soft">
          {hideDone && visible.length === 0 && items.length > 0 ? "ทำครบแล้ว 🎉" : "ยังไม่มีรายการ — กด + ข้างหัวข้อเพื่อเพิ่ม"}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((item) => {
            // Whose tick the checkbox shows: the viewed member, or me in the "all" view.
            const owner = viewed?.id ?? currentMemberId;
            const ownerAssigned = item.assignees.includes(owner);
            const checked = isDone(item, owner);
            const canTick = owner === currentMemberId && ownerAssigned;
            const assignees = item.assignees.map((id) => memberById.get(id)).filter((m): m is Member => Boolean(m));
            const c = item.cost;
            return (
              <li
                key={item.id}
                data-reorder-id={item.id}
                className={`flex items-start gap-2 rounded-xl border px-2 py-2 transition ${
                  draggingId === item.id ? "scale-[1.02] border-baby-ink/40 bg-white shadow-lg" : "border-transparent hover:bg-surface/70"
                }`}
              >
                <button
                  onPointerDown={(e) => start(e, item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(item.id, e.key === "ArrowUp" ? -1 : 1);
                    }
                  }}
                  aria-label={`ลากเพื่อย้าย ${item.label} (หรือกด ↑/↓)`}
                  className="mt-0.5 flex h-6 w-5 shrink-0 cursor-grab touch-none select-none items-center justify-center text-ink-soft/50 hover:text-ink-soft active:cursor-grabbing"
                >
                  ⋮⋮
                </button>
                {ownerAssigned ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canTick}
                    onChange={() => toggleMine(item)}
                    aria-label={`${item.label}: ${checked ? "ทำแล้ว" : "ยังไม่ทำ"}`}
                    title={canTick ? undefined : "ติ๊กได้เฉพาะของตัวเอง"}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-done-ink disabled:opacity-60"
                  />
                ) : (
                  <span aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${checked && ownerAssigned ? "text-ink-soft line-through" : ""}`}>{item.label}</p>
                  {item.note && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{item.note}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {/* Everyone's status — view only */}
                    {assignees.map((m) => (
                      <span
                        key={m.id}
                        title={`${m.name}: ${isDone(item, m.id) ? "ทำแล้ว" : "ยังไม่ทำ"}`}
                        className={`rounded-full px-1.5 py-0.5 ${
                          isDone(item, m.id) ? "bg-done text-done-ink" : "bg-surface text-ink-soft"
                        }`}
                      >
                        {m.emoji}
                        {isDone(item, m.id) ? "✓" : "○"}
                      </span>
                    ))}
                    {c && c.amount > 0 && (
                      <span className={`rounded-full px-2 py-0.5 font-medium ${c.fullyPaid ? "bg-done text-done-ink" : "bg-alert text-alert-ink"}`}>
                        {c.fullyPaid
                          ? `💴 จ่ายครบ ${money(c.amount, c.currency)}${c.selfPaid ? " · จ่ายกันเอง" : ""}`
                          : `💴 ${money(c.amount, c.currency)} · เหลือ ${money(checklistRemaining(c), c.currency)}`}
                      </span>
                    )}
                  </div>
                </div>

                <span className="flex shrink-0 items-center gap-0.5">
                  <IconButton icon="edit" label={`แก้ไข ${item.label}`} onClick={() => setDraft(item)} />
                  <DeleteButton label={`ลบ ${item.label}`} onConfirm={() => onChange(items.filter((i) => i.id !== item.id))} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-ink-soft">⋮⋮ ลากเพื่อจัดลำดับ · ติ๊กได้เฉพาะของตัวเอง ดูของเพื่อนได้</p>

      {draft && (
        <ChecklistForm draft={draft} members={members} currentMemberId={currentMemberId} onCancel={() => setDraft(null)} onSubmit={save} />
      )}
    </section>
  );
}

function ChecklistForm({
  draft,
  members,
  currentMemberId,
  onCancel,
  onSubmit,
}: {
  draft: Draft;
  members: Member[];
  currentMemberId: string;
  onCancel: () => void;
  onSubmit: (d: Draft) => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [error, setError] = useState("");
  const c = form.cost;
  const setCost = <K extends keyof ChecklistCost>(k: K, v: ChecklistCost[K]) =>
    setForm((f) => (f.cost ? { ...f, cost: { ...f.cost, [k]: v } } : f));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) return setError("ใส่ชื่อรายการก่อนนะ");
    if (form.assignees.length === 0) return setError("เลือกคนที่ต้องเตรียมอย่างน้อย 1 คน");
    if (c) {
      if (!(c.amount > 0)) return setError("ใส่ราคารวม (มากกว่า 0)");
      if (c.splitAmong.length === 0) return setError("เลือกคนหารอย่างน้อย 1 คน");
      if (!c.selfPaid && !members.some((m) => m.id === c.paidBy)) return setError("เลือกคนที่จ่ายแทนก่อน");
      if (c.deposit > c.amount) return setError("มัดจำต้องไม่เกินราคารวม");
    }
    onSubmit({
      ...form,
      label,
      note: form.note.trim(),
      // Someone no longer assigned can't still be "done".
      doneBy: form.doneBy.filter((id) => form.assignees.includes(id)),
    });
  };

  const share = c && c.splitAmong.length > 0 ? c.amount / c.splitAmong.length : 0;

  return (
    <Modal title={draft.id ? "แก้ไขรายการ" : "เพิ่มรายการ"} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="chk-label">ชื่อรายการ</label>
          <input
            id="chk-label"
            autoFocus
            className={inputClass}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="เช่น 📷 เช่ากล้อง, 🛂 Passport"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="chk-note">รายละเอียด</label>
          <textarea
            id="chk-note"
            rows={3}
            className={inputClass}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="ร้านไหน, รับ-คืนเมื่อไหร่, ต้องเตรียมอะไรบ้าง…"
          />
        </div>
        <div>
          <span className={labelClass}>คนที่ต้องเตรียม</span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = form.assignees.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={on}
                  onClick={() => setForm((f) => ({ ...f, assignees: toggle(f.assignees, m.id) }))}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-baby text-baby-ink" : "bg-surface text-ink-soft"}`}
                >
                  {m.emoji} {m.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, assignees: members.map((m) => m.id) }))}
              className="rounded-full px-2.5 py-1 text-xs text-ink-soft underline-offset-2 hover:underline"
            >
              ทุกคน
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-surface/60 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(c)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cost: e.target.checked
                    ? {
                        ...EMPTY_CHECKLIST_COST,
                        splitAmong: f.assignees.length ? f.assignees : members.map((m) => m.id),
                        paidBy: currentMemberId,
                      }
                    : null,
                }))
              }
              className="h-4 w-4"
            />
            💴 มีค่าใช้จ่าย (เช่น เช่ากล้อง, ซื้อ eSIM)
          </label>

          {c && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelClass} htmlFor="chk-amount">ราคารวม</label>
                  <input
                    id="chk-amount"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className={inputClass}
                    value={c.amount || ""}
                    onChange={(e) => setCost("amount", Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <span className={labelClass}>สกุลเงิน</span>
                  <div className="flex overflow-hidden rounded-xl border border-line">
                    {(["JPY", "THB"] as Currency[]).map((cur) => (
                      <button
                        type="button"
                        key={cur}
                        onClick={() => setCost("currency", cur)}
                        aria-pressed={c.currency === cur}
                        className={`px-3 py-2 text-sm font-medium ${c.currency === cur ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
                      >
                        {cur === "JPY" ? "¥" : "฿"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className={labelClass}>หารเท่ากับ</span>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = c.splitAmong.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        aria-pressed={on}
                        onClick={() => setCost("splitAmong", toggle(c.splitAmong, m.id))}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          on ? "bg-baby text-baby-ink" : "bg-white text-ink-soft line-through"
                        }`}
                      >
                        {m.emoji} {m.name}
                      </button>
                    );
                  })}
                </div>
                {share > 0 && <p className="mt-1 text-xs text-ink-soft">= คนละ {money(share, c.currency)}</p>}
              </div>

              <PayerField
                id="chk-payer"
                selfPaid={c.selfPaid}
                paidBy={c.paidBy}
                members={members}
                onSelfPaid={(v) => setCost("selfPaid", v)}
                onPaidBy={(v) => setCost("paidBy", v)}
              />

              <div>
                <div>
                  <label className={labelClass} htmlFor="chk-deposit">มัดจำแล้ว</label>
                  <input
                    id="chk-deposit"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    disabled={c.fullyPaid}
                    className={`${inputClass} disabled:opacity-50`}
                    value={c.deposit || ""}
                    onChange={(e) => setCost("deposit", Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span className="text-ink-soft">เหลือจ่าย</span>
                <span className={`font-semibold ${checklistRemaining(c) > 0 ? "text-alert-ink" : "text-done-ink"}`}>
                  {money(checklistRemaining(c), c.currency)}
                </span>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={c.fullyPaid} onChange={(e) => setCost("fullyPaid", e.target.checked)} className="h-4 w-4" />
                ✅ จ่ายครบแล้ว (ขึ้นใน Budget อัตโนมัติ)
              </label>
            </>
          )}
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
