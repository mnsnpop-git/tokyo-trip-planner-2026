"use client";

import { useEffect, useState } from "react";
import { renderDayImage, type DayImageInput } from "@/lib/dayImage";
import { Modal } from "./Modal";

/**
 * Preview of one day as a picture, with "แชร์" (the phone's share sheet, where LINE is listed)
 * and "บันทึกรูป". Sharing happens on its own tap: iPhone only opens the share sheet straight
 * from a tap, not after the picture has finished drawing.
 */
export function ShareDayImage({ input, onClose }: { input: DayImageInput; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileName = `day-${input.dayNumber}-${input.day.date}.png`;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    renderDayImage(input)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFile(new File([blob], fileName, { type: "image/png" }));
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError("สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง"));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Drawn once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `DAY ${input.dayNumber} · ${input.day.title}` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("แชร์ไม่สำเร็จ — กดบันทึกรูปแล้วส่งใน LINE แทนได้");
    }
  };

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  return (
    <Modal title={`แชร์รูป DAY ${input.dayNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="max-h-[55dvh] overflow-y-auto rounded-2xl border border-line bg-[#fff]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`สรุป DAY ${input.dayNumber}`} className="block w-full" />
          ) : (
            <p className="p-8 text-center text-sm text-ink-soft">{error || "กำลังสร้างรูป…"}</p>
          )}
        </div>
        {url && error && <p className="text-xs text-pending-ink">{error}</p>}

        <div className="flex gap-2">
          {canShare && (
            <button
              onClick={share}
              className="flex-1 rounded-xl bg-[#06c755] px-4 py-2.5 text-sm font-semibold text-[#fff] hover:opacity-90"
            >
              แชร์ไป LINE
            </button>
          )}
          <button
            onClick={save}
            disabled={!url}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-40 ${
              canShare ? "bg-surface text-ink hover:bg-line" : "flex-1 bg-ink text-white hover:opacity-90"
            }`}
          >
            บันทึกรูป
          </button>
        </div>
        <p className="text-[11px] text-ink-soft">
          {canShare
            ? "กดแชร์แล้วเลือก LINE ในเมนูของเครื่อง จากนั้นเลือกแชทหรือกลุ่มที่จะส่ง"
            : "เครื่องนี้แชร์รูปตรงไม่ได้ — บันทึกรูป แล้วส่งในแชท LINE"}
        </p>
      </div>
    </Modal>
  );
}
