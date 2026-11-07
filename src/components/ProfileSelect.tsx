"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/lib/trip";
import { CheckIcon } from "./Icons";

/** Profile chip in the header; tapping it opens a small menu to switch profile in place. */
export function ProfileSwitcher({
  me,
  members,
  onSelect,
  onSignOut,
}: {
  me: Member;
  members: Member[];
  onSelect: (id: string) => void;
  /** Leave the planner and go back to the "who's planning?" screen. */
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`โปรไฟล์ ${me.name} — แตะเพื่อเลือกโปรไฟล์`}
        title="เลือกโปรไฟล์"
        className="flex items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1 pr-2.5 text-sm shadow-sm transition hover:bg-white"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-baby">{me.emoji}</span>
        <span className="max-w-28 truncate font-medium">{me.name}</span>
        <svg aria-hidden viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-ink-soft transition ${open ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && (
        <>
          {/* Tap anywhere else to close. */}
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul
            role="menu"
            aria-label="เลือกโปรไฟล์"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-white p-1 shadow-lg"
          >
            {members.map((m) => {
              const active = m.id === me.id;
              return (
                <li key={m.id} role="none">
                  <button
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setOpen(false);
                      if (!active) onSelect(m.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                      active ? "bg-baby font-semibold text-baby-ink" : "hover:bg-surface"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg ring-1 ring-line">
                      {m.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {active && <CheckIcon className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
            <li role="separator" className="my-1 border-t border-line" />
            <li role="none">
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-alert-ink transition hover:bg-alert/60"
              >
                <svg aria-hidden viewBox="0 0 20 20" className="ml-2 mr-1.5 h-4 w-4 shrink-0" fill="currentColor">
                  <path d="M3 4.75A1.75 1.75 0 0 1 4.75 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25h5.5a.75.75 0 0 1 0 1.5h-5.5A1.75 1.75 0 0 1 3 15.25V4.75Z" />
                  <path d="M13.22 6.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06l1.97-1.97H8a.75.75 0 0 1 0-1.5h7.19l-1.97-1.97a.75.75 0 0 1 0-1.06Z" />
                </svg>
                <span className="font-medium">ออกจากระบบ</span>
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

/** Full-screen "who's planning?" picker shown before entering the trip planner. */
export function ProfileSelect({
  tripName,
  tripYear,
  members,
  onSelect,
  onRestoreDefaults,
}: {
  tripName: string;
  /** e.g. "2026", same as the header label "2026 Trip". */
  tripYear: string;
  members: Member[];
  onSelect: (id: string) => void;
  onRestoreDefaults: () => void;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-baby/70 via-white to-white px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none text-baby-ink/15">
        <span className="absolute left-[8%] top-10 text-5xl">❄</span>
        <span className="absolute right-[10%] top-20 text-4xl">❄</span>
        <span className="absolute bottom-16 left-[20%] text-3xl">❄</span>
        <span className="absolute bottom-24 right-[25%] text-5xl">❄</span>
      </div>

      <div className="relative w-full max-w-2xl text-center">
        <p className="font-sans text-sm font-medium tracking-[0.2em] text-baby-ink">{tripYear} Trip</p>
        <p className="mt-1 truncate text-lg font-semibold text-ink-soft">{tripName}</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">ใครกำลังวางแผนอยู่? 🗼</h1>
        <p className="mt-2 text-sm text-ink-soft">เลือกโปรไฟล์เพื่อเข้าสู่แพลนทริป</p>

        {members.length > 0 ? (
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => onSelect(m.id)}
                  className="group flex w-full flex-col items-center gap-3 rounded-3xl p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-baby-ink"
                >
                  <span className="flex aspect-square w-full max-w-32 items-center justify-center rounded-3xl border-2 border-line bg-white text-5xl shadow-sm transition group-hover:-translate-y-1 group-hover:border-baby-ink group-hover:shadow-md sm:text-6xl">
                    {m.emoji}
                  </span>
                  <span className="max-w-full truncate font-semibold text-ink-soft transition group-hover:text-ink">
                    {m.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 space-y-3">
            <p className="text-ink-soft">ยังไม่มีสมาชิกในทริปนี้</p>
            <button
              onClick={onRestoreDefaults}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              ใช้โปรไฟล์เริ่มต้น 4 คน
            </button>
          </div>
        )}

        <p className="mt-10 text-xs text-ink-soft">เพิ่ม/แก้ไข/ลบสมาชิกได้ที่เมนู 👥 Travelers หลังเข้าสู่ระบบ</p>
      </div>
    </main>
  );
}
