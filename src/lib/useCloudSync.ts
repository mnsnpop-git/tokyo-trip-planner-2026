"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TripData } from "./trip";

export type SyncStatus =
  | "connecting" // first load from the server
  | "local" // no server database configured: this browser only
  | "synced"
  | "saving"
  | "offline" // couldn't reach the server; will retry
  | "tooLarge" // trip too big to upload (usually photos)
  | "denied"; // the server didn't accept this profile's PIN

const META_KEY = "tokyo-trip-planner:sync";
const POLL_MS = 15_000;
const SAVE_DELAY_MS = 800;

type Meta = { version: number; dirty: boolean };
type ServerTrip = { configured: boolean; version?: number; updatedAt?: string | null; trip?: unknown; error?: string };

function readMeta(): Meta | null {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Meta | null;
    return m && typeof m.version === "number" ? m : null;
  } catch {
    return null;
  }
}
function writeMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // storage blocked; sync still works for this session
  }
}

/**
 * Three-way merge per top-level section: sections this device changed since the last sync keep the
 * local version, everything else takes the server's. Two people editing different menus both win.
 */
function merge(local: TripData, base: TripData, server: TripData): TripData {
  const out = { ...server } as Record<string, unknown>;
  for (const k of Object.keys(local) as (keyof TripData)[]) {
    if (JSON.stringify(local[k]) !== JSON.stringify(base[k])) out[k] = local[k];
  }
  return out as unknown as TripData;
}

/**
 * Keeps `trip` in step with the shared copy on the server (/api/trip).
 * - On open: the server's latest data wins (this device's unsynced data is backed up first).
 * - On every change: saved to the server shortly after.
 * - Every 15 s and when the tab regains focus: pulls changes made on other devices.
 */
