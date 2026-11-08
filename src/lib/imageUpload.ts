"use client";

import { createContext, useContext } from "react";

/**
 * Uploads a photo to the server (/api/images → Supabase Storage) and returns its https:// link.
 * Returns null when there's no server storage (local-only mode), so the caller can keep the photo
 * inline instead. Throws if the upload itself failed.
 */
export type UploadImage = (image: Blob) => Promise<string | null>;

export type UploadAuth = { memberId: string; pin: string } | null;

export function makeUploader(auth: UploadAuth): UploadImage {
  return async (image) => {
    if (!auth) return null;
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": image.type || "image/jpeg", "x-trip-member": auth.memberId, "x-trip-pin": auth.pin },
      body: image,
    });
    const body = (await res.json().catch(() => ({}))) as { url?: string; configured?: boolean; error?: string };
    if (body.configured === false) return null;
    if (!res.ok || !body.url) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body.url;
  };
}

const UploadContext = createContext<UploadImage>(async () => null);

export const ImageUploadProvider = UploadContext.Provider;

export const useImageUpload = () => useContext(UploadContext);

/** Every inline (data:image) photo anywhere in the trip. */
export function inlineImages(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.startsWith("data:image/")) found.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

/** Copy of `value` with strings swapped according to `map`. */
export function replaceStrings<T>(value: T, map: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return map.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
