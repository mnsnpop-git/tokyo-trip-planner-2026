"use client";

import { useEffect, useId, useState } from "react";
import { mapsSearchUrl } from "@/lib/trip";
import { placeTextFromMapUrl, type LatLng, type PlaceSuggestion } from "@/lib/travelEstimate";
import { inputClass, labelClass } from "./Modal";

/** A Google Maps link that opens the picked place and carries its coordinates (read by coordsFromMapUrl). */
export const placeMapUrl = (p: PlaceSuggestion) =>
  `https://www.google.com/maps/place/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z`;

const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s.trim());

/**
 * Google Maps field that takes either a pasted link or a place name. Typing a name lists matching
 * places (GET /api/places, nearest to `near` first); picking one stores a Google Maps link to it.
 * A name left unpicked becomes a Google Maps search link for that text.
 */
export function MapPlaceField({
  id,
  value,
  onChange,
  onPick,
  near,
  label = "สถานที่บน Google Maps",
}: {
  id: string;
  value: string;
  onChange: (mapUrl: string) => void;
  /** Called with the picked place, e.g. to fill an empty title. */
  onPick?: (place: PlaceSuggestion) => void;
  near?: LatLng | null;
  label?: string;
}) {
  const [query, setQuery] = useState(() => (looksLikeUrl(value) ? placeTextFromMapUrl(value) || value : value));
  const [typing, setTyping] = useState(false);
  const [results, setResults] = useState<{ q: string; places: PlaceSuggestion[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const text = query.trim();
  const searchable = typing && text.length >= 2 && !looksLikeUrl(text);
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : "";

  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: text });
      if (nearKey) {
        const [lat, lng] = nearKey.split(",");
        params.set("lat", lat);
        params.set("lng", lng);
      }
      fetch(`/api/places?${params}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((body: { places?: PlaceSuggestion[] }) => {
          setResults({ q: text, places: body.places ?? [] });
          setFailed(false);
          setActive(0);
        })
        .catch((e: Error) => e.name !== "AbortError" && setFailed(true));
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [searchable, text, nearKey]);

  const places = searchable && results ? results.places : [];
  const open = searchable && (places.length > 0 || (results?.q === text && !failed));
  const loading = searchable && results?.q !== text && !failed;

  const type = (next: string) => {
    setQuery(next);
    setTyping(true);
    const t = next.trim();
    onChange(!t ? "" : looksLikeUrl(t) ? t : mapsSearchUrl(t));
  };

  const pick = (p: PlaceSuggestion) => {
    setQuery(p.name);
    setTyping(false);
    onChange(placeMapUrl(p));
    onPick?.(p);
  };

  return (
    <div className="relative">
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && places[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={inputClass}
        value={query}
        onChange={(e) => type(e.target.value)}
        onBlur={() => setTyping(false)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = places.length;
            if (n) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
          } else if (e.key === "Enter" && places[active]) {
            e.preventDefault(); // pick instead of submitting the form
            pick(places[active]);
          } else if (e.key === "Escape") {
            e.stopPropagation(); // close the list, not the modal
            setTyping(false);
          }
        }}
        placeholder="พิมพ์ชื่อสถานที่ หรือวางลิงก์ Google Maps"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {places.map((p, i) => (
            <li
              key={`${p.name}-${p.lat}-${p.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close the list first
              onClick={() => pick(p)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-baby" : ""}`}
            >
              <p className="font-medium leading-snug">📍 {p.name}</p>
              {p.address && <p className="truncate text-xs text-ink-soft">{p.address}</p>}
            </li>
          ))}
          {places.length === 0 && <li className="px-3 py-2 text-xs text-ink-soft">ไม่พบสถานที่ — บันทึกเป็นคำค้นใน Google Maps ได้</li>}
        </ul>
      )}

      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-soft">
        {loading ? (
          <span>กำลังค้นหา…</span>
        ) : failed && searchable ? (
          <span>ค้นหาสถานที่ไม่ได้ตอนนี้ — บันทึกเป็นคำค้นใน Google Maps แทน</span>
        ) : (
          <span>เลือกจากรายการ, วางลิงก์ หรือเว้นว่างได้</span>
        )}
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="font-medium text-baby-ink hover:underline">
            เปิดดูใน Google Maps ↗
          </a>
        )}
      </p>
    </div>
  );
}
