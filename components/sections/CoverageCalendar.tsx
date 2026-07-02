"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCoverage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CoverageDayDialog } from "./CoverageDayDialog";
import type { CoverageDay } from "@/types/kumon";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function CoverageCalendar() {
  const q = useCoverage();
  const [selected, setSelected] = useState<CoverageDay | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium text-ink-secondary">4-week coverage <span className="font-normal text-[11px] text-ink-tertiary ml-1">click a day to see who's in and who's out</span></p>
        <div className="flex items-center gap-3 text-[11px] text-ink-secondary">
          <Legend swatch="bg-status-warn-bg" label="2+ out" />
          <Legend swatch="bg-status-danger-bg" label="3+ out" />
          <Legend swatch="bg-[#7A1414]" label="Lead out" />
          <Legend swatch="bg-surface-subtle" label="Closed" />
        </div>
      </div>

      {q.isPending && <Skeleton rows={2} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      {q.data && (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW.map((d, i) => (
              <div key={`h-${i}`} className="text-[11px] text-center text-ink-tertiary">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {q.data.map((day) => {
              const dayNum = parseInt(day.date.slice(-2), 10);
              const tone = computeTone(day);
              return (
                <button
                  key={day.date}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "text-[12px] text-center py-1.5 rounded border hover:opacity-90 transition-opacity",
                    tone
                  )}
                  title={`${day.date} — ${day.outCount} out / ${day.scheduledCount} scheduled${day.highTierOutNames.length ? ` · LEAD OUT: ${day.highTierOutNames.join(", ")}` : ""}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </>
      )}

      <CoverageDayDialog open={!!selected} onClose={() => setSelected(null)} day={selected} />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block w-2 h-2 rounded-[2px]", swatch)} />
      {label}
    </span>
  );
}

function computeTone(d: CoverageDay): string {
  if (d.isToday) return "border-brand border-2 bg-surface text-brand font-medium";
  if (d.isClosed) return "border-transparent bg-surface-subtle text-ink-tertiary";
  if (d.isPast) return "border-transparent bg-surface-muted text-ink-tertiary";
  if (d.highTierOutNames.length > 0) return "border-transparent bg-[#7A1414] text-white font-medium";
  if (d.outCount >= 3) return "border-transparent bg-status-danger-bg text-status-danger-fg";
  if (d.outCount >= 2) return "border-transparent bg-status-warn-bg text-status-warn-fg";
  return "border-line bg-surface";
}
