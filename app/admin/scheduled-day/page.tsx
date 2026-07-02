"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";

interface ScheduledStudent {
  id: string;
  student: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  lifecycle: string | null;
  mathLevel: string | null;
  readingLevel: string | null;
}

// Days the Center holds class. Schedule is stored as weekday, so we map the
// chosen calendar date to its weekday and look up who is scheduled that day.
const CLASS_DAYS = ["Monday", "Tuesday", "Thursday", "Saturday"];

// Today's date as YYYY-MM-DD (local), used as the default selection.
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Weekday name for a YYYY-MM-DD string, parsed in local time to avoid the
// UTC off-by-one that `new Date("2026-06-25")` would introduce.
function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}

export default function ScheduledDayPage() {
  const [date, setDate] = useState<string>(todayISO());
  const weekday = useMemo(() => weekdayOf(date), [date]);
  const isClassDay = CLASS_DAYS.includes(weekday);

  const q = useQuery({
    queryKey: ["admin", "scheduled-day", weekday],
    queryFn: () =>
      adminFetch<ScheduledStudent[]>(`/api/admin/scheduled-day?day=${encodeURIComponent(weekday)}`),
    enabled: isClassDay
  });

  const counts = useMemo(() => {
    const rows = q.data ?? [];
    const math = rows.filter((r) => r.subjects.includes("Math")).length;
    const reading = rows.filter((r) => r.subjects.includes("Reading")).length;
    return { total: rows.length, math, reading };
  }, [q.data]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-ink-secondary mb-3">
          Pick a date to see which active students are scheduled to come in that day.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[180px]"
          />
          <div className="flex gap-1">
            {CLASS_DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setDate(nextDateForWeekday(d))}
                className={`btn ${weekday === d ? "btn-primary" : ""}`}
                title={`Jump to the next ${d}`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        {date && (
          <p className="meta mt-2">
            {formatDate(date, "long")}
          </p>
        )}
      </div>

      {!isClassDay ? (
        <EmptyState
          icon={<CalendarDays className="w-5 h-5" />}
          message={`${weekday || "That day"} isn't a Center class day. Class days are Monday, Tuesday, Thursday, and Saturday.`}
        />
      ) : q.isPending ? (
        <Skeleton rows={5} />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-5 h-5" />}
          message={`No active students scheduled for ${weekday}.`}
        />
      ) : (
        <>
          <div className="flex gap-2 flex-wrap text-[13px]">
            <span className="badge bg-status-success-bg text-status-success-fg">{counts.total} scheduled</span>
            <span className="badge">{counts.math} Math</span>
            <span className="badge">{counts.reading} Reading</span>
          </div>
          <div className="space-y-2">
            {q.data.map((s) => (
              <div key={s.id} className="card card-body flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium leading-tight">
                    {s.student}
                    {s.grade && (
                      <span className="ml-2 text-[12px] text-ink-secondary font-normal">Gr {s.grade}</span>
                    )}
                  </p>
                  <p className="meta mt-1">
                    {s.subjects.join(" + ")}
                    {s.mathLevel && ` · Math ${s.mathLevel}`}
                    {s.readingLevel && ` · Reading ${s.readingLevel}`}
                    {s.schedule.length > 0 && ` · ${s.schedule.map((d) => d.slice(0, 3)).join("/")}`}
                  </p>
                </div>
                {s.lifecycle === "Active-At-Risk" && (
                  <span className="shrink-0 badge bg-status-warning-bg text-status-warning-fg">At risk</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Given a weekday name, return the YYYY-MM-DD of the next occurrence (today if it matches).
function nextDateForWeekday(weekday: string): string {
  const target = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weekday);
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
