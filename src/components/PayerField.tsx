"use client";

import type { Member } from "@/lib/trip";
import { inputClass, labelClass } from "./Modal";

/**
 * Who pays: everyone pays their own share ("จ่ายกันเอง", no debts), or one person pays
 * first and the others pay them back ("มีคนจ่ายแทนก่อน").
 */
export function PayerField({
  id,
  selfPaid,
  paidBy,
  members,
  onSelfPaid,
  onPaidBy,
  hidePayer = false,
}: {
  id: string;
  selfPaid: boolean;
  paidBy: string;
  members: Member[];
  onSelfPaid: (selfPaid: boolean) => void;
  onPaidBy: (id: string) => void;
  /** Hide the payer select (e.g. when payers are chosen per person elsewhere). */
  hidePayer?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <span className={labelClass}>การจ่าย</span>
        <div role="radiogroup" aria-label="การจ่าย" className="flex overflow-hidden rounded-xl border border-line text-sm">
          {(
            [
              [true, "จ่ายกันเอง"],
              [false, "มีคนจ่ายแทนก่อน"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={String(value)}
              role="radio"
              aria-checked={selfPaid === value}
              onClick={() => onSelfPaid(value)}
              className={`flex-1 px-2 py-2 font-medium transition ${selfPaid === value ? "bg-ink text-white" : "bg-white text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">
          {selfPaid ? "แต่ละคนจ่ายส่วนของตัวเอง — ไม่มีใครติดเงินใคร" : "คนนี้จ่ายไปก่อน คนอื่นโอนคืนตามส่วน (ขึ้นใน “ใครต้องโอนให้ใคร”)"}
        </p>
      </div>
      {!selfPaid && !hidePayer && (
        <div>
          <label className={labelClass} htmlFor={id}>
            ใครจ่ายแทนก่อน
          </label>
          <select id={id} className={inputClass} value={paidBy} onChange={(e) => onPaidBy(e.target.value)}>
            <option value="" disabled>
              เลือกคนจ่าย
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
