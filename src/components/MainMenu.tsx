"use client";

import { useReadOnly } from "./ReadOnly";
import { useThemeMode, type ThemeMode } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";
import { XIcon } from "./Icons";

export interface MenuItem<T extends string> {
  id: T;
  label: string;
  icon: string;
}

const MOUSE_THRESHOLD = 5; // px a mouse must move before a press becomes a drag
const LONG_PRESS_MS = 350; // touch/pen: hold this long to pick an item up
const TOUCH_SLOP = 8; // px a finger may move during the hold before we treat it as a scroll

/**
 * Vertical list of menu items (used inside the hamburger drawer) that can be reordered by dragging.
 * Mouse: press and drag. Touch: long-press, then drag.
 * Keyboard: Alt + ↑/↓ moves the focused item.
 */
export function MainMenu<T extends string>({
  items,
  active,
  onSelect,
  onReorder,
}: {
  items: MenuItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  onReorder: (ids: T[]) => void;
}) {
  // Live order while an item is being dragged; null when idle.
  const [drag, setDrag] = useState<{ id: T; order: T[] } | null>(null);
  const suppressClick = useRef(false);

  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = drag ? drag.order.map((id) => byId.get(id)!) : items;

  const readOnly = useReadOnly();
  const startGesture = (e: React.PointerEvent<HTMLButtonElement>, id: T) => {
    // Guests can't rearrange the menu either.
    if (e.button !== 0 || readOnly) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const isMouse = e.pointerType === "mouse";
    let order = items.map((i) => i.id);
    let dragging = false;
    let timer: number | undefined;

    const begin = () => {
      dragging = true;
      setDrag({ id, order });
      navigator.vibrate?.(10);
    };

    const end = (commit: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      setDrag(null);
      if (dragging) {
        // The button's click fires right after pointerup; swallow it so a drop doesn't also navigate.
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        if (commit) onReorder(order);
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!dragging) {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (isMouse && dist > MOUSE_THRESHOLD) begin();
        else if (!isMouse && dist > TOUCH_SLOP) return end(false); // finger moved early: it's a scroll
        if (!dragging) return;
      }
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-menu-id]");
      const overId = over?.dataset.menuId as T | undefined;
      if (!over || !overId || overId === id || !order.includes(overId)) return;
      // Only swap once the pointer crosses the target's midpoint, so items don't flicker back and forth.
      const from = order.indexOf(id);
      const to = order.indexOf(overId);
      const rect = over.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if ((to > from && ev.clientY < mid) || (to < from && ev.clientY > mid)) return;
      const next = order.filter((x) => x !== id);
      next.splice(to, 0, id);
      order = next;
      setDrag({ id, order });
    };

    const onUp = (ev: PointerEvent) => ev.pointerId === pointerId && end(true);
    const onCancel = (ev: PointerEvent) => ev.pointerId === pointerId && end(false);
    // Once an item is picked up on touch, stop the page from scrolling under the finger.
    const onTouchMove = (ev: TouchEvent) => dragging && ev.preventDefault();

    if (!isMouse) timer = window.setTimeout(begin, LONG_PRESS_MS);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
  };

  const moveBy = (id: T, delta: number) => {
    const order = items.map((i) => i.id);
    const from = order.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    onReorder(order);
  };

  return (
    <div className="flex flex-col gap-1" role="list">
      {shown.map((m) => {
        const isDragging = drag?.id === m.id;
        return (
          <div key={m.id} role="listitem">
            <button
              data-menu-id={m.id}
              onPointerDown={(e) => startGesture(e, m.id)}
              onClick={() => {
                if (suppressClick.current) return;
                onSelect(m.id);
              }}
              onKeyDown={(e) => {
                if (!e.altKey || readOnly) return;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  moveBy(m.id, -1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  moveBy(m.id, 1);
                }
              }}
              onContextMenu={(e) => e.preventDefault()} // long-press shouldn't open the context menu
              aria-current={active === m.id ? "page" : undefined}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              title="ลากเพื่อย้ายตำแหน่ง (มือถือ: กดค้างแล้วลาก)"
              className={`flex w-full select-none items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-medium transition [-webkit-touch-callout:none] ${
                active === m.id ? "bg-ink text-white shadow" : "text-ink hover:bg-surface"
              } ${isDragging ? "scale-[1.03] cursor-grabbing shadow-lg ring-2 ring-baby-ink/50" : "cursor-pointer"}`}
            >
              <span aria-hidden className="text-xl">{m.icon}</span>
              <span className="flex-1">{m.label}</span>
              <span aria-hidden className={`text-lg leading-none ${active === m.id ? "text-white/50" : "text-ink-soft/50"}`}>
                ⋮⋮
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Sticky top bar with a ☰ button that opens the menu in a drawer from the left. */
export function HamburgerNav<T extends string>({
  items,
  active,
  onSelect,
  onReorder,
  embedded = false,
}: {
  items: MenuItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  onReorder: (ids: T[]) => void;
  /** Inside a sticky header that already handles position and the safe-area inset. */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === active);

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // keep the page still behind the drawer (iOS)
    drawerRef.current?.querySelector<HTMLElement>("[aria-current=page], [data-menu-id]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      toggle?.focus(); // return focus to ☰
    };
  }, [open]);

  return (
    <>
      <div
        className={`border-b border-line bg-white/95 ${
          embedded ? "" : "sticky top-0 z-40 pt-[env(safe-area-inset-top)] backdrop-blur"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <button
            ref={toggleRef}
            onClick={() => setOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={open}
            aria-controls="main-menu-drawer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-surface"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          {current && (
            <p className="min-w-0 truncate font-semibold">
              <span aria-hidden className="mr-1.5">{current.icon}</span>
              {current.label}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={drawerRef}
            id="main-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูหลัก"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-[drawer-in_200ms_ease-out] flex-col overflow-y-auto overscroll-contain bg-white pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xl"
          >
            <div className="flex items-center justify-between px-4 pb-3">
              <p className="text-sm font-semibold tracking-[0.2em] text-baby-ink">MENU</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="ปิดเมนู"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="เมนูหลัก" className="px-3">
              <MainMenu
                items={items}
                active={active}
                onSelect={(id) => {
                  onSelect(id);
                  setOpen(false);
                  window.scrollTo({ top: 0 });
                }}
                onReorder={onReorder}
              />
            </nav>
            <ThemeSwitch />
          </div>
        </div>
      )}
    </>
  );
}

/** Light / Dark / Auto, at the bottom of the menu drawer (saved on this device). */
function ThemeSwitch() {
  const [mode, setMode] = useThemeMode();
  const options: [ThemeMode, string][] = [
    ["light", "Light"],
    ["dark", "Dark"],
    ["system", "Auto"],
  ];
  return (
    <div className="mt-auto px-4 pt-6">
      <p className="mb-1.5 text-[11px] font-medium text-ink-soft">ธีม</p>
      <div role="radiogroup" aria-label="ธีม" className="flex rounded-full bg-surface p-1">
        {options.map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            title={id === "system" ? "ตามการตั้งค่าของเครื่อง" : undefined}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              mode === id ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
