"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Check, ChevronDown, ChevronUp } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

interface ChangeRequestRow {
  id: string;
  title: string;
  type: string | null;
  studentId: string | null;
  studentName: string | null;
  studentLifecycle: string | null;
  studentEndDate: string | null;
  effectiveDate: string | null;
  reason: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  status: string | null;
  completedBy: string | null;
  completedAt: string | null;
  externalSystems: string[];
  ksisCompletedByStaff: boolean;
}

const TYPE_TONES: Record<string, string> = {
  "Edit Details":       "bg-tint-notes-bg text-tint-notes-fg",
  "Schedule Change":    "bg-tint-notes-bg text-tint-notes-fg",
  "Pickup Day Change":  "bg-tint-pos-bg text-tint-pos-fg",
  "Pause / Break":      "bg-status-warn-bg text-status-warn-fg",
  "Stop Enrollment":    "bg-status-danger-bg text-status-danger-fg",
  "Restart Enrollment": "bg-status-success-bg text-status-success-fg",
  "Other":              "bg-surface-muted text-ink-secondary"
};

const SYSTEM_TONES: Record<string, string> = {
  "KSIS": "bg-status-warn-bg text-status-warn-fg",
  "Invoice Ninja": "bg-tint-purple-bg text-tint-purple-fg"
};

export default function ChangeRequestsPage() {
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["admin", "change-requests"],
    queryFn: () => adminFetch<ChangeRequestRow[]>("/api/admin/student-change-requests")
  });

  const reviewMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/api/admin/student-change-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completedBy: "Adam", completionNotes: "", completedSystems: [] })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "change-requests"] })
  });

  const handleReview = (id: string) => {
    setReviewedIds((prev) => new Set(prev).add(id));
    reviewMutation.mutate(id, {
      onError: () => {
        setReviewedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        toast.push("Failed to mark reviewed — try again", "error");
      }
    });
  };

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const all = q.data ?? [];
  const pending = all.filter((r) => r.status !== "Completed" && !reviewedIds.has(r.id));
  const reviewed = all.filter((r) => r.status === "Completed" || reviewedIds.has(r.id));

  if (all.length === 0) {
    return <EmptyState icon={<ListChecks className="w-5 h-5" />} message="No student change requests on file." />;
  }

  return (
    <div className="space-y-6">
      {/* Pending */}
      <section>
        <h3 className="text-[14px] font-medium mb-3">
          Needs review{" "}
          <span className="text-[12px] text-ink-tertiary font-normal">({pending.length})</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState icon={<ListChecks className="w-5 h-5" />} message="All caught up — nothing pending." />
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                onReview={() => handleReview(r.id)}
                reviewing={reviewedIds.has(r.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <section>
          <button
            onClick={() => setShowReviewed((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors mb-2"
          >
            {showReviewed
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
            Reviewed ({reviewed.length})
          </button>
          {showReviewed && (
            <div className="space-y-2">
              {reviewed.map((r) => (
                <RequestCard key={r.id} r={r} onReview={null} reviewing={false} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RequestCard({
  r,
  onReview,
  reviewing
}: {
  r: ChangeRequestRow;
  onReview: (() => void) | null;
  reviewing: boolean;
}) {
  const typeTone = TYPE_TONES[r.type ?? ""] ?? "bg-surface-muted text-ink-secondary";
  const isReviewed = !onReview;

  return (
    <div className={`card card-body flex items-start justify-between gap-3 ${isReviewed ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0">
        {/* Top line: type badge + student + external system badges */}
        <p className="text-[15px] font-medium leading-tight flex items-center gap-2 flex-wrap">
          <span className={`badge ${typeTone}`}>{r.type ?? "Unknown"}</span>
          {r.studentName ?? "(unknown student)"}
          {r.externalSystems.map((sys) => (
            <span key={sys} className={`badge font-normal ${SYSTEM_TONES[sys] ?? "bg-surface-muted text-ink-secondary"}`}>
              {sys}
            </span>
          ))}
          {r.ksisCompletedByStaff && (
            <span className="badge bg-status-success-bg text-status-success-fg font-normal">✓ KSIS by staff</span>
          )}
        </p>

        {/* Meta: effective date, who submitted, when */}
        <p className="meta mt-1">
          Effective {r.effectiveDate ? formatDate(r.effectiveDate, "short") : "—"}
          {" · "}submitted by {r.submittedBy ?? "—"}
          {r.submittedAt && ` on ${formatDate(r.submittedAt.slice(0, 10), "short")}`}
        </p>

        {/* Notes / reason */}
        {r.reason && (
          <p className="text-[12px] text-ink-secondary mt-1 italic">
            &ldquo;{r.reason}&rdquo;
          </p>
        )}

        {/* Reviewed-by line */}
        {isReviewed && r.completedBy && (
          <p className="text-[11px] text-ink-tertiary mt-1">
            Reviewed by {r.completedBy}
            {r.completedAt && ` on ${formatDate(r.completedAt, "short")}`}
          </p>
        )}
      </div>

      {onReview && (
        <div className="shrink-0 pt-0.5">
          <button
            onClick={onReview}
            disabled={reviewing}
            className="btn btn-primary"
          >
            <Check className="w-3.5 h-3.5" />
            {reviewing ? "Saving…" : "Reviewed"}
          </button>
        </div>
      )}
    </div>
  );
}
