"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useViewDate } from "./ViewDateContext";
import { addDays, todayInET, dayNameET } from "@/lib/time";
import { formatDate } from "@/lib/utils";

export function DateSelector() {
  const { viewDate, setViewDate, isToday } = useViewDate();
  const today = todayInET();
  const dayName = dayNameET(viewDate);

  return (
    <div className="flex items-center justify-between gap-2 mb-3 bg-tint-notes-bg text-tint-notes-fg rounded p-2 text-[13px]">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4" />
        <span className="font-medium">Viewing: {dayName}, {formatDate(viewDate, "short")}</span>
        {!isToday && (
          <span className="text-[11px] text-ink-tertiary">({viewDate === addDays(today, 1) ? "tomorrow" : viewDate === addDays(today, -1) ? "yesterday" : "preview"})</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setViewDate(addDays(viewDate, -1))}
          className="btn"
          title="Previous day"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {!isToday && (
          <button onClick={() => setViewDate(today)} className="btn">Today</button>
        )}
        <button
          onClick={() => setViewDate(addDays(viewDate, 1))}
          className="btn"
          title="Next day"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <input
          type="date"
          value={viewDate}
          onChange={(e) => e.target.value && setViewDate(e.target.value)}
          className="px-2 py-1 text-[12px] border border-line rounded bg-surface"
        />
      </div>
    </div>
  );
}
