"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "./themeScript";

/*
 * Light / Dark / Auto (follow the device). A per-device preference, like the menu order.
 * The chosen theme is put on <html data-theme="…"> and globals.css swaps the colour tokens.
 * THEME_SCRIPT (themeScript.ts) runs before the page paints, so there's no flash of the wrong theme.
 */

export type ThemeMode = "light" | "dark" | "system";


function readMode(): ThemeMode {
  try {
    const m = localStorage.getItem(KEY);
    return m === "light" || m === "dark" ? m : "system";
  } catch {
    return "system";
  }
}

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readMode);

  useEffect(() => {
    apply(mode);
    if (mode !== "system") return;
    // Auto: follow the device when it switches (e.g. at sunset).
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const choose = (m: ThemeMode) => {
    setMode(m);
    try {
      if (m === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, m);
    } catch {
      // storage blocked: the choice still holds for this visit
    }
  };
  return [mode, choose];
}
