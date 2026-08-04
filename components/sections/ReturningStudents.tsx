"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, RotateCcw } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

interface OnBreakStudent {
  id: string;
  name: string;
  subjects: string[];
  schedule: string[];
  plannedReturn: string | null;
  holdStart: string | null;
  notes: string | null;
}

async function fetchOnBreak(): Promise<OnBreakStudent[]> {
  const res = await fetch("/api/students/on-break");
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "Failed to load");
  return body.data as OnBreakStudent[];
}

export function ReturningStudents() {
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["students", "on-break"],
    queryFn: fetchOnBreak,
  });

  const markReturned = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch("/api/students/mark-returned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["students", "on-break"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.push(`${data.name} marked returned — Adam notified about Invoice Ninja.`, "success");
    },
  });

  const handleReturned = async (s: OnBreakStudent) => {
    try {
      await markReturned.mutateAsync(s.id);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to mark returned", "error");
    }
  };

  // Don't render the tile at all when no one is on break
  if (q.data && q.data.length === 0) return null;

  return (
    <PanelCard
      tint="blue"
      title="On break · mark return"
      icon={<PauseCircle className="w-4 h-4" />}
      rightSlot={q.data ? `${q.data.length} on break` : undefined}
    >
      {q.isPending && <Skeleton rows={2} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState icon={<PauseCircle className="w-4 h-4" />} message="No students currently on break." />
      )}
      {q.data && q.data.length > 0 && (
        <div>
          {q.data.map((s) => (
            <div key={s.id} className="row">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium leading-snug">
                  {s.name}
                  {s.subjects.length > 0 && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded text-[12px] bg-surface-subtle text-ink-secondary font-normal">
                      {s.subjects.join(" + ")}
                    </span>
                  )}
                </p>
                <p className="meta mt-1">
                  {s.holdStart ? `Out since ${formatDate(s.holdStart, "short")}` : "On break"}
                  {s.plannedReturn ? ` · returns ${formatDate(s.plannedReturn, "short")}` : " · no return date set"}
                  {s.notes ? ` · ${s.notes}` : ""}
                </p>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => handleReturned(s)}
                  disabled={markReturned.isPending}
                  className="btn btn-primary"
                  title="Mark student as returned — flips back to Active-Engaged and prompts Adam to reactivate invoice"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Returned
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
