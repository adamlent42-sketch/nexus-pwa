"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTodaysPOs, useNewStudents } from "@/lib/queries";
import { useViewDate } from "@/components/ViewDateContext";
import { addDays, todayInET, dayNameET } from "@/lib/time";
import { formatDate } from "@/lib/utils";
import type { StaffRow, ApiResponse } from "@/types/kumon";

// A compact "Tomorrow at a glance" card. Always anchored to actual tomorrow
// (today + 1 in ET), not the dashboard's selected view date — the point is
// to peek ahead at what's coming.
export function TomorrowPreview() {
  const today = todayInET();
  const tomorrow = addDays(today, 1);
  const dayName = dayNameET(tomorrow);
  const { setViewDate } = useViewDate();

  // Staff for tomorrow — call the date-aware endpoint directly.
  const staffQ = useQuery({
    queryKey: ["staff", "preview", tomorrow],
    queryFn: async () => {
      const r = await fetch(`/api/staff/today?date=${tomorrow}`);
      const body = (await r.json()) as ApiResponse<StaffRow[]>;
      if (!body.ok) throw new Error(body.error);
      return body.data;
    }
  });

  const posQ = useTodaysPOs();
  const studentsQ = useNewStudents();

  // POs on tomorrow's date.
  const posTomorrow = (posQ.data ?? []).filter((p) => (p.date ?? today) === tomorrow);
  // New students starting tomorrow.
  const startsTomorrow = (studentsQ.data?.plannedThisWeek ?? []).filter((s) => s.plannedStartDate === tomorrow);

  const staffCount = staffQ.data?.length ?? null;
  const isPending = staffQ.isPending || posQ.isPending || studentsQ.isPending;

  return (
    <div className="card card-body mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[14px] font-medium inline-flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-tint-purple-sub" />
          Tomorrow — {dayName}, {formatDate(tomorrow, "short")}
        </p>
        <button
          onClick={() => setViewDate(tomorrow)}
          className="text-[12px] text-brand hover:underline"
          title="Switch the dashboard to tomorrow's view"
        >
          View →
        </button>
      </div>
      {isPending ? (
        <Skeleton rows={1} />
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <Item label="Staff scheduled" value={staffCount === null ? "—" : `${staffCount}`} />
          <Item label="POs" value={`${posTomorrow.length}`} highlight={posTomorrow.length > 0} />
          <Item label="New starts" value={`${startsTomorrow.length}`} highlight={startsTomorrow.length > 0} />
        </div>
      )}
      {posTomorrow.length > 0 && (
        <p className="text-[12px] text-ink-tertiary mt-1.5">
          POs: {posTomorrow.map((p) => `${p.time || ""} ${p.student}`.trim()).join(" · ")}
        </p>
      )}
      {startsTomorrow.length > 0 && (
        <p className="text-[12px] text-ink-tertiary mt-0.5">
          Starts: {startsTomorrow.map((s) => s.name).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Item({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-secondary">{label}:</span>
      <span className={`font-medium ${highlight ? "text-brand" : "text-ink"}`}>{value}</span>
    </div>
  );
}
