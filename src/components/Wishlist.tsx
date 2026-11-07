"use client";

import { useReadOnly } from "./ReadOnly";
import { useState } from "react";
import {
  EMPTY_WISH,
  WISH_LEVELS,
  formatDayTab,
  hasGot,
  wishDoneFor,
  wishlistExpenses,
  uid,
  wishTotal,
  type Activity,
  type Currency,
  type Day,
  type Member,
  type WishItem,
  type WishLevel,
  type WishTag,
} from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { Progress } from "./Progress";
import { money } from "./Booking";
import { PayerField } from "./PayerField";
import { DeleteButton, IconButton } from "./Icons";

type Draft = Omit<WishItem, "id"> & { id?: string };

const levelOf = (l: WishLevel) => WISH_LEVELS.find((x) => x.id === l)!;

function priceText(w: Pick<WishItem, "price" | "priceType" | "wantedBy" | "currency">): string {
  const total = wishTotal(w);
  if (w.priceType === "perPerson" && w.wantedBy.length > 1)
    return `${money(w.price, w.currency)}/person × ${w.wantedBy.length} = ${money(total, w.currency)}`;
  return money(total, w.currency);
}

export function Wishlist({
  items,
  tags,
  members,
  days,
  activities,
  currentMemberId,
  onSaveItem,
  onDeleteItem,
  onSaveTag,
  onDeleteTag,
}: {
  items: WishItem[];
  tags: WishTag[];
  members: Member[];
  days: Day[];
  activities: Activity[];
  currentMemberId: string;
  onSaveItem: (w: WishItem) => void;
  onDeleteItem: (id: string) => void;
  onSaveTag: (t: WishTag) => void;
  /** Removes the tag and strips it from every item. */
  onDeleteTag: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [hideGot, setHideGot] = useState(false);
  const [managingTags, setManagingTags] = useState(false);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const dayIndex = new Map(days.map((d, i) => [d.id, i]));
  const activityById = new Map(activities.map((a) => [a.id, a]));

  const me = memberById.get(currentMemberId);
  const myWants = items.filter((w) => w.wantedBy.includes(currentMemberId));
  const myGot = myWants.filter((w) => hasGot(w, currentMemberId)).length;
  const expenses = wishlistExpenses({ wishlist: items });
  const spentByCurrency = (c: Currency) => expenses.filter((e) => e.currency === c).reduce((s, e) => s + e.amount, 0);
  const done = (w: WishItem) => wishDoneFor(w, currentMemberId);

  const shown = items
    .filter((w) => tagFilter === "all" || w.tags.includes(tagFilter))
    .filter((w) => personFilter === "all" || w.wantedBy.includes(personFilter))
    .filter((w) => !hideGot || !done(w))
    // Not-yet-got (for this profile) first, then most wanted, then by name.
    .sort((a, b) => Number(done(a)) - Number(done(b)) || b.level - a.level || a.name.localeCompare(b.name));

  /** Tick/untick one person's item; the payer is that person (pay own) or whoever is signed in (paying for them). */
  const toggleGot = (w: WishItem, memberId: string) => {
    const gotBy = { ...w.gotBy };
    if (memberId in gotBy) delete gotBy[memberId];
    else gotBy[memberId] = w.selfPaid ? memberId : currentMemberId;
    onSaveItem({ ...w, gotBy });
  };

  const openNew = () =>
    setDraft({ ...EMPTY_WISH, wantedBy: members.some((m) => m.id === currentMemberId) ? [currentMemberId] : [] });

  return (
    <section aria-label="Wishlist" className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
          <p className="text-xs text-ink-soft">🛍️ Wishlist</p>
          <p className="mt-0.5 text-2xl font-bold">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
          <p className="text-xs text-ink-soft">✅ {me ? `${me.emoji} My` : "My"} got</p>
          <p className="mt-0.5 text-2xl font-bold">
            {myGot}/{myWants.length}
          </p>
          <Progress done={myGot} total={myWants.length} className="mt-1 [&>span]:hidden" />
        </div>
        <div className="col-span-2 rounded-2xl border border-line bg-white p-3 shadow-sm sm:col-span-1">
          <p className="text-xs text-ink-soft">💴 Spent (in Budget)</p>
          <p className="mt-0.5 text-2xl font-bold">
            {money(spentByCurrency("JPY"), "JPY")}
            {spentByCurrency("THB") > 0 && <span className="ml-2 text-base">+ {money(spentByCurrency("THB"), "THB")}</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={tagFilter === "all"} onClick={() => setTagFilter("all")}>
            All
          </FilterChip>
          {tags.map((t) => (
            <FilterChip key={t.id} active={tagFilter === t.id} onClick={() => setTagFilter(t.id)}>
              {t.icon} {t.label}
            </FilterChip>
          ))}
          <IconButton
            icon={managingTags ? "close" : "edit"}
            label={managingTags ? "Close tag editor" : "Edit tags"}
            onClick={() => setManagingTags((v) => !v)}
            aria-expanded={managingTags}
          />
        </div>
        {managingTags && <TagManager tags={tags} items={items} onSave={onSaveTag} onDelete={onDeleteTag} />}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            aria-label="Filter by person"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface/60 px-3 py-1.5 text-base sm:text-sm"
          >
            <option value="all">👥 Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.name} wants
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-ink-soft">
            <input type="checkbox" checked={hideGot} onChange={(e) => setHideGot(e.target.checked)} className="h-4 w-4" />
            Hide got
          </label>
          <IconButton icon="add" label="Add wish" onClick={openNew} className="ml-auto" />
        </div>
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">
          {items.length === 0 ? "No wishes yet — tap + to add one" : "Nothing matches these filters"}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((w) => {
            const activity = activityById.get(w.activityId);
            const di = activity ? dayIndex.get(activity.dayId) : undefined;
            const payers = [...new Set(Object.values(w.gotBy))]
              .map((id) => memberById.get(id))
              .filter((m): m is Member => Boolean(m));
            return (
              <WishRow
                key={w.id}
                item={w}
                tags={w.tags.map((id) => tagById.get(id)).filter((t): t is WishTag => Boolean(t))}
                wanters={w.wantedBy.map((id) => memberById.get(id)).filter((m): m is Member => Boolean(m))}
                where={
                  activity && di !== undefined
                    ? `DAY ${di + 1} · ${formatDayTab(days[di].date)} · ${activity.time} · ${activity.title}`
                    : ""
                }
                currentMemberId={currentMemberId}
                payers={payers.map((m) => m.emoji).join(" ")}
                onToggleGot={(memberId) => toggleGot(w, memberId)}
                onEdit={() => setDraft(w)}
                onDelete={() => onDeleteItem(w.id)}
              />
            );
          })}
        </ul>
      )}

      {draft && (
        <WishForm
          draft={draft}
          tags={tags}
          members={members}
          days={days}
          activities={activities}
          currentMemberId={currentMemberId}
          onCancel={() => setDraft(null)}
          onSubmit={(w) => {
            onSaveItem(w);
            setDraft(null);
          }}
        />
      )}
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-ink text-white" : "bg-surface text-ink-soft hover:bg-baby hover:text-baby-ink"
      }`}
    >
      {children}
    </button>
  );
}

function WishRow({
  item: w,
  tags,
  wanters,
  where,
  currentMemberId,
  payers,
  onToggleGot,
  onEdit,
  onDelete,
}: {
  item: WishItem;
  tags: WishTag[];
  wanters: Member[];
  where: string;
  currentMemberId: string;
  /** Emoji of everyone who paid so far. */
  payers: string;
  onToggleGot: (memberId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const level = levelOf(w.level);
  const iWant = w.wantedBy.includes(currentMemberId);
  const done = wishDoneFor(w, currentMemberId);
  const gotCount = wanters.filter((m) => hasGot(w, m.id)).length;
  const readOnly = useReadOnly();
  return (
    <li className={`rounded-2xl border p-3 shadow-sm transition ${done ? "border-done-ink/25 bg-done/30" : "border-line bg-white"}`}>
      <div className="flex items-start gap-3">
        {iWant ? (
          <input
            type="checkbox"
            checked={hasGot(w, currentMemberId)}
            onChange={() => onToggleGot(currentMemberId)}
            aria-label={`I got ${w.name}`}
            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-done-ink"
          />
        ) : (
          <span aria-hidden title="Not on your list" className="mt-0.5 w-5 shrink-0 text-center text-sm text-ink-soft">
            ·
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`font-medium ${done ? "text-ink-soft line-through" : ""}`}>{w.name}</p>
            <span title={level.label} className="text-xs">
              {level.stars}
            </span>
            {wanters.length > 1 && gotCount > 0 && (
              <span className="text-[11px] text-ink-soft">
                {gotCount}/{wanters.length} got
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {tags.map((t) => (
              <span key={t.id} className="rounded-full bg-surface px-2 py-0.5 text-ink-soft">
                {t.icon} {t.label}
              </span>
            ))}
          </div>

          {/* Each person's status — tap to tick for a friend you bought it for. */}
          {wanters.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {wanters.map((m) => {
                const got = hasGot(w, m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => onToggleGot(m.id)}
                    disabled={readOnly}
                    aria-pressed={got}
                    aria-label={`${m.name}: ${got ? "got" : "not yet"}`}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      got ? "bg-done text-done-ink" : "bg-surface text-ink-soft hover:bg-baby"
                    } ${m.id === currentMemberId ? "ring-1 ring-ink/30" : ""}`}
                  >
                    {m.emoji} {m.name} {got ? "✓" : "○"}
                  </button>
                );
              })}
            </div>
          )}

          {where && <p className="mt-1 truncate text-xs text-baby-ink">📍 {where}</p>}
          {w.note && <p className="mt-1 text-sm text-ink-soft">{w.note}</p>}
          {w.price > 0 && (
            <p className="mt-1 text-xs">
              💴 {priceText(w)}
              {w.selfPaid ? (
                <span className="text-ink-soft"> · 👥 จ่ายกันเอง</span>
              ) : (
                payers && <span className="text-ink-soft"> · 🙋 {payers} จ่ายแทนก่อน</span>
              )}
            </p>
          )}
          {gotCount > 0 && w.price === 0 && <p className="mt-1 text-[11px] text-ink-soft">Add a price to include it in Budget</p>}
        </div>
        <span className="flex shrink-0 items-center gap-0.5">
          <IconButton icon="edit" label={`Edit ${w.name}`} onClick={onEdit} />
          <DeleteButton label={`Delete ${w.name}`} onConfirm={onDelete} />
        </span>
      </div>
    </li>
  );
}

