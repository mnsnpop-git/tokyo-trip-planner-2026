import { connection } from "next/server";
import type { PlaceSuggestion } from "@/lib/travelEstimate";

/*
 * GET /api/places?q=<text>[&lat=&lng=] → { places: { name, address, lat, lng }[] }.
 *
 * Search-as-you-type for place names, from Photon (OpenStreetMap data, made for autocomplete;
 * Nominatim's policy forbids that use). Results near lat/lng rank higher. Proxied here because
 * Photon doesn't allow browser requests from other sites (no CORS).
 */

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

const json = (data: unknown, status = 200, cache = true) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": cache ? "public, max-age=3600, s-maxage=86400" : "no-store" },
  });

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return json({ places: [] });

  const search = new URLSearchParams({ q, limit: "8", lang: "en" });
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.get("lat") && params.get("lng") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    search.set("lat", String(lat));
    search.set("lon", String(lng));
  }

  try {
    const res = await fetch(`https://photon.komoot.io/api/?${search}`, {
      headers: { "User-Agent": "trip-planner/1.0 (personal trip planner)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return json({ error: `photon ${res.status}` }, 502, false);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const places: PlaceSuggestion[] = [];
    for (const f of body.features ?? []) {
      const [fLng, fLat] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      const name = p.name || [p.housenumber, p.street].filter(Boolean).join(" ");
      if (!name || typeof fLat !== "number" || typeof fLng !== "number" || !Number.isFinite(fLat) || !Number.isFinite(fLng)) continue;
      // Japanese "streets" are often just block numbers ("16 1"): those say nothing, so leave them out.
      const street = p.street && !/^\d+$/.test(p.street) ? (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) : "";
      const address = [street, p.locality, p.district, p.city, p.country]
        .filter((x, i, all) => x && x !== name && all.indexOf(x) === i)
        .join(", ");
      const key = `${name}|${address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({ name, address, lat: fLat, lng: fLng });
    }
    return json({ places: places.slice(0, 6) });
  } catch {
    return json({ error: "lookup_failed" }, 502, false);
  }
}
