"use client";

import { useEffect, useState } from "react";
import { PIN_LENGTH } from "@/lib/pin";
import { Modal } from "./Modal";

/**
 * 4-digit PIN entry: dots plus an on-screen keypad (keyboard digits and Backspace work too).
 * `check` decides whether the PIN is right; a wrong PIN clears the dots and shows an error.
 */
export function PinPad({
  title,
  subtitle,
  avatar,
  check,
  onSuccess,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  avatar?: string;
  check: (pin: string) => boolean;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const press = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setError(false);
    if (next.length < PIN_LENGTH) return setPin(next);
    if (check(next)) {
      setPin(next);
      onSuccess(next);
    } else {
      setPin("");
      setError(true);
      navigator.vibrate?.(80);
    }
  };
  const back = () => {
    setError(false);
    setPin((p) => p.slice(0, -1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const key = "flex h-14 items-center justify-center rounded-2xl bg-surface text-xl font-semibold transition hover:bg-baby active:scale-95";

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="mx-auto max-w-xs pb-2 text-center">
        {avatar && (
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-line bg-white text-4xl shadow-sm">
            {avatar}
          </span>
        )}
        <p className="mt-3 text-sm text-ink-soft">{subtitle ?? `ใส่ PIN ${PIN_LENGTH} หลัก`}</p>
        <div
          role="status"
          aria-label={`ใส่แล้ว ${pin.length} จาก ${PIN_LENGTH} หลัก`}
          className={`my-4 flex justify-center gap-3 ${error ? "animate-[shake_0.3s]" : ""}`}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition ${
                i < pin.length ? "border-ink bg-ink" : error ? "border-alert-ink" : "border-line"
              }`}
            />
          ))}
        </div>
        <p aria-live="assertive" className="h-5 text-sm font-medium text-alert-ink">
          {error ? "PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง" : ""}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className={key}>
              {d}
            </button>
          ))}
          <span />
          <button type="button" onClick={() => press("0")} className={key}>
            0
          </button>
          <button type="button" onClick={back} aria-label="ลบตัวเลข" className={`${key} text-base text-ink-soft`}>
            ⌫
          </button>
        </div>
      </div>
    </Modal>
  );
}
