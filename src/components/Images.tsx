"use client";

import { useEffect, useState } from "react";
import { MAX_IMAGES, isSafeUrl } from "@/lib/trip";
import { Modal, inputClass, labelClass } from "./Modal";
import { IconButton, PlusIcon, TrashIcon } from "./Icons";

/** Full-size image viewer with previous/next (buttons and ←/→ keys). */
export function ImageViewer({
  title,
  images,
  index,
  onIndex,
  onClose,
}: {
  title: string;
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const n = images.length;
  const go = (d: number) => onIndex((index + d + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, onIndex]);

  return (
    <Modal title={title} onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt={`${title} รูปที่ ${index + 1}`} className="max-h-[60dvh] w-full rounded-2xl bg-surface object-contain" />
      {n > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button onClick={() => go(-1)} className="rounded-full bg-surface px-3 py-1.5 hover:bg-baby">
            ← ก่อนหน้า
          </button>
          <span className="text-ink-soft">
            {index + 1} / {n}
          </span>
          <button onClick={() => go(1)} className="rounded-full bg-surface px-3 py-1.5 hover:bg-baby">
            ถัดไป →
          </button>
        </div>
      )}
    </Modal>
  );
}

/** Downscale an uploaded photo to a small JPEG data URL so it fits in localStorage. */
async function downscaleImage(file: File, maxSide = 800, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function ImagePicker({
  idPrefix,
  images,
  onUpdate,
  label = "📷 รูปสถานที่",
}: {
  idPrefix: string;
  images: string[];
  label?: string;
  onUpdate: (update: (images: string[]) => string[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const room = MAX_IMAGES - images.length;
  const add = (srcs: string[]) => onUpdate((prev) => [...prev, ...srcs].slice(0, MAX_IMAGES));

  const upload = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith("image/"));
    input.value = ""; // allow picking the same file again
    if (files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      add(await Promise.all(files.slice(0, room).map((f) => downscaleImage(f))));
      if (files.length > room) setError(`ใส่รูปได้สูงสุด ${MAX_IMAGES} รูป`);
    } catch {
      setError("อ่านไฟล์รูปบางไฟล์ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG");
    } finally {
      setBusy(false);
    }
  };

  const addUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!isSafeUrl(u)) return setError("ลิงก์รูปต้องขึ้นต้นด้วย https://");
    setError("");
    add([u]);
    setUrl("");
  };

  return (
    <div>
      <span className={labelClass}>
        {label} ({images.length}/{MAX_IMAGES})
      </span>
      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {images.map((src, i) => (
            <div key={`${i}-${src.slice(-16)}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`รูปที่ ${i + 1}`} className="aspect-square w-full rounded-xl border border-line object-cover" />
              <button
                type="button"
                onClick={() => onUpdate((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`ลบรูปที่ ${i + 1}`}
                title="ลบรูป"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {room > 0 && (
        <div className="flex flex-wrap gap-2">
          <label
            title="อัปโหลดรูป"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line text-ink-soft transition hover:border-baby-ink hover:text-ink ${
              busy ? "pointer-events-none animate-pulse opacity-60" : ""
            }`}
          >
            <PlusIcon className="h-5 w-5" />
            <span className="sr-only">{busy ? "กำลังย่อรูป…" : "อัปโหลดรูป"}</span>
            <input
              id={`${idPrefix}-upload`}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => upload(e.currentTarget)}
            />
          </label>
          <input
            aria-label="ลิงก์รูปภาพ"
            type="url"
            inputMode="url"
            className={`${inputClass} min-w-0 flex-1`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the whole activity form
                addUrl();
              }
            }}
            placeholder="หรือวางลิงก์รูป https://…"
          />
          <IconButton icon="add" label="เพิ่มรูปจากลิงก์" onClick={addUrl} className="self-center" />
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-alert-ink">{error}</p>}
    </div>
  );
}
