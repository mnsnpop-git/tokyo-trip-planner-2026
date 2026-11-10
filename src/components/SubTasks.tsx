"use client";

import { useReadOnly } from "./ReadOnly";
import { useId, useState } from "react";
import { SUBTASK_PRIORITIES, isSafeUrl, uid, type SubTask, type SubTaskOrder, type SubTaskPriority } from "@/lib/trip";
import { suggestRoute } from "@/lib/travelEstimate";
import { useMapCoords } from "@/lib/useMapCoords";
import { useDragReorder } from "@/lib/useDragReorder";
import { TravelLeg, type LegEnd } from "./TravelLeg";
import { MapPlaceField } from "./MapPlaceField";
import type { LatLng } from "@/lib/travelEstimate";
import { Modal, inputClass, labelClass } from "./Modal";
import { ImagePicker, ImageViewer } from "./Images";
import { DeleteButton, IconButton, PlusIcon } from "./Icons";
import { Progress } from "./Progress";

/** Must = solid black, Nice = baby blue (same colours in badges, the summary and the form). */
const PRIORITY_BADGE: Record<SubTaskPriority, string> = {
  must: "bg-ink text-white",
  nice: "bg-baby text-baby-ink",
};

export function PriorityBadge({ priority }: { priority: SubTaskPriority }) {
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_BADGE[priority]}`}>
      {priority === "must" ? "Must" : "Nice"}
    </span>
  );
}

/**
 * Checklist of sub-activities inside one activity plan: only a quiet "add" link until the first
 * one exists, then a collapsible list — tick done / undo, Must or Nice badge, details and photos, with a progress bar.
 *
 * Order: "auto" shows the suggested route (nearest first, starting near the activity's own pin) and
 * follows new or moved pins by itself; dragging switches to "manual" and keeps that order until reset.
 * Between neighbours that both have a map pin, the estimated travel time and mode are shown.
 */
export function SubTaskList({
  placeTitle,
  placeMapUrl,
  subtasks,
  order: orderMode,
  onChange,
}: {
  placeTitle: string;
  /** The activity's own map link: the auto route starts nearest to it. */
  placeMapUrl: string;
  subtasks: SubTask[];
  order: SubTaskOrder;
  onChange: (subtasks: SubTask[], order: SubTaskOrder) => void;
}) {
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState<SubTask | "new" | null>(null);
  const [viewing, setViewing] = useState<{ task: SubTask; index: number } | null>(null);
  const [open, setOpen] = useState(true);
  const listId = useId();
  const done = subtasks.filter((t) => t.done).length;
  const summary = SUBTASK_PRIORITIES.map(({ id, label }) => {
    const all = subtasks.filter((t) => t.priority === id);
    return { id, label, total: all.length, left: all.filter((t) => !t.done).length };
  }).filter((p) => p.total > 0);

  const linkOf = (url: string) => (url && isSafeUrl(url) ? url : "");
  const origin = linkOf(placeMapUrl.trim());
  const coords = useMapCoords([origin, ...subtasks.map((t) => linkOf(t.mapUrl))].filter(Boolean));
  const coordsOf = (url: string) => (linkOf(url) ? coords.get(url) : null);
  const suggested = suggestRoute(
    subtasks.map((t) => ({ id: t.id, coords: coordsOf(t.mapUrl) })),
    (origin && coords.get(origin)) || null,
  );
  const manual = orderMode === "manual";
  const byId = new Map(subtasks.map((t) => [t.id, t]));
  const arrange = (ids: string[]) => ids.map((id) => byId.get(id)).filter((t): t is SubTask => Boolean(t));

  // Edits keep the current mode; dragging stores the new order and switches to manual.
  const change = (next: SubTask[]) => onChange(next, orderMode);
  const drag = useDragReorder(manual ? subtasks.map((t) => t.id) : suggested, (ids) => onChange(arrange(ids), "manual"));
  const shown = arrange(drag.order);
  const resetOrder = () => onChange(arrange(suggested), "auto");
  const legEnd = (t: SubTask): LegEnd => ({ name: t.title, time: "", mapUrl: linkOf(t.mapUrl), coords: coordsOf(t.mapUrl) });

  const toggle = (id: string) => change(subtasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const save = (task: SubTask) =>
    change(subtasks.some((t) => t.id === task.id) ? subtasks.map((t) => (t.id === task.id ? task : t)) : [...subtasks, task]);

  const form = editing && (
    <SubTaskForm
      initial={editing === "new" ? null : editing}
      placeTitle={placeTitle}
      near={(origin && coords.get(origin)) || null}
      onCancel={() => setEditing(null)}
      onSave={(t) => {
        save(t);
        setEditing(null);
        setOpen(true);
      }}
    />
  );

  // None yet: just a quiet "add" link (nothing at all for guests).
  if (subtasks.length === 0) {
    if (readOnly) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing("new")}
          aria-label={`เพิ่มกิจกรรมย่อยใน ${placeTitle}`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-ink-soft transition hover:bg-white hover:text-baby-ink"
        >
          <PlusIcon className="h-3 w-3" />
          เพิ่มกิจกรรมย่อย
        </button>
        {form}
      </>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-white/70 px-2.5 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left text-xs font-semibold"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={`h-3 w-3 shrink-0 text-ink-soft transition-transform ${open ? "rotate-90" : ""}`}
            fill="currentColor"
          >
            <path d="M7 4l7 6-7 6V4z" />
          </svg>
          <span className="shrink-0">กิจกรรมย่อย</span>
          <span className="shrink-0 font-medium text-ink-soft">
            {done}/{subtasks.length}
          </span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {summary.map((p) => (
              <span
                key={p.id}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.left > 0 ? PRIORITY_BADGE[p.id] : "bg-white text-ink-soft"}`}
              >
                {p.label} {p.left > 0 ? `เหลือ ${p.left}` : "ครบ ✓"}
              </span>
            ))}
          </span>
        </button>
        <IconButton icon="add" size="sm" label={`เพิ่มกิจกรรมย่อยใน ${placeTitle}`} onClick={() => setEditing("new")} />
      </div>

      <div id={listId} hidden={!open}>
        <Progress done={done} total={subtasks.length} label="ทำแล้ว" className="mb-1 mt-1" />
        {subtasks.length > 1 && (
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
            <span>{manual ? "↕ เรียงเอง" : "↕ เรียงอัตโนมัติ · ที่ใกล้กันก่อน"}</span>
            {manual && !readOnly && (
              <button
                type="button"
                onClick={resetOrder}
                className="rounded-full px-1.5 py-0.5 font-medium text-baby-ink hover:bg-baby"
              >
                รีเซ็ตเป็นลำดับแนะนำ
              </button>
            )}
          </div>
        )}
        <ul>
          {shown.flatMap((t, i) => {
            const next = shown[i + 1];
            // Travel legs only between two pinned neighbours, and not while rows are being dragged.
            const hasLeg = (x: SubTask, y: SubTask | undefined) => !!y && !!linkOf(x.mapUrl) && !!linkOf(y.mapUrl) && !drag.draggingId;
            return [
              <li
                key={t.id}
                data-reorder-id={t.id}
                className={`flex items-start gap-2 rounded-lg py-1.5 ${
                  drag.draggingId === t.id ? "scale-[1.02] bg-white shadow-lg" : i > 0 && !hasLeg(shown[i - 1], t) ? "border-t border-line/60" : ""
                }`}
              >
                {!readOnly && subtasks.length > 1 && (
                  <button
                    type="button"
                    onPointerDown={(e) => drag.start(e, t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        drag.move(t.id, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                    aria-label={`ลากเพื่อย้าย ${t.title} (หรือกด ↑/↓)`}
                    className="-ml-1 mt-0.5 flex h-5 w-4 shrink-0 cursor-grab touch-none select-none items-center justify-center text-xs text-ink-soft/50 hover:text-ink-soft active:cursor-grabbing"
                  >
                    ⋮⋮
                  </button>
                )}
                <button
                  onClick={() => toggle(t.id)}
                  disabled={readOnly}
                  aria-pressed={t.done}
                  aria-label={t.done ? `ยกเลิกว่าทำแล้ว: ${t.title}` : `ทำแล้ว: ${t.title}`}
                  title={t.done ? "Undo" : "Mark as done"}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold transition ${
                    t.done ? "border-done-ink bg-done-ink text-white" : "border-line bg-white text-transparent hover:border-done-ink"
                  }`}
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-1.5 text-sm leading-snug">
                    <span className={`min-w-0 flex-1 break-words ${t.done ? "text-ink-soft line-through" : "font-medium"}`}>{t.title}</span>
                    {t.mapUrl && (
                      <a
                        href={t.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open Map: ${t.title}`}
                        title="Open Map"
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-baby-ink hover:bg-baby ${t.done ? "opacity-60" : ""}`}
                      >
                        📍 Open Map
                      </a>
                    )}
                    <PriorityBadge priority={t.priority} />
                  </p>
                  {t.note && <p className={`mt-0.5 text-xs text-ink-soft ${t.done ? "line-through" : ""}`}>{t.note}</p>}
                  {t.images.length > 0 && (
                    <div className={`mt-1 flex gap-1.5 overflow-x-auto ${t.done ? "opacity-60" : ""}`}>
                      {t.images.map((src, i) => (
                        <button
                          key={`${i}-${src.slice(-16)}`}
                          onClick={() => setViewing({ task: t, index: i })}
                          aria-label={`ดูรูปที่ ${i + 1} ของ ${t.title}`}
                          className="shrink-0 overflow-hidden rounded-md border border-line"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" loading="lazy" className="h-12 w-16 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="-my-0.5 -mr-1 flex shrink-0">
                  <IconButton icon="edit" size="sm" label={`แก้ไข ${t.title}`} onClick={() => setEditing(t)} />
                  <DeleteButton size="sm" label={`ลบ ${t.title}`} onConfirm={() => change(subtasks.filter((x) => x.id !== t.id))} />
                </div>
              </li>,
              hasLeg(t, next) && <TravelLeg key={`leg-${t.id}`} from={legEnd(t)} to={legEnd(next!)} className="py-0.5 pl-8" />,
            ];
          })}
        </ul>
      </div>

      {form}
      {viewing && viewing.task.images[viewing.index] && (
        <ImageViewer
          title={viewing.task.title}
          images={viewing.task.images}
          index={viewing.index}
          onIndex={(index) => setViewing((v) => v && { ...v, index })}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function SubTaskForm({
  initial,
  placeTitle,
  near,
  onCancel,
  onSave,
}: {
  initial: SubTask | null;
  placeTitle: string;
  /** The activity's location: place search looks around it first. */
  near: LatLng | null;
  onCancel: () => void;
  onSave: (t: SubTask) => void;
}) {
  const [t, setT] = useState<SubTask>(
    () => initial ?? { id: uid(), title: "", note: "", mapUrl: "", images: [], priority: "must", done: false },
  );
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!t.title.trim()) return setError("ใส่ชื่อกิจกรรมย่อยก่อนนะ");
    const mapUrl = t.mapUrl.trim();
    if (mapUrl && !isSafeUrl(mapUrl)) return setError("ลิงก์ Google Maps ต้องขึ้นต้นด้วย https://");
    onSave({ ...t, title: t.title.trim(), note: t.note.trim(), mapUrl });
  };

  return (
    <Modal title={initial ? "แก้ไขกิจกรรมย่อย" : `เพิ่มกิจกรรมย่อย · ${placeTitle}`} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="sub-title">ชื่อกิจกรรมย่อย</label>
          <input
            id="sub-title"
            autoFocus={!initial}
            className={inputClass}
            value={t.title}
            onChange={(e) => {
              setT({ ...t, title: e.target.value });
              setError("");
            }}
            placeholder="เช่น ประตูคามินาริมง"
          />
        </div>
        <div>
          <span className={labelClass}>Priority</span>
          <div role="radiogroup" aria-label="Priority" className="flex overflow-hidden rounded-xl border border-line text-sm">
            {SUBTASK_PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.id}
                role="radio"
                aria-checked={t.priority === p.id}
                onClick={() => setT({ ...t, priority: p.id })}
                className={`flex-1 px-2 py-2 font-medium transition ${
                  t.priority === p.id ? (p.id === "must" ? "bg-ink text-white" : "bg-baby-ink text-white") : "bg-white text-ink-soft"
                }`}
              >
                {p.id === "must" ? "Must" : "Nice"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">Must = ต้องไปให้ได้ · Nice = ถ้ามีเวลา</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="sub-note">รายละเอียด</label>
          <textarea
            id="sub-note"
            rows={2}
            className={inputClass}
            value={t.note}
            onChange={(e) => setT({ ...t, note: e.target.value })}
            placeholder="อยู่ตรงไหน, ทำอะไร, ราคา…"
          />
        </div>
        <MapPlaceField
          id="sub-map"
          value={t.mapUrl}
          near={near}
          onChange={(mapUrl) => {
            setT((x) => ({ ...x, mapUrl }));
            setError("");
          }}
          onPick={(p) => setT((x) => (x.title.trim() ? x : { ...x, title: p.name }))}
        />
        <ImagePicker
          idPrefix="sub"
          allowUrl={false}
          label="รูป"
          images={t.images}
          onUpdate={(update) => setT((x) => ({ ...x, images: update(x.images) }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={t.done} onChange={(e) => setT({ ...t, done: e.target.checked })} className="h-4 w-4 accent-done-ink" />
          ทำแล้ว
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-alert px-3 py-2 text-sm font-medium text-alert-ink">
            ⚠️ {error}
          </p>
        )}
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
