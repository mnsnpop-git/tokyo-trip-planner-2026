"use client";

import { useState } from "react";
import { uid, type Member } from "@/lib/trip";
import { inputClass, labelClass } from "./Modal";
import { IconButton } from "./Icons";

const EMOJI_PRESETS = [
  "🍿", "❄️", "💣", "🧊", "🐼", "🐧", "🐨", "🐸", "🐹", "🦄",
  "🐯", "🐶", "🐱", "🐰", "🦊", "🐻", "🐥", "🐙", "🍙", "🍡",
  "🌸", "⭐", "🔥", "🎌",
];

export function Members({
  members,
  currentMemberId,
  usage,
  onSave,
  onDelete,
}: {
  members: Member[];
  currentMemberId: string;
  /** Number of expenses/bookings that reference the member. */
  usage: (id: string) => number;
  onSave: (m: Member) => void;
  onDelete: (id: string) => void;
}) {
  // One row is edited or confirming delete at a time; "new" is the add form.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const nameTaken = (name: string, exceptId?: string) =>
    members.some((m) => m.id !== exceptId && m.name.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <section aria-label="สมาชิก" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">👥 สมาชิกในทริป</h2>
        <IconButton
          icon="add"
          label="เพิ่มสมาชิก"
          onClick={() => {
            setDeleting(null);
            setEditing("new");
          }}
          disabled={editing === "new"}
        />
        <span className="ml-auto text-sm text-ink-soft">{members.length} คน</span>
      </div>
      <p className="mb-4 text-xs text-ink-soft">สมาชิกแต่ละคนคือโปรไฟล์ที่เลือกได้ตอนเข้าเว็บ และใช้ในการหารค่าใช้จ่าย/Booking</p>

      <ul className="space-y-2">
        {members.map((m) => {
          const isMe = m.id === currentMemberId;
          const used = usage(m.id);
          if (editing === m.id) {
            return (
              <li key={m.id}>
                <MemberEditor
                  initial={m}
                  nameTaken={(n) => nameTaken(n, m.id)}
                  onCancel={() => setEditing(null)}
                  onSave={(next) => {
                    onSave(next);
                    setEditing(null);
                  }}
                />
              </li>
            );
          }
          // Removing yourself would sign you out mid-edit; removing a referenced member would break the bill split.
          const blockedReason = isMe
            ? "ลบโปรไฟล์ที่กำลังใช้อยู่ไม่ได้ — เปลี่ยนโปรไฟล์ก่อน"
            : used > 0
              ? `ลบไม่ได้: มี ${used} รายการค่าใช้จ่าย/Booking ที่อ้างถึง`
              : "";
          return (
            <li key={m.id} className="rounded-2xl bg-surface/60 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white text-xl shadow-sm">
                  {m.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {isMe && <span className="ml-2 rounded-full bg-baby px-2 py-0.5 text-[11px] font-medium text-baby-ink">คุณ</span>}
                  </p>
                  <p className="text-xs text-ink-soft">{used > 0 ? `อยู่ใน ${used} รายการ` : "ยังไม่มีรายการ"}</p>
                </div>
                <span className="flex shrink-0 gap-0.5">
                  <IconButton
                    icon="edit"
                    label={`แก้ไข ${m.name}`}
                    onClick={() => {
                      setDeleting(null);
                      setEditing(m.id);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    label={`ลบ ${m.name}`}
                    title={blockedReason || `ลบ ${m.name}`}
                    onClick={() => {
                      setEditing(null);
                      setDeleting(m.id);
                    }}
                    disabled={Boolean(blockedReason)}
                  />
                </span>
              </div>
              {blockedReason && <p className="mt-1 pl-[3.25rem] text-[11px] text-ink-soft">{blockedReason}</p>}
              {deleting === m.id && (
                <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-alert/40 p-2.5 text-xs text-alert-ink">
                  ลบ {m.emoji} {m.name} ออกจากทริป?
                  <span className="ml-auto flex gap-1">
                    <IconButton icon="close" label="ยกเลิก" onClick={() => setDeleting(null)} />
                    <IconButton
                      icon="delete"
                      tone="danger"
                      label={`ยืนยันลบ ${m.name}`}
                      onClick={() => {
                        onDelete(m.id);
                        setDeleting(null);
                      }}
                      autoFocus
                    />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing === "new" && (
        <div className="mt-3">
          <MemberEditor
            initial={{ id: uid(), name: "", emoji: EMOJI_PRESETS[(members.length + 4) % EMOJI_PRESETS.length] }}
            nameTaken={(n) => nameTaken(n)}
            onCancel={() => setEditing(null)}
            onSave={(m) => {
              onSave(m);
              setEditing(null);
            }}
          />
        </div>
      )}
    </section>
  );
}

function MemberEditor({
  initial,
  nameTaken,
  onSave,
  onCancel,
}: {
  initial: Member;
  nameTaken: (name: string) => boolean;
  onSave: (m: Member) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<Member>(initial);
  const [error, setError] = useState("");
  const isNew = !initial.name;
  const emoji = m.emoji.trim() || "🙂";
  const idp = `member-${initial.id}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = m.name.trim();
    if (!name) return setError("ใส่ชื่อก่อนนะ");
    if (nameTaken(name)) return setError("มีสมาชิกชื่อนี้แล้ว");
    onSave({ ...m, name, emoji });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={isNew ? "เพิ่มสมาชิก" : `แก้ไข ${initial.name}`}
      className="space-y-4 rounded-2xl border border-baby-ink/30 bg-surface/60 p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">{emoji}</span>
        <p className="text-sm font-semibold">{isNew ? "เพิ่มสมาชิกใหม่" : "แก้ไขสมาชิก"}</p>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${idp}-name`}>ชื่อ</label>
        <input
          id={`${idp}-name`}
          autoFocus
          maxLength={30}
          className={inputClass}
          value={m.name}
          onChange={(e) => setM({ ...m, name: e.target.value })}
          placeholder="เช่น Pop"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${idp}-emoji`}>Emoji (เลือกด้านล่าง หรือพิมพ์เอง)</label>
        <input
          id={`${idp}-emoji`}
          maxLength={8}
          className={`${inputClass} w-20 text-center text-lg`}
          value={m.emoji}
          onChange={(e) => setM({ ...m, emoji: e.target.value })}
        />
        <div role="group" aria-label="emoji แนะนำ" className="mt-2 flex flex-wrap gap-1">
          {EMOJI_PRESETS.map((em) => (
            <button
              type="button"
              key={em}
              onClick={() => setM({ ...m, emoji: em })}
              aria-label={`ใช้ ${em}`}
              aria-pressed={emoji === em}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                emoji === em ? "bg-white shadow ring-2 ring-baby-ink/40" : "hover:bg-white"
              }`}
            >
              {em}
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
          {isNew ? "เพิ่มสมาชิก" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
