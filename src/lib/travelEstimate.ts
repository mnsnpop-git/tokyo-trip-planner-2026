// Rough travel estimates between consecutive activities, from the coordinates in their Google Maps links.
// No routing service is used: the straight-line distance is stretched to a typical route length and
// turned into minutes at typical speeds. The leg also links to real directions in Google Maps.

export interface LatLng {
  lat: number;
  lng: number;
}

/** A place offered while typing a place name (GET /api/places). */
export interface PlaceSuggestion extends LatLng {
  name: string;
  address: string;
}

export type TravelMode = "walk" | "transit";

export const TRAVEL_MODES: Record<TravelMode, { label: string; icon: string; gmaps: string }> = {
  walk: { label: "เดิน", icon: "🚶", gmaps: "walking" },
  transit: { label: "รถไฟ/รถสาธารณะ", icon: "🚆", gmaps: "transit" },
};

export interface TravelEstimate {
  km: number; // straight-line distance
  mode: TravelMode;
  minutes: number;
}

/** Straight-line distances up to this are walked. */
const WALK_MAX_KM = 1.2;
/** Streets and rail lines are rarely straight: route length ≈ straight line × this. */
const DETOUR = 1.3;
const WALK_KMH = 4.5;
/** Walking to and from stations plus waiting for the train. */
const TRANSIT_OVERHEAD_MIN = 12;

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

function pair(lat: string, lng: string): LatLng | null {
  const p = { lat: Number(lat), lng: Number(lng) };
  return valid(p.lat, p.lng) ? p : null;
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const LAT_LNG = new RegExp(String.raw`^\s*${NUM}\s*,\s*${NUM}\s*$`);

/**
 * Coordinates written in a Google Maps URL, best first:
 * the place pin (`!3d…!4d…`), a "lat,lng" query (`q`, `query`, `destination`, `ll`…),
 * "lat,lng" in the path (`/maps/place/35.7,139.7`), then the map view centre (`@lat,lng`).
 * Short links (maps.app.goo.gl) and name-only links carry none; GET /api/geo resolves those.
 */
export function coordsFromMapUrl(raw: string): LatLng | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const text = safeDecode(url.pathname + url.search + url.hash);

  const pin = [...text.matchAll(new RegExp(String.raw`!3d${NUM}!4d${NUM}`, "g"))].at(-1);
  if (pin) {
    const p = pair(pin[1], pin[2]);
    if (p) return p;
  }
  for (const key of ["q", "query", "destination", "daddr", "ll", "sll", "center"]) {
    const m = url.searchParams.get(key)?.replace(/^loc:/, "").match(LAT_LNG);
    const p = m && pair(m[1], m[2]);
    if (p) return p;
  }
  const inPath = text.match(new RegExp(String.raw`/(?:place|search|dir)/${NUM},\s*\+?${NUM}(?:[/?]|$)`));
  if (inPath) {
    const p = pair(inPath[1], inPath[2]);
    if (p) return p;
  }
  const view = text.match(new RegExp(String.raw`@${NUM},${NUM}`));
  return view ? pair(view[1], view[2]) : null;
}

/**
 * The place a coordinate-less Google Maps link names, e.g. "Tokyo Tower, 4 Chome-2-8 Shibakoen…"
 * from `?q=` or `/maps/place/Tokyo+Tower/`; "" if none.
 */
