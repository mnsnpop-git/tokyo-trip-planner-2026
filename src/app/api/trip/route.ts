import { connection } from "next/server";
import { checkPin } from "@/lib/pin";
import { supabaseConfigured } from "@/lib/supabase/server";
import { readTrip, readVersion, saveTrip } from "@/lib/tripStore";

/*
 * Shared trip storage (Supabase), so every browser sees the same, latest data.
 *
 * Saves send the version they were based on; if someone else saved in between, the save is
 * refused (409) with the latest data so the client can merge and retry — nobody's edit is
 * silently overwritten. Saving also needs a member's PIN, so guests can't write.
 */

/** Keep requests a sensible size (photos are stored inline as data URLs). */
const MAX_BYTES = 9 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/trip → { configured, version, updatedAt, trip }. `?meta=1` skips the trip body (cheap polling). */
export async function GET(request: Request) {
  await connection();
  if (!supabaseConfigured()) return json({ configured: false });
  try {
    if (new URL(request.url).searchParams.get("meta")) {
      return json({ configured: true, version: await readVersion() });
    }
    return json({ configured: true, ...(await readTrip()) });
  } catch (e) {
    return json({ configured: true, error: (e as Error).message }, 502);
  }
}

/**
 * Saving needs a member's PIN (headers x-trip-member / x-trip-pin), checked against the members
 * currently stored. `x-trip-prev-pin` covers the save in which a member changes their own PIN.
 * An empty store accepts the first upload.
 */
async function canWrite(request: Request, stored: unknown): Promise<boolean> {
  const members = (stored as { members?: unknown } | null)?.members;
  if (!Array.isArray(members) || members.length === 0) return true;
  const id = request.headers.get("x-trip-member") ?? "";
  const member = members.find((m): m is { id: string; pinHash?: string } => !!m && typeof m === "object" && m.id === id);
  if (!member) return false;
  const pins = [request.headers.get("x-trip-pin"), request.headers.get("x-trip-prev-pin")];
  return pins.some((pin) => !!pin && checkPin(member, pin));
}

/** PUT /api/trip { trip, baseVersion } → { version } | 409 { version, trip } when out of date. */
export async function PUT(request: Request) {
  if (!supabaseConfigured()) return json({ configured: false }, 503);
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: "too_large" }, 413);

  let body: { trip?: unknown; baseVersion?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const trip = body.trip as Record<string, unknown> | undefined;
  const baseVersion = Number(body.baseVersion);
  if (!trip || typeof trip !== "object" || !Array.isArray(trip.days) || !Array.isArray(trip.activities) || !Number.isInteger(baseVersion)) {
    return json({ error: "bad_trip" }, 400);
  }

  try {
    const current = await readTrip();
    if (!(await canWrite(request, current.trip))) return json({ error: "pin" }, 403);
    const result = await saveTrip(baseVersion, trip);
    if (result.ok) return json({ version: result.version, updatedAt: result.updatedAt });
    return json(await readTrip(), 409);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
