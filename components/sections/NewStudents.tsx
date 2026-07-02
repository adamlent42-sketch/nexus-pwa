"use client";

import { useState } from "react";
import { UserPlus, X, MapPin } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useNewStudents } from "@/lib/queries";
import { useForms } from "@/components/forms/FormsProvider";
import { formatDate } from "@/lib/utils";
import type { NewStudentRow } from "@/types/kumon";

export function NewStudents() {
  const q = useNewStudents();
  const forms = useForms();
  const [gpsStudent, setGpsStudent] = useState<NewStudentRow | null>(null);

  const total = q.data
    ? q.data.startingToday.length + q.data.plannedThisWeek.length + q.data.firstMonthWatch.length
    : undefined;

  const startedCount = q.data ? q.data.startingToday.length + q.data.firstMonthWatch.length : 0;
  const plannedCount = q.data ? q.data.plannedThisWeek.length : 0;

  const onClick = (s: NewStudentRow) => {
    forms.openStudentTiming({ id: s.id, name: s.name });
  };

  return (
    <PanelCard
      tint="purple"
      title="New students"
      icon={<UserPlus className="w-4 h-4" />}
      rightSlot={
        total != null && total > 0
          ? `${startedCount} started · ${plannedCount} planned`
          : total === 0
            ? "0 total"
            : undefined
      }
    >
      {q.isPending && <Skeleton rows={4} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && total === 0 && (
        <EmptyState icon={<UserPlus className="w-4 h-4" />} message="No new students this month." />
      )}
      {q.data && total !== undefined && total > 0 && (
        <div className="py-1">
          {(q.data.startingToday.length > 0 || q.data.firstMonthWatch.length > 0) && (
            <SectionHeader label="Already started" tone="bg-status-success-bg text-status-success-fg" />
          )}
          <Group
            label="Starting today"
            rows={q.data.startingToday}
            renderRight={(s) => formatDate(s.plannedStartDate ?? s.enrollDate ?? "", "short") || "today"}
            onClick={onClick}
            onGpsClick={setGpsStudent}
          />
          <Group
            label="First-month watch"
            rows={q.data.firstMonthWatch}
            renderRight={(s) => {
              const start = s.plannedStartDate ?? s.enrollDate;
              return start ? `started ${formatDate(start, "short")}` : `wk ${s.weekOfWatch ?? "?"}`;
            }}
            onClick={onClick}
            onGpsClick={setGpsStudent}
          />

          {q.data.plannedThisWeek.length > 0 && (
            <div className="border-t border-line mt-3 pt-3">
              <SectionHeader label="Not yet started" tone="bg-status-info-bg text-status-info-fg" />
              <Group
                label="Planned to start"
                rows={q.data.plannedThisWeek}
                renderRight={(s) => s.plannedStartDate ? formatDate(s.plannedStartDate, "short") : "—"}
                onClick={onClick}
                onGpsClick={setGpsStudent}
              />
            </div>
          )}

          <p className="text-[11px] text-ink-tertiary mt-3">
            Click any student to update their planned start date or class schedule.
          </p>
        </div>
      )}
      {/* GPS plan modal */}
      {gpsStudent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setGpsStudent(null)}>
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-tint-purple-sub" />
                <p className="text-[14px] font-semibold">{gpsStudent.name} — 30-Day Plan</p>
              </div>
              <button onClick={() => setGpsStudent(null)} className="text-ink-tertiary hover:text-ink p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            {gpsStudent.thirtyDayVision && (
              <div className="mb-3">
                <p className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider mb-1">Vision</p>
                <p className="text-[13px] leading-snug">{gpsStudent.thirtyDayVision}</p>
              </div>
            )}
            {gpsStudent.gpsPriorities.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider mb-1.5">Priorities</p>
                <div className="flex flex-wrap gap-1.5">
                  {gpsStudent.gpsPriorities.map((p) => (
                    <span key={p} className="badge bg-tint-purple-bg text-tint-purple-fg">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {!gpsStudent.thirtyDayVision && gpsStudent.gpsPriorities.length === 0 && (
              <p className="text-[13px] text-ink-tertiary">No 30-day plan set yet.</p>
            )}
          </div>
        </div>
      )}
    </PanelCard>
  );
}

function SectionHeader({ label, tone }: { label: string; tone: string }) {
  return (
    <p className="mb-2 inline-block">
      <span className={`badge ${tone}`}>{label}</span>
    </p>
  );
}

function renderMeta(s: NewStudentRow): string {
  const parts: string[] = [];
  if (s.grade) parts.push(`Gr ${s.grade}`);
  if (s.subjects.length) parts.push(s.subjects.join(" + "));
  return parts.join(" · ");
}

function Group({
  label,
  rows,
  renderRight,
  onClick,
  onGpsClick
}: {
  label: string;
  rows: NewStudentRow[];
  renderRight: (s: NewStudentRow) => string;
  onClick: (s: NewStudentRow) => void;
  onGpsClick: (s: NewStudentRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[11px] text-tint-purple-sub font-medium uppercase tracking-wider mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {rows.map((s) => {
          const meta = renderMeta(s);
          const hasGps = !!(s.thirtyDayVision || s.gpsPriorities.length > 0);
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 py-1 border-b border-line last:border-b-0"
            >
              <button
                onClick={() => onClick(s)}
                className="flex-1 text-left flex items-baseline justify-between gap-3 hover:bg-surface-muted -mx-1 px-1 rounded transition-colors min-w-0"
                title="Click to update start date / schedule"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-medium">{s.name}</span>
                  {meta && <span className="text-[12px] text-ink-secondary ml-2">· {meta}</span>}
                </div>
                <span className="text-[12px] text-tint-purple-sub font-medium shrink-0">
                  {renderRight(s)}
                </span>
              </button>
              {hasGps && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGpsClick(s); }}
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-tint-purple-bg text-tint-purple-fg text-[10px] font-medium hover:opacity-80 transition-opacity"
                  title="View 30-day plan"
                >
                  <MapPin className="w-2.5 h-2.5" />
                  GPS
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