export function useCloudSync({
  trip,
  setTrip,
  parse,
  hadLocalSave,
  backupLocal,
  auth,
  readOnly,
}: {
  trip: TripData;
  setTrip: (t: TripData) => void;
  /** Normalize trip JSON coming from the server (same rules as loading from localStorage). */
  parse: (value: unknown) => TripData;
  /** Whether this browser had its own saved trip (not just the built-in sample). */
  hadLocalSave: boolean;
  /** Keep a copy of this device's data before the server's version replaces it. */
  backupLocal: (t: TripData) => void;
  /** Signed-in member and PIN, sent with every save so the server can check it. */
  auth: { memberId: string; pin: string; prevPin?: string } | null;
  /** Guest: only pull, never push. */
  readOnly: boolean;
}) {
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  /** This device's data that was replaced by the server's on open (offered for restore). */
  const [replaced, setReplaced] = useState<TripData | null>(null);

  const ready = useRef(false);
  const version = useRef(0);
  const base = useRef<TripData | null>(null); // last state known to match the server
  const baseJson = useRef("");
  const latest = useRef(trip);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lets a save schedule another save (after a merge or new edits) without referencing itself.
  const pushAgain = useRef<() => void>(() => {});
  const authRef = useRef(auth);
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    authRef.current = auth;
    readOnlyRef.current = readOnly;
  }, [auth, readOnly]);

  useEffect(() => {
    latest.current = trip;
  }, [trip]);

  const adopt = useCallback(
    (t: TripData, v: number, at: string | null | undefined) => {
      base.current = t;
      baseJson.current = JSON.stringify(t);
      version.current = v;
      if (at) setUpdatedAt(at);
      writeMeta({ version: v, dirty: false });
      setTrip(t);
    },
    [setTrip],
  );

  const push = useCallback(async () => {
    if (!ready.current || inflight.current || readOnlyRef.current) return;
    const who = authRef.current;
    if (!who) return;
    const sending = latest.current;
    const sendingJson = JSON.stringify(sending);
    if (sendingJson === baseJson.current) return;
    inflight.current = true;
    setStatus("saving");
    try {
      const res = await fetch("/api/trip", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-trip-member": who.memberId,
          "x-trip-pin": who.pin,
          ...(who.prevPin && { "x-trip-prev-pin": who.prevPin }),
        },
        body: JSON.stringify({ trip: sending, baseVersion: version.current }),
      });
      if (res.status === 413) return setStatus("tooLarge");
      if (res.status === 403) return setStatus("denied");
      const body = (await res.json()) as ServerTrip;
      if (res.status === 409 && body.trip) {
        // Someone else saved first: merge their sections with ours, then save again.
        const server = parse(body.trip);
        if (!base.current) {
          // Both devices uploaded to an empty server; theirs landed first. Keep ours restorable.
          backupLocal(latest.current);
          setReplaced(latest.current);
        }
        const merged = base.current ? merge(latest.current, base.current, server) : server;
        base.current = server;
        baseJson.current = JSON.stringify(server);
        version.current = body.version ?? version.current;
        if (body.updatedAt) setUpdatedAt(body.updatedAt);
        setTrip(merged);
        // Retry after this attempt's `finally` has released the lock.
        return void setTimeout(() => pushAgain.current(), 0);
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      version.current = body.version ?? version.current;
      base.current = sending;
      baseJson.current = sendingJson;
      if (body.updatedAt) setUpdatedAt(body.updatedAt);
      const stillDirty = JSON.stringify(latest.current) !== sendingJson;
      writeMeta({ version: version.current, dirty: stillDirty });
      setStatus(stillDirty ? "saving" : "synced");
      if (stillDirty) setTimeout(() => pushAgain.current(), 0);
    } catch {
      setStatus("offline");
    } finally {
      inflight.current = false;
    }
  }, [parse, setTrip, backupLocal]);

  useEffect(() => {
    pushAgain.current = () => void push();
  }, [push]);

  const pull = useCallback(async () => {
    if (!ready.current || inflight.current) return;
    try {
      const meta = (await (await fetch("/api/trip?meta=1", { cache: "no-store" })).json()) as ServerTrip;
      const dirty = !readOnlyRef.current && JSON.stringify(latest.current) !== baseJson.current;
      if (dirty) return void push(); // our pending save will merge with whatever is new
      if ((meta.version ?? 0) <= version.current) return setStatus("synced");
      const full = (await (await fetch("/api/trip", { cache: "no-store" })).json()) as ServerTrip;
      if (full.trip && (readOnlyRef.current || JSON.stringify(latest.current) === baseJson.current)) {
        adopt(parse(full.trip), full.version ?? 0, full.updatedAt);
      }
      setStatus("synced");
    } catch {
      setStatus("offline");
    }
  }, [adopt, parse, push]);

  // First load: take the server's latest copy (or upload this device's data if the server is empty).
  // Retried by the poller if it failed (e.g. opened while offline).
  const initDone = useRef(false);
  const init = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (initDone.current) return;
      try {
        const res = await fetch("/api/trip", { cache: "no-store" });
        const body = (await res.json()) as ServerTrip;
        if (cancelled) return;
        initDone.current = true; // also when no database is configured: stay local, don't keep asking
        if (!body.configured) return setStatus("local");
        if (!res.ok) throw new Error(body.error);
        const meta = readMeta();
        const local = latest.current;
        ready.current = true;
        if (!body.trip) {
          // Empty server: this device's saved trip becomes the shared one.
          version.current = body.version ?? 0;
          base.current = null;
          baseJson.current = hadLocalSave ? "" : JSON.stringify(local);
          if (hadLocalSave) void push();
          else setStatus("synced");
          return;
        }
        const server = parse(body.trip);
        const serverVersion = body.version ?? 0;
        if (meta?.dirty && meta.version === serverVersion) {
          // Offline edits made on top of the current server copy: just upload them.
          base.current = server;
          baseJson.current = JSON.stringify(server);
          version.current = serverVersion;
          if (body.updatedAt) setUpdatedAt(body.updatedAt);
          return void push();
        }
        const differs = JSON.stringify(local) !== JSON.stringify(server);
        if (hadLocalSave && differs && (!meta || meta.dirty) && !readOnlyRef.current) {
          // This device has data the server never saw: keep it so it can be restored.
          backupLocal(local);
          setReplaced(local);
        }
        adopt(server, serverVersion, body.updatedAt);
        setStatus("synced");
      } catch {
        initDone.current = false;
        if (!cancelled) setStatus("offline");
      }
    };
    init.current = () => void run();
    void run();
    return () => {
      cancelled = true;
    };
    // Runs once on mount; later changes go through push/pull.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save shortly after each change.
  useEffect(() => {
    if (!ready.current || readOnly || JSON.stringify(trip) === baseJson.current) return;
    writeMeta({ version: version.current, dirty: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(), SAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [trip, push, readOnly]);

  // Pull other people's changes: on an interval, and when the tab or the network comes back.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!ready.current) return init.current();
      void pull();
    };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pull]);

  /** Put this device's replaced data back (it then saves over the server copy). */
  const restoreReplaced = () => {
    if (replaced) setTrip(replaced);
    setReplaced(null);
  };

  return { status, updatedAt, replaced: !!replaced, restoreReplaced, dismissReplaced: () => setReplaced(null) };
}
