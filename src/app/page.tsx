import { Suspense } from "react";
import { TripPlanner } from "@/components/TripPlanner";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-col items-center justify-center gap-2 text-ink-soft">
          <span className="animate-pulse text-4xl">🗼</span>
          <p className="text-sm">กำลังโหลดแพลนทริปโตเกียว… ❄️</p>
        </div>
      }
    >
      <TripPlanner />
    </Suspense>
  );
}
