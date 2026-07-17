"use client";

import { useState } from "react";
import { CalendarClock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTodaysPOs } from "@/lib/queries";
import { useForms } from "@/components/forms/FormsProvider";
import { todayInET } from "@/lib/time";
import { formatDate } from "@/lib/utils";

export function TodaysPOs() {
  const q = useTodaysPOs();
  const forms = useForms();
  const today = todayInET();
  const [showFuture, setShowFuture] = useState(false);

  // Cutoff: show backlog + today + next 2 calendar days expanded
  const cutoff = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  })();

  const backlogCount = q.data?.filter((p) => (p.date ?? today) < today).length ?? 0;
  const todayCount = q.data?.filter((p) => (p.date ?? today) === today).length ?? 0;
  const upcomingCount = q.data?.filter((p) => (p.date ?? today) > today).length ?? 0;

  const rightSlot = q.data
    ? [backlogCount > 0 && `${backlogCount} to recap`, `${todayCount} today`, upcomingCount > 0 && `${upcomingCount} upcoming`]
        .filter(Boolean).join(" · ")
    : undefined;

  return (
    <PanelCard
      tint="pos"
      title="POs · backlog, today + upcoming"
      icon={<CalendarClock className="w-4 h-4" />}
      rightSlot={rightSlot}
      headerAction={
        <button
          onClick={forms.openCreatePO}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded border border-current opacity-80 hover:opacity-100"
          title="Book a new PO (creates family + student + PO)"
        >
          <Plus className="w-3 h-3" /> Book PO
        </button>
      }
    >
      {q.isPending && <Skeleton rows={3} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState message="Nothing on deck and nothing to recap." />
      )}
      {q.data && q.data.length > 0 && (
        <div>
          {(() => {
            const visible = q.data.filter((p) => (p.date ?? today) <= cutoff);
            const hidden = q.data.filter((p) => (p.date ?? today) > cutoff);
            const toRender = showFuture ? q.data : visible;

            return (
              <>
                {toRender.map((po) => {
                  const pdate = po.date ?? today;
                  const isToday = pdate === today;
                  const isPast = pdate < today;
                  const isFuture = pdate > today;
                  const dateLabel = isToday ? po.time || "—" : `${po.date ? formatDate(po.date, "short") : "—"} · ${po.time || ""}`;
                  const badge = isPast ? { className: "bg-status-warn-bg text-status-warn-fg", text: "Needs recap" }
                             : isFuture ? { className: "bg-status-info-bg text-status-info-fg", text: "Upcoming" }
                             : null;
                  return (
                    <div key={po.id} className="row">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium leading-snug">
                          {badge && (
                            <span className={`badge mr-2 font-normal ${badge.className}`}>
                              {badge.text}
                            </span>
                          )}
                          <span className="mr-2">{dateLabel}</span>·{" "}
                          <span>{po.student}</span>
                          {po.grade && (
                            <span className="ml-2 inline-block px-2 py-0.5 rounded text-[12px] bg-surface-subtle text-ink-secondary font-normal">
                              Grade: {po.grade}
                            </span>
                          )}
                        </p>
                        <p className="meta mt-1">
                          {po.subjects.length > 0 && `${po.subjects.join(" + ")} · `}
                          {po.phone && `${po.phone} · `}
                          {po.source && po.source}
                          {po.status && ` · ${po.status}`}
                        </p>
                        {po.parentNotes && (
                          <p className="text-[13px] leading-snug mt-1.5 rounded bg-tint-pos-bg text-tint-pos-fg px-2 py-1">
                            <span className="font-semibold">Parent note: </span>
                            {po.parentNotes}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => forms.openPONote(po)}
                          className="btn"
                          title={po.parentNotes ? "Edit parent note" : "Add parent note"}
                        >
                          {po.parentNotes ? "Edit note" : "Add note"}
                        </button>
                        <button
                          onClick={() => forms.openReschedule(po)}
                          className="btn"
                          title="Reschedule this PO to a new date/time"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => forms.openPORecap(po)}
                          className={po.isOverdueRecap ? "btn btn-primary" : "btn"}
                          title={po.recapStatus ? "Edit submitted recap" : po.isOverdueRecap ? "Needs recap" : "Open PO recap"}
                        >
                          {po.recapStatus ? "Edit recap" : po.isOverdueRecap ? "Submit recap" : "PO recap"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {hidden.length > 0 && (
                  <button
                    onClick={() => setShowFuture((v) => !v)}
                    className="w-full mt-1 py-2 flex items-center justify-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors"
                  >
                    {showFuture ? (
                      <><ChevronUp className="w-3.5 h-3.5" /> Hide {hidden.length} later POs</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5" /> Show {hidden.length} more POs (beyond 2 days)</>
                    )}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </PanelCard>
  );
}
