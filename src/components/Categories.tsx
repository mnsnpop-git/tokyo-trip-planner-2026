"use client";

import { useState } from "react";
import {
  CATEGORY_COLORS,
  categoryBadge,
  uid,
  type Activity,
  type Category,
  type CategoryColor,
} from "@/lib/trip";
import { inputClass, labelClass } from "./Modal";
import { IconButton } from "./Icons";

export function Categories({
  categories,
  activities,
  onSave,
  onDelete,
}: {
  categories: Category[];
  activities: Activity[];
  onSave: (c: Category) => void;
  onDelete: (id: string, moveTo: string) => void;
}) {
  // Only one row is edited or being deleted at a time; "new" is the add form.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const usage = (id: string) => activities.filter((a) => a.category === id).length;
  const labelTaken = (label: string, exceptId?: string) =>
    categories.some((c) => c.id !== exceptId && c.label.trim().toLowerCase() === label.trim().toLowerCase());

  const startEdit = (id: string) => {
    setDeleting(null);
    setEditing(id);
  };
  const startDelete = (id: string) => {
    setEditing(null);
    setDeleting(id);
  };

  return (
    <section aria-label="ประเภทกิจกรรม" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">ประเภทกิจกรรม</h2>
        <IconButton icon="add" label="เพิ่มประเภท" onClick={() => startEdit("new")} disabled={editing === "new"} />
        <span className="ml-auto text-sm text-ink-soft">{categories.length} ประเภท</span>
      </div>

      <ul className="space-y-1">
        {categories.map((c) => {
          const count = usage(c.id);
          if (editing === c.id) {
            return (
              <li key={c.id}>
                <CategoryEditor
                  initial={c}
                  labelTaken={(label) => labelTaken(label, c.id)}
                  onCancel={() => setEditing(null)}
                  onSave={(next) => {
                    onSave(next);
                    setEditing(null);
                  }}
                />
              </li>
            );
          }
          return (
            <li key={c.id} className="rounded-xl px-2 py-1.5 hover:bg-surface/70">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(c.id)}
                  title="แตะเพื่อแก้ไขชื่อ, emoji, สี"
                  className={`truncate rounded-full px-3 py-1 text-sm font-medium transition hover:ring-2 hover:ring-ink/15 ${categoryBadge(c)}`}
                >
                  {c.icon} {c.label}
                </button>
                <span className="shrink-0 text-xs text-ink-soft">{count} กิจกรรม</span>
                <span className="ml-auto flex shrink-0 gap-0.5">
                  <IconButton icon="edit" label={`แก้ไขประเภท ${c.label}`} onClick={() => startEdit(c.id)} />
                  <IconButton
                    icon="delete"
                    label={`ลบประเภท ${c.label}`}
                    title={categories.length <= 1 ? "ต้องมีอย่างน้อย 1 ประเภท" : `ลบประเภท ${c.label}`}
                    onClick={() => startDelete(c.id)}
                    disabled={categories.length <= 1}
                  />
                </span>
              </div>
              {deleting === c.id && (
                <DeleteConfirm
                  category={c}
                  count={count}
                  others={categories.filter((x) => x.id !== c.id)}
                  onCancel={() => setDeleting(null)}
                  onConfirm={(moveTo) => {
                    onDelete(c.id, moveTo);
                    setDeleting(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>

      {editing === "new" && (
        <div className="mt-3">
          <CategoryEditor
            initial={{ id: uid(), label: "", icon: "🏷️", color: "baby" }}
            labelTaken={(label) => labelTaken(label)}
            onCancel={() => setEditing(null)}
            onSave={(c) => {
              onSave(c);
              setEditing(null);
            }}
          />
        </div>
      )}
    </section>
  );
}

const EMOJI_PRESETS = [
  "⛩️", "🏯", "🗻", "🌸", "🍜", "🍣", "🍡", "☕", "🧋", "🍺",
  "🛍️", "🎁", "🚗", "🚄", "✈️", "🏨", "📸", "♨️", "🎢", "🎮",
  "🎤", "🏞️", "❄️", "🏷️",
];

function CategoryEditor({
  initial,
  labelTaken,
  onSave,
  onCancel,
}: {
  initial: Category;
  labelTaken: (label: string) => boolean;
  onSave: (c: Category) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState<Category>(initial);
  const [error, setError] = useState("");
  const isNew = !initial.label;
  const icon = c.icon.trim() || "🏷️";
  const idp = `cat-${initial.id}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = c.label.trim();
    if (!label) return setError("ใส่ชื่อประเภทก่อนนะ");
    if (labelTaken(label)) return setError("มีประเภทชื่อนี้แล้ว");
    onSave({ ...c, label, icon });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={isNew ? "เพิ่มประเภทใหม่" : `แก้ไขประเภท ${initial.label}`}
      className="space-y-4 rounded-2xl border border-baby-ink/30 bg-surface/60 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{isNew ? "เพิ่มประเภทใหม่" : "แก้ไขประเภท"}</p>
        <span className={`truncate rounded-full px-3 py-1 text-sm font-medium ${categoryBadge(c)}`}>
          {icon} {c.label.trim() || "ชื่อประเภท"}
        </span>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${idp}-label`}>ชื่อประเภท</label>
        <input
          id={`${idp}-label`}
          autoFocus
          className={inputClass}
          value={c.label}
          onChange={(e) => setC({ ...c, label: e.target.value })}
          placeholder="เช่น Onsen, Café"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${idp}-icon`}>Emoji (เลือกด้านล่าง หรือพิมพ์เอง)</label>
        <input
          id={`${idp}-icon`}
          className={`${inputClass} w-20 text-center text-lg`}
          value={c.icon}
          maxLength={8}
          onChange={(e) => setC({ ...c, icon: e.target.value })}
        />
        <div role="group" aria-label="emoji แนะนำ" className="mt-2 flex flex-wrap gap-1">
          {EMOJI_PRESETS.map((em) => (
            <button
              type="button"
              key={em}
              onClick={() => setC({ ...c, icon: em })}
              aria-label={`ใช้ ${em}`}
              aria-pressed={icon === em}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                icon === em ? "bg-white shadow ring-2 ring-baby-ink/40" : "hover:bg-white"
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelClass}>สี</span>
        <div role="radiogroup" aria-label="สี" className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_COLORS) as CategoryColor[]).map((color) => (
            <button
              type="button"
              key={color}
              role="radio"
              aria-checked={c.color === color}
              onClick={() => setC({ ...c, color })}
              className={`flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-xs font-medium transition ${
                c.color === color ? "border-ink/40 bg-white shadow-sm" : "border-transparent hover:bg-white"
              }`}
            >
              <span className={`h-5 w-5 rounded-full border border-line ${CATEGORY_COLORS[color].swatch}`} />
              {CATEGORY_COLORS[color].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-alert/60 px-3 py-1.5 text-xs text-alert-ink">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-1.5 text-sm text-ink-soft hover:bg-white">
          ยกเลิก
        </button>
        <button type="submit" className="rounded-full bg-ink px-5 py-1.5 text-sm font-medium text-white hover:opacity-90">
          {isNew ? "เพิ่มประเภท" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  category,
  count,
  others,
  onConfirm,
  onCancel,
}: {
  category: Category;
  count: number;
  others: Category[];
  onConfirm: (moveTo: string) => void;
  onCancel: () => void;
}) {
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");

  return (
    <div role="alert" className="mt-2 space-y-2 rounded-xl bg-alert/40 p-2.5 text-xs text-alert-ink">
      {count > 0 ? (
        <label className="flex flex-wrap items-center gap-1.5">
          มี {count} กิจกรรมใช้ “{category.label}” อยู่ — ย้ายไปที่
          <select
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            className="rounded-lg border border-line bg-white px-2 py-1 text-base text-ink sm:text-xs"
          >
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.icon} {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>ลบประเภท “{category.label}”?</p>
      )}
      <div className="flex justify-end gap-1">
        <IconButton icon="close" label="ยกเลิก" onClick={onCancel} />
        <IconButton
          icon="delete"
          tone="danger"
          label={count > 0 ? `ย้าย ${count} กิจกรรมแล้วลบประเภท` : "ยืนยันลบประเภท"}
          onClick={() => onConfirm(moveTo)}
          autoFocus
        />
      </div>
    </div>
  );
}
