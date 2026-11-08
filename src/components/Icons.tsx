"use client";

import { useState } from "react";
import { useReadOnly } from "./ReadOnly";

/* Small solid icons on a 20×20 grid, drawn in currentColor. */

export function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.3 9.3a1 1 0 0 1-.46.26l-3.9 1a.75.75 0 0 1-.91-.91l1-3.9a1 1 0 0 1 .26-.46l9.3-9.3Z" />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M8 2a1 1 0 0 0-1 1v1H4a.75.75 0 0 0 0 1.5h12A.75.75 0 0 0 16 4h-3V3a1 1 0 0 0-1-1H8Z" />
      <path
        fillRule="evenodd"
        d="M4.8 7h10.4l-.7 9.2A2 2 0 0 1 12.5 18h-5a2 2 0 0 1-2-1.8L4.8 7Zm3.45 2.25a.75.75 0 0 0-1.5.08l.25 5.5a.75.75 0 0 0 1.5-.07l-.25-5.5Zm5 .08a.75.75 0 0 0-1.5-.08l-.25 5.5a.75.75 0 0 0 1.5.07l.25-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M10 3.5a1 1 0 0 1 1 1V9h4.5a1 1 0 1 1 0 2H11v4.5a1 1 0 1 1-2 0V11H4.5a1 1 0 1 1 0-2H9V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

export function EyeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.66 10.59a1.5 1.5 0 0 1 0-1.18C2.2 5.73 5.8 3.5 10 3.5s7.8 2.23 9.34 5.91a1.5 1.5 0 0 1 0 1.18C17.8 14.27 14.2 16.5 10 16.5S2.2 14.27.66 10.59ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ShareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12.5V3m0 0L6.5 6.5M10 3l3.5 3.5" />
      <path d="M6 9.5H5a1.5 1.5 0 0 0-1.5 1.5v4.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 15 9.5h-1" />
    </svg>
  );
}

const ICONS = { edit: PencilIcon, delete: TrashIcon, add: PlusIcon, close: XIcon, confirm: CheckIcon, view: EyeIcon, share: ShareIcon };

/** Icons guests still see (they only look, never change anything). */
const GUEST_ICONS = new Set<keyof typeof ICONS>(["close", "view", "share"]);

type Tone = "ghost" | "danger" | "solid";

const TONES: Record<Tone, string> = {
  // Same look as the day-edit pencil on TripPlan.
  ghost: "text-ink-soft hover:bg-surface hover:text-ink",
  danger: "bg-alert-ink text-white hover:opacity-90",
  solid: "bg-ink text-white hover:opacity-90",
};

/** Round, icon-only action button. `label` is read by screen readers and shown as a tooltip. */
export function IconButton({
  icon,
  label,
  onClick,
  tone = "ghost",
  size = "md",
  type = "button",
  disabled,
  className = "",
  ...rest
}: {
  icon: keyof typeof ICONS;
  label: string;
  onClick?: () => void;
  tone?: Tone;
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type" | "className" | "children">) {
  const readOnly = useReadOnly();
  const Icon = ICONS[icon];
  // Guests only see close/view buttons; every add/edit/delete/confirm action is hidden.
  if (readOnly && !GUEST_ICONS.has(icon)) return null;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 ${
        size === "sm" ? "h-7 w-7" : "h-8 w-8"
      } ${TONES[tone]} ${className}`}
      {...rest}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

/**
 * Trash icon that asks before deleting: a first tap swaps it for a red confirm (trash)
 * and a cancel (×) button.
 */
export function DeleteButton({
  label,
  onConfirm,
  disabled,
  size = "md",
  title,
}: {
  /** e.g. "ลบ Tokyo Skytree" */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Tooltip override, e.g. why it's disabled. */
  title?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const readOnly = useReadOnly();
  if (readOnly) return null;
  if (confirming) {
    return (
      <span role="group" aria-label={`${label}?`} className="flex shrink-0 items-center gap-0.5">
        <IconButton
          icon="delete"
          tone="danger"
          size={size}
          label={`ยืนยัน${label}`}
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          autoFocus
        />
        <IconButton icon="close" size={size} label="ยกเลิก" onClick={() => setConfirming(false)} />
      </span>
    );
  }
  return (
    <IconButton
      icon="delete"
      size={size}
      label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={() => setConfirming(true)}
    />
  );
}

/**
 * Click handler for a card that has a "view details" button: a tap anywhere on the card opens the
 * details too, except on its own controls (buttons, links, inputs). Keyboard users keep the 👁 button.
 */
export function openOnCardClick(open: () => void) {
  return (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, summary, [role=button], [role=checkbox]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not opening
    open();
  };
}
