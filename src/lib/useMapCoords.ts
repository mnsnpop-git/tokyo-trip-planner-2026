"use client";

import { useEffect, useSyncExternalStore } from "react";
import { coordsFromMapUrl, isGoogleMapsHost, type LatLng } from "./travelEstimate";

/*
 * Coordinates of Google Maps links, shared by every component on the page.
 * Links with coordinates are read right away; short share links and name-only links are resolved
 * once through GET /api/geo and remembered on this device, so reloading doesn't ask again.
 * Values: LatLng = found, null = the link has no usable location, undefined = still looking.
 */

const STORAGE_KEY = "trip-planner:map-coords:v1";

let coords = new Map<string, LatLng | null>();
let loaded = false;
const pending = new Set<string>();
const listeners = new Set<() => void>();
const EMPTY = new Map<string, LatLng | null>();
/** Resolved short links, as saved in localStorage. */
const remembered = new Map<string, LatLng | null>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, LatLng | null>;
    for (const [url, value] of Object.entries(saved)) remembered.set(url, value);
    coords = new Map(remembered);
  } catch {
    // Storage blocked or corrupt: just resolve again.
  }
}

/** `remember: false` keeps a failed lookup for this visit only, so the next visit tries again. */
function set(url: string, value: LatLng | null, remember = true) {
  pending.delete(url);
  coords = new Map(coords).set(url, value);
  if (remember) {
    remembered.set(url, value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(remembered)));
    } catch {
      // Not remembering is fine.
    }
  }
  listeners.forEach((l) => l());
}

function resolve(url: string) {
  load();
  if (coords.has(url) || pending.has(url)) return;
  const direct = coordsFromMapUrl(url);
  if (direct || !isGoogleMapsHost(hostOf(url))) {
    set(url, direct, false); // cheap to read again
    return;
  }
  pending.add(url);
  fetch(`/api/geo?url=${encodeURIComponent(url)}`)
    .then(async (res) => {
      const body = (await res.json()) as { lat?: number | null; lng?: number | null };
      if (res.ok) set(url, typeof body.lat === "number" && typeof body.lng === "number" ? { lat: body.lat, lng: body.lng } : null);
      else set(url, null, res.status < 500);
    })
    .catch(() => set(url, null, false));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Coordinates for each of these map links (see the values above). */
export function useMapCoords(urls: string[]): Map<string, LatLng | null> {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return coords;
    },
    () => EMPTY,
  );
  const key = urls.join("\n");
  useEffect(() => {
    for (const url of key.split("\n")) if (url) resolve(url);
  }, [key]);
  return snapshot;
}
