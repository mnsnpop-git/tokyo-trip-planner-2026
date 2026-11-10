import { connection } from "next/server";
import { coordsFromMapUrl, isGoogleMapsHost, placeTextFromMapUrl, type LatLng } from "@/lib/travelEstimate";

/*
 * GET /api/geo?url=<Google Maps link> → { lat, lng } or { lat: null, lng: null }.
 *
 * Short share links (maps.app.goo.gl) hide the place behind a redirect the browser can't read
 * (no CORS), so the server follows it here — only ever to Google Maps hosts, one hop at a time.
 * If the final link still has no coordinates, only a place name/address (`?q=…`, `/maps/place/…`),
 * that text is looked up on OpenStreetMap Nominatim. Google's own page is not used: without
 * JavaScript it only shows the visitor's area, not the place.
 */

const MAX_HOPS = 6;

const json = (data: LatLng | { lat: null; lng: null } | { error: string }, status = 200, cache = true) =>
  Response.json(data, {
    status,
    // A link always points at the same place: let browsers and the CDN keep the answer.
    headers: { "Cache-Control": cache ? "public, max-age=86400, s-maxage=2592000" : "no-store" },
  });

const NONE = { lat: null, lng: null };
const allowed = (u: URL) => (u.protocol === "https:" || u.protocol === "http:") && isGoogleMapsHost(u.hostname);

export async function GET(request: Request) {
  await connection();
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return json({ error: "bad_url" }, 400, false);
  }
  if (!allowed(url)) return json({ error: "not_google_maps" }, 400, false);

  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const found = coordsFromMapUrl(url.href);
      if (found) return json(found);

      // Outside the US Google may first send visitors to a cookie-consent page; its target is in `continue`.
      const next = url.hostname.startsWith("consent.") ? url.searchParams.get("continue") : null;
      if (next) {
        url = new URL(next);
        if (!allowed(url)) return json(NONE);
        continue;
      }
      // Only short links redirect to the place; a full link is already its final form.
      if (url.hostname !== "maps.app.goo.gl" && url.hostname !== "goo.gl") break;

      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      res.body?.cancel().catch(() => {});
      const location = res.headers.get("location");
      if (!(res.status >= 300 && res.status < 400 && location)) return json(NONE);
      url = new URL(location, url);
      if (!allowed(url)) return json(NONE);
    }
    return json((await geocode(placeTextFromMapUrl(url.href))) ?? NONE);
  } catch {
    return json({ error: "lookup_failed" }, 502, false);
  }
}

// Nominatim allows at most one request a second: lookups from this server instance wait in line.
let queue: Promise<unknown> = Promise.resolve();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nominatim(q: string): Promise<LatLng | null> {
  const run = queue.then(async () => {
    const params = new URLSearchParams({ format: "jsonv2", limit: "1", q });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "trip-planner/1.0 (personal trip planner)", "Accept-Language": "en,ja,th" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const p = hit && { lat: Number(hit.lat), lng: Number(hit.lon) };
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
  });
  queue = run.catch(() => {}).then(() => wait(1100));
  return run;
}

/**
 * Full text first ("Tokyo Tower, 4 Chome-2-8 Shibakoen, Minato City, Tokyo…" often fails on
 * Japanese street addresses), then the name with the last part (city/country), then the name alone.
 */
async function geocode(text: string): Promise<LatLng | null> {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const tries = [...new Set([parts.join(", "), parts.length > 2 ? `${parts[0]}, ${parts.at(-1)}` : "", parts[0]])].filter(Boolean);
  for (const q of tries) {
    const p = await nominatim(q);
    if (p) return p;
  }
  return null;
}
