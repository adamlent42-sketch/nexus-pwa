"use client";

import { NotebookPen, Plus } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTodaysInstructionNotes } from "@/lib/queries";
import { useForms } from "@/components/forms/FormsProvider";
import { useViewDate } from "@/components/ViewDateContext";
import { formatDate } from "@/lib/utils";

const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun"
};

export function TodaysInstructionNotes() {
  const { viewDate, isToday } = useViewDate();
  const q = useTodaysInstructionNotes(isToday ? undefined : viewDate);
  const forms = useForms();

  return (
    <PanelCard
      tint="notes"
      title={isToday ? "Today's instruction notes" : "Instruction notes"}
      icon={<NotebookPen className="w-4 h-4" />}
      rightSlot={q.data ? `${q.data.length} showing` : undefined}
      headerAction={
        <button
          onClick={() => forms.openInstructionNote()}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded border border-current opacity-80 hover:opacity-100"
          title="Add a new instruction note"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      }
    >
      {q.isPending && <Skeleton rows={3} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState icon={<NotebookPen className="w-4 h-4" />} message="No instruction notes for the selected day's students." />
      )}
      {q.data && q.data.length > 0 && (
        <div>
          {q.data.map((n) => {
            const schedule = n.studentSchedule.map((d) => DAY_ABBR[d] ?? d).join("/");
            return (
              <div key={n.id} className="row">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium leading-snug">
                    {n.studentName ?? "(student)"}
                    {n.studentGrade && (
                      <span className="ml-1.5 text-[12px] font-normal text-ink-secondary">Gr. {n.studentGrade}</span>
                    )}
                    {n.category && (
                      <span className="ml-2 badge bg-tint-notes-bg text-tint-notes-fg font-normal">
                        {n.category}
                      </span>
                    )}
                  </p>
                  <p className="meta-sm mt-0.5">
                    {schedule && <span>{schedule}</span>}
                    {n.dateNoted && <span>{schedule ? " · " : ""}since {formatDate(n.dateNoted, "short")}</span>}
                    {n.createdBy && <span> · {n.createdBy}</span>}
                  </p>
                  <button
                    onClick={() => forms.openNoteEdit(n)}
                    className="text-[14px] leading-snug mt-1.5 text-left w-full hover:bg-surface-muted -mx-1 px-1 py-0.5 rounded"
                    title="Click to edit the note text"
                  >
                    {n.note}
                  </button>
                </div>
                <div className="shrink-0 flex gap-1.5">
                  <button onClick={() => forms.openNoteSnooze(n)} className="btn">Snooze</button>
                  <button onClick={() => forms.openNoteUpdate(n)} className="btn btn-primary" title="Close out the note with a closing note">Close</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