function TagManager({
  tags,
  items,
  onSave,
  onDelete,
}: {
  tags: WishTag[];
  items: WishItem[];
  onSave: (t: WishTag) => void;
  onDelete: (id: string) => void;
}) {
  const [icon, setIcon] = useState("🏷️");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) return setError("Enter a tag name");
    if (tags.some((t) => t.label.trim().toLowerCase() === name.toLowerCase())) return setError("This tag already exists");
    onSave({ id: uid(), label: name, icon: icon.trim() || "🏷️" });
    setLabel("");
    setError("");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface/50 p-3">
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const used = items.filter((w) => w.tags.includes(t.id)).length;
          return (
            <li key={t.id} className="flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-xs shadow-sm">
              {t.icon} {t.label}
              <span className="text-ink-soft">· {used}</span>
              <DeleteButton
                size="sm"
                label={used > 0 ? `Delete tag ${t.label} (removed from ${used})` : `Delete tag ${t.label}`}
                onConfirm={() => onDelete(t.id)}
              />
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label="Tag emoji"
          maxLength={8}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className={`${inputClass} w-14 shrink-0 text-center`}
        />
        <input
          aria-label="New tag name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="New tag e.g. ขนม, ของเล่น"
          className={inputClass}
        />
        <IconButton type="submit" icon="add" label="Add tag" className="self-center" />
      </form>
      {error && <p className="text-[11px] text-alert-ink">{error}</p>}
    </div>
  );
}

