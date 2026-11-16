"use client";

import { useState } from "react";
import { activePlace, formatDayTab, uid, type Activity, type Day, type GalleryPhoto, type Member } from "@/lib/trip";
import { useImageUpload } from "@/lib/imageUpload";
import { useReadOnly } from "./ReadOnly";
import { ImageViewer, uploadPhotos } from "./Images";
import { CameraIcon, DeleteButton, IconButton } from "./Icons";
import { inputClass, labelClass } from "./Modal";

type Filter = "all" | "none" | string; // a day id

/** Label for a linked activity, e.g. "DAY 2 · 10:00 · Senso-ji"; "" when the activity is gone. */
function activityLabelOf(days: Day[], activities: Activity[], id: string): string {
  const a = activities.find((x) => x.id === id);
  const di = a ? days.findIndex((d) => d.id === a.dayId) : -1;
  return a && di >= 0 ? `DAY ${di + 1} · ${a.time} · ${activePlace(a).title}` : "";
}

/** Activity picker grouped by day; "" means not linked. */
function ActivityPicker({
  id,
  days,
  activities,
  value,
  onChange,
}: {
  id: string;
  days: Day[];
  activities: Activity[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— ไม่ผูกกับกิจกรรม —</option>
      {days.map((d, i) => {
        const acts = activities.filter((a) => a.dayId === d.id).sort((a, b) => a.time.localeCompare(b.time));
        return acts.length === 0 ? null : (
          <optgroup key={d.id} label={`DAY ${i + 1} · ${formatDayTab(d.date)} · ${d.title}`}>
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.time} · {activePlace(a).title}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

/**
 * Full-size viewer for gallery photos: caption, who added it, linked activity, and (for members)
 * editing the caption/activity or deleting the photo.
 */
export function GalleryViewer({
  title,
  photos,
  startIndex = 0,
  days,
  activities,
  members,
  onClose,
  onOpenActivity,
  onUpdate,
  onDelete,
}: {
  title: string;
  photos: GalleryPhoto[];
  startIndex?: number;
  days: Day[];
  activities: Activity[];
  members: Member[];
  onClose: () => void;
  /** Jump to the linked activity in the Trip Planner (omitted when already there). */
  onOpenActivity?: (activityId: string) => void;
  /** Omitted: view only. */
  onUpdate?: (photo: GalleryPhoto) => void;
  onDelete?: (id: string) => void;
}) {
  const readOnly = useReadOnly();
  const [index, setIndex] = useState(Math.min(startIndex, photos.length - 1));
  const [editing, setEditing] = useState<{ caption: string; activityId: string } | null>(null);
  if (photos.length === 0) return null;
  const i = Math.min(index, photos.length - 1);
  const member = (id: string) => members.find((m) => m.id === id);
  const canEdit = !readOnly && !!onUpdate;

  return (
    <ImageViewer
      title={title}
      images={photos.map((p) => p.url)}
      index={i}
      onIndex={(n) => {
        setIndex(n);
        setEditing(null);
      }}
      onClose={onClose}
      footer={(n) => {
        const p = photos[n];
        if (!p) return null;
        const who = member(p.addedBy);
        const linked = p.activityId ? activityLabelOf(days, activities, p.activityId) : "";
        if (editing && canEdit)
          return (
            <form
              className="mt-3 space-y-2 border-t border-line/60 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                onUpdate!({ ...p, caption: editing.caption.trim(), activityId: editing.activityId });
                setEditing(null);
              }}
            >
              <div>
                <label className={labelClass} htmlFor="gallery-caption">คำบรรยาย</label>
                <input
                  id="gallery-caption"
                  autoFocus
                  className={inputClass}
                  value={editing.caption}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                  placeholder="เช่น ถ่ายรูปหมู่หน้าวัด"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="gallery-activity">กิจกรรม</label>
                <ActivityPicker
                  id="gallery-activity"
                  days={days}
                  activities={activities}
                  value={editing.activityId}
                  onChange={(activityId) => setEditing({ ...editing, activityId })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface">
                  ยกเลิก
                </button>
                <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90">
                  บันทึก
                </button>
              </div>
            </form>
          );
        return (
          <div className="mt-3 flex items-start gap-2 border-t border-line/60 pt-3 text-sm">
            <div className="min-w-0 flex-1 space-y-0.5">
              {p.caption && <p className="font-medium">{p.caption}</p>}
              <p className="text-xs text-ink-soft">
                {who ? `${who.emoji} ${who.name}` : "ไม่ทราบผู้เพิ่ม"}
                {p.addedAt && ` · ${new Date(p.addedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`}
              </p>
              {linked &&
                (onOpenActivity ? (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenActivity(p.activityId);
                    }}
                    className="text-left text-xs font-medium text-baby-ink hover:underline"
                  >
                    📍 {linked} ›
                  </button>
                ) : (
                  <p className="text-xs text-ink-soft">📍 {linked}</p>
                ))}
            </div>
            {canEdit && (
              <>
                <IconButton
                  icon="edit"
                  label="แก้ไขคำบรรยายและกิจกรรม"
                  onClick={() => setEditing({ caption: p.caption, activityId: linked ? p.activityId : "" })}
                />
                {onDelete && (
                  <DeleteButton
                    label="ลบรูปนี้"
                    onConfirm={() => {
                      if (photos.length === 1) onClose();
                      onDelete(p.id);
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      }}
    />
  );
}

/** Small "📷 n" button on an activity card; opens that activity's gallery photos. Shows nothing without photos. */
export function GalleryBadge({ count, label, onClick }: { count: number; label: string; onClick: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-ink-soft transition hover:bg-surface hover:text-ink"
    >
      <CameraIcon className="h-4 w-4" />
      {count}
    </button>
  );
}

/** Shared Gallery page: upload trip moments and link each one to an activity. */
export function Gallery({
  photos,
  days,
  activities,
  members,
  currentMemberId,
  onChange,
  onOpenActivity,
}: {
  photos: GalleryPhoto[];
  days: Day[];
  activities: Activity[];
  members: Member[];
  currentMemberId: string;
  /** Gets an update function, so uploads that finish later apply to the latest list. */
  onChange: (update: (gallery: GalleryPhoto[]) => GalleryPhoto[]) => void;
  onOpenActivity: (activityId: string) => void;
}) {
  const readOnly = useReadOnly();
  const uploadImage = useImageUpload();
  const [linkTo, setLinkTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewing, setViewing] = useState<{ ids: string[]; index: number; title: string } | null>(null);

  const activityById = new Map(activities.map((a) => [a.id, a]));
  const linkedActivity = (p: GalleryPhoto) => (p.activityId ? activityById.get(p.activityId) : undefined);

  const upload = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith("image/"));
    input.value = "";
    if (files.length === 0) return;
    setError("");
    setBusy(true);
    const { urls, error } = await uploadPhotos(files, uploadImage);
    const now = new Date().toISOString();
    const added = urls.map((url): GalleryPhoto => ({ id: uid(), url, caption: "", activityId: linkTo, addedBy: currentMemberId, addedAt: now }));
    if (added.length) onChange((list) => [...added, ...list]);
    setError(error);
    setBusy(false);
  };

  const update = (p: GalleryPhoto) => onChange((list) => list.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => onChange((list) => list.filter((x) => x.id !== id));

  // Sections: each day's activities in order, then photos not linked to any (existing) activity.
  const sections: { key: string; dayId: string | null; title: string; activityId?: string; photos: GalleryPhoto[] }[] = [];
  days.forEach((d, i) => {
    activities
      .filter((a) => a.dayId === d.id)
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach((a) => {
        const list = photos.filter((p) => p.activityId === a.id);
        if (list.length)
          sections.push({ key: a.id, dayId: d.id, title: `DAY ${i + 1} · ${a.time} · ${activePlace(a).title}`, activityId: a.id, photos: list });
      });
  });
  const unlinked = photos.filter((p) => !linkedActivity(p));
  if (unlinked.length) sections.push({ key: "none", dayId: null, title: "ไม่ได้ผูกกับกิจกรรม", photos: unlinked });

  const shown = sections.filter((s) => filter === "all" || (filter === "none" ? s.dayId === null : s.dayId === filter));
  const daysWithPhotos = days.map((d, i) => ({ d, i })).filter(({ d }) => sections.some((s) => s.dayId === d.id));

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
      active ? "bg-ink text-white" : "bg-surface text-ink-soft hover:bg-baby hover:text-baby-ink"
    }`;

  const viewingPhotos = viewing ? viewing.ids.map((id) => photos.find((p) => p.id === id)).filter((p): p is GalleryPhoto => !!p) : [];

  return (
    <section aria-label="Gallery" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">Gallery</h2>
        <span className="text-sm text-ink-soft">{photos.length} รูป</span>
      </div>
      <p className="mb-4 text-xs text-ink-soft">เก็บ moment ของทริปร่วมกัน ผูกรูปกับกิจกรรมได้ แล้วจะมีไอคอน 📷 ที่การ์ดกิจกรรมใน Trip Planner</p>

      {!readOnly && (
        <div className="mb-4 space-y-2 rounded-2xl bg-surface/60 p-3">
          <div>
            <label className={labelClass} htmlFor="gallery-link">ผูกรูปที่จะอัปโหลดกับกิจกรรม (ไม่บังคับ)</label>
            <ActivityPicker id="gallery-link" days={days} activities={activities} value={linkTo} onChange={setLinkTo} />
          </div>
          <label
            className={`flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-white px-4 py-3 text-sm font-medium text-ink-soft transition hover:border-baby-ink hover:bg-baby/40 hover:text-ink ${
              busy ? "pointer-events-none animate-pulse opacity-60" : ""
            }`}
          >
            <CameraIcon className="h-6 w-6 shrink-0" />
            <span>{busy ? "กำลังอัปโหลดรูป…" : "อัปโหลดรูป (เลือกได้หลายรูป)"}</span>
            <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.currentTarget)} />
          </label>
          {error && <p className="text-[11px] text-alert-ink">{error}</p>}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="กรองตามวัน">
          <button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={chip(filter === "all")}>
            ทั้งหมด
          </button>
          {daysWithPhotos.map(({ d, i }) => (
            <button key={d.id} onClick={() => setFilter(d.id)} aria-pressed={filter === d.id} className={chip(filter === d.id)}>
              DAY {i + 1}
            </button>
          ))}
          {unlinked.length > 0 && (
            <button onClick={() => setFilter("none")} aria-pressed={filter === "none"} className={chip(filter === "none")}>
              ไม่ผูกกิจกรรม
            </button>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">
          {photos.length === 0 ? "ยังไม่มีรูป — อัปโหลด moment แรกของทริปได้เลย" : "ไม่มีรูปในวันนี้"}
        </p>
      ) : (
        <div className="space-y-5">
          {shown.map((s) => (
            <div key={s.key} id={s.activityId ? `gallery-${s.activityId}` : undefined} className="scroll-mt-32">
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                {s.activityId ? (
                  <button onClick={() => onOpenActivity(s.activityId!)} className="min-w-0 truncate text-left hover:underline">
                    📍 {s.title}
                  </button>
                ) : (
                  <span>{s.title}</span>
                )}
                <span className="shrink-0 text-xs font-normal text-ink-soft">{s.photos.length}</span>
              </h3>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {s.photos.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setViewing({ ids: s.photos.map((x) => x.id), index: i, title: s.title })}
                    className="overflow-hidden rounded-xl border border-line bg-[#fff]"
                    aria-label={p.caption ? `ดูรูป ${p.caption}` : `ดูรูปที่ ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || `รูปที่ ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && viewingPhotos.length > 0 && (
        <GalleryViewer
          key={viewing.ids.join()}
          title={viewing.title}
          photos={viewingPhotos}
          startIndex={viewing.index}
          days={days}
          activities={activities}
          members={members}
          onClose={() => setViewing(null)}
          onOpenActivity={onOpenActivity}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </section>
  );
}
