"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, UserCheck } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

interface PendingStart {
  id: string;
  studentIds: string[];
  alreadyStarted: boolean;
  student: string;
  grade: string | null;
  subjects: string[];
  plannedStartDate: string | null;
  plannedClassTime: string | null;
  plannedSchedule: string[];
  eEnrollmentCompleted: boolean;
}

async function fetchPendingStarts(): Promise<PendingStart[]> {
  const res = await fetch("/api/students/pending-starts");
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "Failed to load");
  return body.data as PendingStart[];
}

export function StartingSoon() {
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["students", "pending-starts"],
    queryFn: fetchPendingStarts
  });

  const markActive = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const res = await fetch("/api/students/mark-first-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", "pending-starts"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    }
  });

  const markStarted = async (s: PendingStart) => {
    if (s.studentIds.length === 0) {
      toast.push("No linked student on this record to mark.", "error");
      return;
    }
    try {
      await markActive.mutateAsync(s.studentIds);
      toast.push(`${s.student} marked active — first class attended.`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to mark active", "error");
    }
  };

  return (
    <PanelCard
      tint="purple"
      title="Starting soon · mark first class"
      icon={<GraduationCap className="w-4 h-4" />}
      rightSlot={q.data ? `${q.data.length} to start` : undefined}
    >
      {q.isPending && <Skeleton rows={2} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState icon={<GraduationCap className="w-4 h-4" />} message="No students waiting to start." />
      )}
      {q.data && q.data.length > 0 && (
        <div>
          {q.data.map((s) => (
            <div key={s.id} className="row">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium leading-snug">
                  <span>{s.student}</span>
                  {s.grade && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded text-[12px] bg-surface-subtle text-ink-secondary font-normal">
                      Gr {s.grade}
                    </span>
                  )}
                  {s.eEnrollmentCompleted ? (
                    <span className="ml-2 badge bg-status-success-bg text-status-success-fg">eEnrolled</span>
                  ) : (
                    <span className="ml-2 badge bg-status-warn-bg text-status-warn-fg">No eEnroll</span>
                  )}
                </p>
                <p className="meta mt-1">
                  {s.plannedStartDate ? `Starts ${formatDate(s.plannedStartDate, "short")}` : "No start date"}
                  {s.plannedClassTime && ` · ${s.plannedClassTime}`}
                  {s.subjects.length > 0 && ` · ${s.subjects.join(" + ")}`}
                </p>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => markStarted(s)}
                  disabled={markActive.isPending}
                  className="btn btn-primary"
                  title="Mark first class attended — flips the student to Active"
                >
                  <UserCheck className="w-3.5 h-3.5" /> First class done
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