function WishForm({
  draft,
  tags,
  members,
  days,
  activities,
  currentMemberId,
  onCancel,
  onSubmit,
}: {
  draft: Draft;
  tags: WishTag[];
  members: Member[];
  days: Day[];
  activities: Activity[];
  currentMemberId: string;
  onCancel: () => void;
  onSubmit: (w: WishItem) => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = (k: "tags" | "wantedBy", id: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));

  // Activities grouped by day, in trip order, for the "where to buy" picker.
  const options = days.map((d, i) => ({
    day: d,
    index: i,
    acts: activities.filter((a) => a.dayId === d.id).sort((a, b) => a.time.localeCompare(b.time)),
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError("Enter the item name");
    if (form.wantedBy.length === 0) return setError("Select at least 1 person who wants it");
    // Drop "got" entries for people no longer on the list.
    // Drop people no longer on the list; when everyone pays their own, each person is their own payer.
    const gotBy = Object.fromEntries(
      Object.entries(form.gotBy)
        .filter(([id]) => form.wantedBy.includes(id))
        .map(([id, payer]) => [id, form.selfPaid ? id : payer]),
    );
    onSubmit({ ...form, gotBy, id: form.id ?? uid(), name, note: form.note.trim() });
  };

  return (
    <Modal title={draft.id ? "Edit wish" : "Add wish"} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="wish-name">Item</label>
          <input
            id="wish-name"
            autoFocus
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Tokyo Banana, กันแดด Anessa"
          />
        </div>

        <div>
          <span className={labelClass}>Wish level</span>
          <div role="radiogroup" aria-label="Wish level" className="grid grid-cols-3 gap-1.5">
            {WISH_LEVELS.map((l) => (
              <button
                type="button"
                key={l.id}
                role="radio"
                aria-checked={form.level === l.id}
                onClick={() => set("level", l.id)}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                  form.level === l.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:bg-surface"
                }`}
              >
                <span className="block">{l.stars}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Type</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = form.tags.includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  aria-pressed={on}
                  onClick={() => toggleIn("tags", t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    on ? "bg-baby text-baby-ink ring-1 ring-baby-ink/30" : "bg-surface text-ink-soft"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              );
            })}
            {tags.length === 0 && <p className="text-xs text-ink-soft">No tags — add some with the pencil next to the tag filters</p>}
          </div>
        </div>

        <div>
          <span className={labelClass}>Who wants it</span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = form.wantedBy.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={on}
                  onClick={() => toggleIn("wantedBy", m.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    on ? "bg-baby text-baby-ink" : "bg-surface text-ink-soft"
                  }`}
                >
                  {m.emoji} {m.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="wish-activity">Where to buy (optional)</label>
          <select
            id="wish-activity"
            className={inputClass}
            value={form.activityId}
            onChange={(e) => set("activityId", e.target.value)}
          >
            <option value="">— Not linked to an activity —</option>
            {options.map(({ day, index, acts }) =>
              acts.length === 0 ? null : (
                <optgroup key={day.id} label={`DAY ${index + 1} · ${formatDayTab(day.date)} · ${day.title}`}>
                  {acts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.time} · {a.title}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="wish-note">Note</label>
          <textarea
            id="wish-note"
            rows={2}
            className={inputClass}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Size, colour, flavour, link…"
          />
        </div>

        <div className="space-y-3 rounded-2xl bg-surface/60 p-3">
          <div>
            <span className={labelClass}>Price is</span>
            <div role="radiogroup" aria-label="Price type" className="flex overflow-hidden rounded-xl border border-line text-sm">
              {(
                [
                  ["perPerson", "Per person"],
                  ["total", "Total (not split yet)"],
                ] as const
              ).map(([t, label]) => (
                <button
                  type="button"
                  key={t}
                  role="radio"
                  aria-checked={form.priceType === t}
                  onClick={() => set("priceType", t)}
                  className={`flex-1 px-3 py-2 font-medium transition ${form.priceType === t ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass} htmlFor="wish-price">
                {form.priceType === "perPerson" ? "Price per person" : "Total price"}
              </label>
              <input
                id="wish-price"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className={inputClass}
                value={form.price || ""}
                onChange={(e) => set("price", Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <span className={labelClass}>Currency</span>
              <div className="flex overflow-hidden rounded-xl border border-line">
                {(["JPY", "THB"] as Currency[]).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => set("currency", c)}
                    aria-pressed={form.currency === c}
                    className={`px-3 py-2 text-sm font-medium ${form.currency === c ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
                  >
                    {c === "JPY" ? "¥" : "฿"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.price > 0 && <p className="text-xs font-medium">= {priceText(form)}</p>}

          <PayerField
            id="wish-pay"
            selfPaid={form.selfPaid}
            paidBy=""
            members={members}
            onSelfPaid={(v) => set("selfPaid", v)}
            onPaidBy={() => {}}
            hidePayer
          />
          {form.wantedBy.length > 0 && (
            <div>
              <span className={labelClass}>✅ Who got it (adds to Budget when it has a price)</span>
              <ul className="space-y-1.5">
                {form.wantedBy.map((id) => {
                  const m = members.find((x) => x.id === id);
                  if (!m) return null;
                  const payer = form.gotBy[id];
                  const got = payer !== undefined;
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex min-w-28 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={got}
                          onChange={() =>
                            setForm((f) => {
                              const gotBy = { ...f.gotBy };
                              if (got) delete gotBy[id];
                              else gotBy[id] = f.selfPaid ? id : currentMemberId;
                              return { ...f, gotBy };
                            })
                          }
                          className="h-4 w-4"
                        />
                        {m.emoji} {m.name}
                      </label>
                      {got && !form.selfPaid && (
                        <select
                          aria-label={`Who paid for ${m.name}`}
                          value={payer}
                          onChange={(e) => setForm((f) => ({ ...f, gotBy: { ...f.gotBy, [id]: e.target.value } }))}
                          className="rounded-lg border border-line bg-white px-2 py-1 text-base sm:text-xs"
                        >
                          {members.map((p) => (
                            <option key={p.id} value={p.id}>
                              paid by {p.emoji} {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {error && <p className="rounded-xl bg-alert/60 px-3 py-2 text-sm text-alert-ink">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
