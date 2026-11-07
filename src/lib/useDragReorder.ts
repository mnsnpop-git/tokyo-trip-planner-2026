"use client";

import { useState } from "react";

/**
 * Drag-to-reorder for a vertical list, started from a drag handle.
 * Give the handle `touch-action: none` so touch drags don't scroll the page, and mark each
 * row with `data-reorder-id={id}`. Keyboard users can call `move(id, ±1)`.
 */
export function useDragReorder(ids: string[], onReorder: (ids: string[]) => void) {
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);

  const start = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const pointerId = e.pointerId;
    let order = ids;
    setDrag({ id, order });
    navigator.vibrate?.(10);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-reorder-id]");
      const overId = over?.dataset.reorderId;
      if (!over || !overId || overId === id || !order.includes(overId)) return;
      // Only swap once the pointer crosses the target's midpoint, so rows don't flicker back and forth.
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
    const end = (commit: boolean) => (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setDrag(null);
      if (commit && order !== ids) onReorder(order);
    };
    const onUp = end(true);
    const onCancel = end(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const move = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, id);
    onReorder(next);
  };

  return { order: drag ? drag.order : ids, draggingId: drag?.id ?? null, start, move };
}

/**
 * Apply a new order of a filtered subset back onto the full list: the subset's slots keep
 * their positions, filled in the new order, and hidden items stay where they were.
 */
export function mergeOrder<T extends { id: string }>(all: T[], subsetOrder: string[]): T[] {
  const inSubset = new Set(subsetOrder);
  const byId = new Map(all.map((x) => [x.id, x]));
  let i = 0;
  return all.map((x) => (inSubset.has(x.id) ? byId.get(subsetOrder[i++])! : x));
}
