"use client";

import { useEffect, useRef } from "react";

/*
 * Sign-in expiry after a period without use. The time of the last tap/click/key/scroll is kept in
 * localStorage, so every tab of the app shares it (using one tab keeps the others signed in) and
 * it survives reloads. Phones pause timers in background tabs, so it is also checked when the page
 * becomes visible again and when the app starts (see isIdleExpired).
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const LAST_ACTIVE_KEY = "tokyo-trip-planner:last-active";
/** Don't write the timestamp more often than this while someone is busy scrolling or typing. */
const WRITE_EVERY_MS = 15_000;
const CHECK_EVERY_MS = 30_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

function lastActive(): number | null {
  try {
    const t = Number(localStorage.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}

export function markActive(now = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    // storage blocked: the timer then only runs while this page is open
  }
}

/** True when the app was last used longer than the timeout ago (unknown = not expired). */
export function isIdleExpired(now = Date.now()): boolean {
  const t = lastActive();
  return t !== null && now - t > IDLE_TIMEOUT_MS;
}

/** While `active`, call `onTimeout` once nobody has used the app (in any tab) for IDLE_TIMEOUT_MS. */
export function useIdleTimeout(active: boolean, onTimeout: () => void) {
  const callback = useRef(onTimeout);
  useEffect(() => {
    callback.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!active) return;
    let local = Date.now(); // fallback when storage is blocked
    let written = 0;
    markActive(local);

    const onActivity = () => {
      local = Date.now();
      if (local - written >= WRITE_EVERY_MS) {
        written = local;
        markActive(local);
      }
    };
    const check = () => {
      const t = Math.max(lastActive() ?? 0, local);
      if (Date.now() - t > IDLE_TIMEOUT_MS) callback.current();
    };
    const onVisible = () => document.visibilityState === "visible" && check();

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [active]);
}
