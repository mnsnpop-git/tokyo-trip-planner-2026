import { getSupabaseAdmin } from "./supabase/server";

/*
 * Storage for the one shared trip, in the Supabase table `trips` (see supabase/schema.sql).
 * Every save names the version it was based on; if someone else saved in between, it's refused
 * as a conflict so the client can merge and retry instead of overwriting their edit.
 */

const TRIP_ID = "main";

export type StoredTrip = { version: number; trip: unknown | null; updatedAt: string | null };
export type SaveResult = { ok: true; version: number; updatedAt: string } | { ok: false; conflict: true };

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured");
  return sb;
}

export async function readTrip(): Promise<StoredTrip> {
  const { data, error } = await db().from("trips").select("data, version, updated_at").eq("id", TRIP_ID).limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? { version: row.version, trip: row.data, updatedAt: row.updated_at } : { version: 0, trip: null, updatedAt: null };
}

export async function readVersion(): Promise<number> {
  const { data, error } = await db().from("trips").select("version").eq("id", TRIP_ID).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.version ?? 0;
}

/** Save if the stored version is still `baseVersion` (0 = nothing stored yet). */
export async function saveTrip(baseVersion: number, trip: unknown): Promise<SaveResult> {
  const updatedAt = new Date().toISOString();
  if (baseVersion === 0) {
    const { error } = await db().from("trips").insert({ id: TRIP_ID, data: trip, version: 1, updated_at: updatedAt });
    if (!error) return { ok: true, version: 1, updatedAt };
    if (error.code === "23505") return { ok: false, conflict: true }; // someone created it first
    throw new Error(error.message);
  }
  // Compare-and-set in one statement: only matches while nobody else has saved since.
  const { data, error } = await db()
    .from("trips")
    .update({ data: trip, version: baseVersion + 1, updated_at: updatedAt })
    .eq("id", TRIP_ID)
    .eq("version", baseVersion)
    .select("version");
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? { ok: true, version: baseVersion + 1, updatedAt } : { ok: false, conflict: true };
}
