import { getSupabaseAdmin } from "./supabase/server";

/*
 * Trip photos in Supabase Storage (public bucket `trip-images`). Server only.
 * The trip data holds each photo's public URL; a file is removed once no saved trip links to it.
 */

export const BUCKET = "trip-images";
/** Photos are downscaled in the browser first (~100–300 KB), so this is generous. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

let bucketReady: Promise<void> | null = null;

/** Create the bucket the first time it's needed (no manual Supabase setup). */
export function ensureBucket(sb: Admin) {
  bucketReady ??= (async () => {
    const { data } = await sb.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: Object.keys(IMAGE_TYPES),
    });
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  })().catch((e) => {
    bucketReady = null; // try again next time
    throw e;
  });
  return bucketReady;
}

/** Paths (inside the bucket) of every one of our stored photos linked anywhere in `trip`. */
export function storedImagePaths(sb: Admin, trip: unknown): Set<string> {
  const prefix = sb.storage.from(BUCKET).getPublicUrl("").data.publicUrl.replace(/\/?$/, "/");
  const paths = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.startsWith(prefix)) {
        const path = decodeURIComponent(v.slice(prefix.length).split(/[?#]/)[0]);
        if (path) paths.add(path);
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(trip);
  return paths;
}

/** Delete photos the previous saved trip linked to but the new one doesn't. */
export async function removeUnlinkedImages(sb: Admin, before: unknown, after: unknown) {
  const still = storedImagePaths(sb, after);
  const gone = [...storedImagePaths(sb, before)].filter((p) => !still.has(p));
  if (gone.length === 0) return;
  const { error } = await sb.storage.from(BUCKET).remove(gone);
  if (error) console.error("Removing deleted trip photos failed:", error.message);
}
