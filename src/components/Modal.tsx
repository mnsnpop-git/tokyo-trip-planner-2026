"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "./Icons";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stop the page behind from scrolling while the sheet is open (iOS otherwise scrolls both).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90dvh] sm:rounded-3xl sm:px-6 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header stays visible while long forms scroll. */}
        <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-center justify-between gap-3 border-b border-line/60 bg-white px-5 pb-3 pt-4 sm:-mx-6 sm:px-6 sm:pt-6">
          <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface/60 px-3 py-2 text-base outline-none sm:text-sm transition focus:border-baby-ink focus:bg-white focus:ring-2 focus:ring-baby";

export const labelClass = "mb-1 block text-xs font-medium text-ink-soft";
