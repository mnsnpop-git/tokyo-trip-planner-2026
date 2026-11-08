"use client";

import { useState } from "react";
import { uid, type Member, memberUsageItems, memberUsageText, memberUsageTotal, type MemberUsage } from "@/lib/trip";
import { DEFAULT_PIN, checkPin, isPinFormat } from "@/lib/pin";
import { Modal, inputClass, labelClass } from "./Modal";
import { IconButton } from "./Icons";
import { useReadOnly } from "./ReadOnly";

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
  onChangeMyPin,
  onResetPin,
}: {
  members: Member[];
  currentMemberId: string;
  /** Set a new PIN for the signed-in member. */
  onChangeMyPin: (pin: string) => void;
  /** Put another member back on the default PIN. */
  onResetPin: (id: string) => void;
  /** Where the member is still referenced, per menu. */
  usage: (id: string) => MemberUsage;
  onSave: (m: Member) => void;
  onDelete: (id: string) => void;
}) {
  // One row is edited or confirming delete at a time; "new" is the add form.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [changingPin, setChangingPin] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const readOnly = useReadOnly();
  const me = members.find((m) => m.id === currentMemberId);

  const nameTaken = (name: string, exceptId?: string) =>
    members.some((m) => m.id !== exceptId && m.name.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <section aria-label="สมาชิก" className="rounded-3xl border border-line bg-white/80 p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <h2 className="text-lg font-semibold">สมาชิกในทริป</h2>
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
          const usedItems = memberUsageItems(used);
          const usedText = memberUsageText(used);
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
            ? "ลบโปรไฟล์ที่กำลังใช้อยู่ไม่ได้ — เปลี่ยนไปโปรไฟล์อื่นก่อน"
            : memberUsageTotal(used) > 0
              ? `ยังลบไม่ได้ — ยังอยู่ใน ${usedText}`
              : "";
          return (
            <li key={m.id} className="card-fill-hover rounded-2xl bg-surface/60 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white text-xl shadow-sm">
                  {m.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {isMe && <span className="ml-2 rounded-full bg-baby px-2 py-0.5 text-[11px] font-medium text-baby-ink">คุณ</span>}
                  </p>
                  {usedItems.length > 0 ? (
                    <p className="mt-0.5 flex flex-wrap gap-1" aria-label={`อยู่ใน ${usedText}`}>
                      {usedItems.map((i) => (
                        <span
                          key={i.key}
                          title={`${i.label} ${i.count} รายการ`}
                          className="rounded-full bg-white px-1.5 py-px text-[11px] font-medium text-ink-soft shadow-sm"
                        >
                          {i.icon} {i.count}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-soft">ยังไม่มีรายการ</p>
                  )}
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
                    onClick={() => {
                      setEditing(null);
                      setDeleting(m.id);
                    }}
                  />
                </span>
              </div>
              {/* PINs: only signed-in members see these controls; nobody ever sees the PIN itself. */}
              {!readOnly && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[3.25rem] text-[11px]">
                  <span className="text-ink-soft">{m.pinHash ? "ตั้ง PIN แล้ว" : "ใช้ PIN เริ่มต้น"}</span>
                  {isMe ? (
                    <button
                      onClick={() => setChangingPin(true)}
                      className="rounded-full bg-white px-2.5 py-0.5 font-medium text-baby-ink shadow-sm hover:bg-baby"
                    >
                      เปลี่ยน PIN
                    </button>
                  ) : (
                    m.pinHash &&
                    (resetting === m.id ? (
                      <span className="flex items-center gap-1.5 text-alert-ink">
                        รีเซ็ต PIN ของ {m.name}?
                        <button
                          onClick={() => {
                            onResetPin(m.id);
                            setResetting(null);
                          }}
                          className="rounded-full bg-alert-ink px-2.5 py-0.5 font-medium text-white"
                        >
                          ยืนยัน
                        </button>
                        <button onClick={() => setResetting(null)} className="underline">
                          ยกเลิก
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setResetting(m.id)}
                        title="สำหรับคนที่ลืม PIN"
                        className="rounded-full bg-white px-2.5 py-0.5 font-medium text-ink-soft shadow-sm hover:text-alert-ink"
                      >
                        ↺ รีเซ็ต PIN
                      </button>
                    ))
                  )}
                </div>
              )}
              {/* Tapping delete on a member who can't be removed explains why, quietly. */}
              {deleting === m.id && blockedReason && (
                <div role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-[11px] text-ink-soft">
                  <p className="min-w-0 flex-1">ℹ️ {blockedReason}</p>
                  <IconButton icon="close" size="sm" label="ปิด" onClick={() => setDeleting(null)} />
                </div>
              )}
              {deleting === m.id && !blockedReason && (
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

      {changingPin && me && (
        <ChangePinForm
          member={me}
          onCancel={() => setChangingPin(false)}
          onSave={(pin) => {
            onChangeMyPin(pin);
            setChangingPin(false);
          }}
        />
      )}

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

      {isNew && <p className="text-[11px] text-ink-soft">PIN เริ่มต้นคือ {DEFAULT_PIN} — เจ้าของโปรไฟล์เปลี่ยนเองได้หลังเข้าใช้</p>}

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

/** Change your own PIN: current PIN, then the new one twice. Digits are never shown. */
function ChangePinForm({ member, onSave, onCancel }: { member: Member; onSave: (pin: string) => void; onCancel: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPin(member, current)) return setError("PIN ปัจจุบันไม่ถูกต้อง");
    if (!isPinFormat(next)) return setError("PIN ใหม่ต้องเป็นตัวเลข 4 หลัก");
    if (next !== again) return setError("PIN ใหม่ทั้งสองช่องไม่ตรงกัน");
    if (next === current) return setError("PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม");
    onSave(next);
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={4}
        className={`${inputClass} text-center font-mono tracking-[0.6em]`}
        value={value}
        onChange={(e) => {
          set(digits(e.target.value));
          setError("");
        }}
        placeholder="••••"
      />
    </div>
  );

  return (
    <Modal title={`เปลี่ยน PIN · ${member.emoji} ${member.name}`} onClose={onCancel}>
      <form noValidate onSubmit={submit} className="space-y-3">
        {field("pin-current", "PIN ปัจจุบัน", current, setCurrent, true)}
        {field("pin-new", "PIN ใหม่ (4 หลัก)", next, setNext)}
        {field("pin-again", "ยืนยัน PIN ใหม่", again, setAgain)}
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
            บันทึก PIN
          </button>
        </div>
      </form>
    </Modal>
  );
}
