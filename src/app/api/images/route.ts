import { checkPin } from "@/lib/pin";
import { BUCKET, IMAGE_TYPES, MAX_IMAGE_BYTES, ensureBucket } from "@/lib/imageStorage";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readTrip } from "@/lib/tripStore";

/*
 * Photo uploads go to Supabase Storage (see lib/imageStorage.ts) so the trip data only holds
 * a short https:// link instead of the whole picture — browser storage and the trip row stay small.
 * Anyone with a link can open the photo (like the trip itself, which guests can view); uploading
 * needs a member's PIN, same as saving the trip. Files are removed again when a save of the trip
 * no longer links to them (PUT /api/trip).
 */

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function isMember(request: Request): Promise<boolean> {
  const members = ((await readTrip()).trip as { members?: unknown } | null)?.members;
  if (!Array.isArray(members) || members.length === 0) return true; // nothing stored yet, like PUT /api/trip
  const id = request.headers.get("x-trip-member") ?? "";
  const member = members.find((m): m is { id: string; pinHash?: string } => !!m && typeof m === "object" && m.id === id);
  const pin = request.headers.get("x-trip-pin");
  return !!member && !!pin && checkPin(member, pin);
}

/** POST /api/images (body: the image bytes, Content-Type image/jpeg|png|webp|gif) → { url }. */
export async function POST(request: Request) {
  const sb = getSupabaseAdmin();
  if (!sb) return json({ configured: false }, 503);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = IMAGE_TYPES[type];
  if (!ext) return json({ error: "bad_type" }, 415);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return json({ error: "empty" }, 400);
  if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 413);

  try {
    if (!(await isMember(request))) return json({ error: "pin" }, 403);
    await ensureBucket(sb);
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: type, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return json({ url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
