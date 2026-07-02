"use client";

import { useState } from "react";
import { Users, X, UserPlus } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTodaysStaff } from "@/lib/queries";
import { CoverageCalendar } from "./CoverageCalendar";
import { MarkOutDialog } from "@/components/forms/MarkOutDialog";
import { AddStaffTodayForm } from "@/components/forms/AddStaffTodayForm";
import { useViewDate } from "@/components/ViewDateContext";

interface MarkOutTarget { id: string; name: string }

export function TodaysStaff() {
  const { viewDate, isToday } = useViewDate();
  const q = useTodaysStaff(isToday ? undefined : viewDate);
  const ins = q.data?.filter((s) => !s.isOut) ?? [];
  const outs = q.data?.filter((s) => s.isOut) ?? [];
  const [markOut, setMarkOut] = useState<MarkOutTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <PanelCard
      tint="staff"
      title={isToday ? "Today's staff & coverage" : "Staff & coverage"}
      icon={<Users className="w-4 h-4" />}
      rightSlot={q.data ? `${ins.length} in · ${outs.length} out` : undefined}
      headerAction={
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded border border-current opacity-80 hover:opacity-100"
          title="Add a staff member to this day's class (one day only, not recurring)"
        >
          <UserPlus className="w-3 h-3" /> Add staff
        </button>
      }
    >
      {q.isPending && <Skeleton rows={2} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState icon={<Users className="w-4 h-4" />} message="No staff scheduled for the selected day." />
      )}
      {q.data && q.data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {q.data.map((s) => (
            <div
              key={s.id}
              className={`bg-surface-subtle rounded p-2.5 flex items-center justify-between gap-2 ${s.isOut ? "opacity-55" : ""}`}
            >
              <div className="min-w-0">
                <p className={`text-[14px] font-medium leading-tight ${s.isOut ? "line-through" : ""}`}>
                  {s.name}
                </p>
                {s.isOut ? (
                  <p className="text-[12px] mt-0.5">
                    <span className="badge bg-status-danger-bg text-status-danger-fg">Out</span>
                  </p>
                ) : (
                  <p className="meta-sm mt-0.5">
                    {[s.role, formatRange(s.startTime, s.endTime)].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {!s.isOut && s.staffId && isToday && (
                <button
                  className="text-ink-tertiary hover:text-status-danger-fg"
                  aria-label={`Mark ${s.name} out`}
                  onClick={() => setMarkOut({ id: s.staffId, name: s.name })}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <CoverageCalendar />

      <MarkOutDialog open={!!markOut} onClose={() => setMarkOut(null)} staff={markOut} />
      <AddStaffTodayForm open={addOpen} onClose={() => setAddOpen(false)} date={isToday ? undefined : viewDate} />
    </PanelCard>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && end) return `${start}-${end}`;
  return start ?? end ?? "";
}