export function placeTextFromMapUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  for (const key of ["q", "query", "destination", "daddr"]) {
    const v = url.searchParams.get(key)?.trim();
    if (v && !LAT_LNG.test(v)) return v;
  }
  const seg = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/)?.[1];
  return seg ? safeDecode(seg).trim() : "";
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** Google hosts a map link may redirect through; GET /api/geo follows nothing else. */
export function isGoogleMapsHost(hostname: string): boolean {
  return (
    hostname === "maps.app.goo.gl" ||
    hostname === "goo.gl" ||
    /^(www\.|maps\.|consent\.)?google\.(com|[a-z]{2,3}|com?\.[a-z]{2})$/.test(hostname)
  );
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Average transit speed, door-to-door excluded: city trains are slow, longer hops use faster lines. */
function transitKmh(routeKm: number): number {
  if (routeKm <= 15) return 25;
  if (routeKm <= 60) return 40;
  return 120; // limited express / shinkansen
}

export function estimateTravel(from: LatLng, to: LatLng): TravelEstimate {
  const km = distanceKm(from, to);
  const routeKm = km * DETOUR;
  if (km <= WALK_MAX_KM) {
    return { km, mode: "walk", minutes: Math.max(1, roundMinutes((routeKm / WALK_KMH) * 60)) };
  }
  return { km, mode: "transit", minutes: roundMinutes(TRANSIT_OVERHEAD_MIN + (routeKm / transitKmh(routeKm)) * 60) };
}

/** Exact under 10 minutes, then to the nearest 5. */
function roundMinutes(m: number): number {
  return m < 10 ? Math.round(m) : Math.round(m / 5) * 5;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ชม. ${rest} นาที` : `${h} ชม.`;
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} ม.` : `${km.toFixed(km < 10 ? 1 : 0)} กม.`;
}

/** Google Maps directions between two places; coordinates when known, otherwise the place name. */
export function directionsUrl(
  from: { coords: LatLng | null; name: string },
  to: { coords: LatLng | null; name: string },
  mode?: TravelMode,
): string {
  const where = (p: { coords: LatLng | null; name: string }) => (p.coords ? `${p.coords.lat},${p.coords.lng}` : p.name);
  const params = new URLSearchParams({ api: "1", origin: where(from), destination: where(to) });
  if (mode) params.set("travelmode", TRAVEL_MODES[mode].gmaps);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Minutes between two "HH:MM" times on the same day, or null. */
export function minutesBetween(from: string, to: string): number | null {
  const m = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : NaN);
  const d = m(to) - m(from);
  return Number.isFinite(d) ? d : null;
}

/**
 * Suggested visiting order for places with known coordinates: nearest-neighbour from `origin`
 * (the parent activity's location; without one, every start is tried), improved with 2-opt.
 * Places without coordinates keep their relative order at the end.
 */
export function suggestRoute(items: { id: string; coords: LatLng | null | undefined }[], origin: LatLng | null): string[] {
  const located = items.filter((x): x is { id: string; coords: LatLng } => !!x.coords);
  const rest = items.filter((x) => !x.coords).map((x) => x.id);
  if (located.length < 2) return [...located.map((x) => x.id), ...rest];

  const cost = (path: typeof located) =>
    path.reduce((sum, p, i) => sum + (i === 0 ? (origin ? distanceKm(origin, p.coords) : 0) : distanceKm(path[i - 1].coords, p.coords)), 0);

  const nearestFrom = (start: LatLng | null, first?: (typeof located)[number]) => {
    const left = located.filter((x) => x !== first);
    const path = first ? [first] : [];
    let at = first?.coords ?? start!;
    while (left.length) {
      let best = 0;
      for (let i = 1; i < left.length; i++) if (distanceKm(at, left[i].coords) < distanceKm(at, left[best].coords)) best = i;
      const [next] = left.splice(best, 1);
      path.push(next);
      at = next.coords;
    }
    return twoOpt(path);
  };

  // Reverse any stretch of the path while that makes it shorter.
  const twoOpt = (path: typeof located) => {
    let best = path;
    let bestCost = cost(path);
    for (let improved = true; improved; ) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++) {
        for (let j = i + 1; j < best.length; j++) {
          const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
          const c = cost(candidate);
          if (c < bestCost - 1e-9) {
            best = candidate;
            bestCost = c;
            improved = true;
          }
        }
      }
    }
    return best;
  };

  const path = origin
    ? nearestFrom(origin)
    : located.map((first) => nearestFrom(null, first)).reduce((a, b) => (cost(b) < cost(a) - 1e-9 ? b : a));
  return [...path.map((x) => x.id), ...rest];
}
