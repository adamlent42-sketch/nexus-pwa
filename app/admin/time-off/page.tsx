"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoverage } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

interface TimeOffRequest {
  id: string;
  staffName: string;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  effectiveEnd: string | null;
  notes: string | null;
  urgent: boolean;
  status: string;
}

function dateRange(req: TimeOffRequest): string {
  if (!req.startDate) return "—";
  const start = formatDate(req.startDate, "short");
  if (!req.endDate || req.endDate === req.startDate) return start;
  return `${start} – ${formatDate(req.endDate, "short")}`;
}

export default function AdminTimeOffPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["admin", "time-off"],
    queryFn: () => adminFetch<TimeOffRequest[]>("/api/admin/time-off")
  });
  const coverage = useCoverage();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [showApproved, setShowApproved] = useState(true);

  const expanded = q.data?.find((t) => t.id === expandedId) ?? null;

  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "Approved" | "Denied" }) =>
      adminFetch<{ id: string }>(`/api/admin/time-off/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, sendEmail: decision === "Approved" ? sendEmail : false })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "time-off"] });
      qc.invalidateQueries({ queryKey: ["coverage"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    }
  });

  const decide = async (id: string, decision: "Approved" | "Denied") => {
    try {
      await mutation.mutateAsync({ id, decision });
      toast.push(
        decision === "Approved"
          ? `Approved.${sendEmail ? " Notification email queued." : ""}`
          : "Denied.",
        "success"
      );
      setExpandedId(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const pending = (q.data ?? []).filter((t) => t.status === "Pending");
  const approved = (q.data ?? []).filter((t) => t.status === "Approved");

  const coverageImpact = (req: TimeOffRequest) =>
    coverage.data?.filter((d) =>
      req.startDate && req.effectiveEnd &&
      d.date >= req.startDate && d.date <= req.effectiveEnd
    ) ?? [];

  return (
    <div className="space-y-6">

      {/* ── Pending Approval ── */}
      <section>
        <h3 className="text-[14px] font-medium mb-3">
          Pending approval{" "}
          <span className="text-[12px] text-ink-tertiary font-normal">({pending.length})</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState message="No pending time-off requests." />
        ) : (
          <div className="space-y-2">
            {pending.map((req) => {
              const isExpanded = expandedId === req.id;
              const impact = coverageImpact(req);
              return (
                <div key={req.id} className="border border-line rounded-lg overflow-hidden">
                  {/* Row */}
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-muted transition-colors ${isExpanded ? "bg-surface-muted" : "bg-surface"}`}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.urgent && <AlertCircle className="w-3.5 h-3.5 text-status-warn-fg shrink-0" />}
                        <span className="text-[14px] font-medium">{req.staffName}</span>
                        {req.type && <span className="badge bg-surface-muted text-ink-secondary">{req.type}</span>}
                        {req.urgent && <span className="badge bg-status-warn-bg text-status-warn-fg">Urgent</span>}
                      </div>
                      <p className="text-[12px] text-ink-tertiary mt-0.5">{dateRange(req)}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(req.id, "Denied"); }}
                        disabled={mutation.isPending}
                        className="btn"
                      >Deny</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(req.id, "Approved"); }}
                        disabled={mutation.isPending}
                        className="btn btn-primary"
                      >Approve</button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-line p-4 bg-surface space-y-3">
                      {req.notes && (
                        <div>
                          <p className="text-[11px] text-ink-tertiary uppercase tracking-wider mb-1">Notes from {req.staffName.split(" ")[0]}</p>
                          <div className="text-[14px] bg-surface-muted rounded p-2.5 italic leading-snug">{req.notes}</div>
                        </div>
                      )}
                      {impact.length > 0 && (
                        <div>
                          <p className="text-[11px] text-ink-tertiary uppercase tracking-wider mb-1.5">Coverage impact</p>
                          <div className="space-y-1">
                            {impact.map((d) => (
                              <div key={d.date} className="flex items-center justify-between text-[13px]">
                                <span>{formatDate(d.date, "long")}</span>
                                <span className={d.outCount + 1 >= 3 ? "text-status-danger-fg font-medium" : d.outCount + 1 >= 2 ? "text-status-warn-fg" : "text-ink-secondary"}>
                                  would be {d.outCount + 1} out / {d.scheduledCount} scheduled
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t border-line pt-3 flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
                          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                          Send absence notification email on approve
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => decide(req.id, "Denied")} disabled={mutation.isPending} className="btn">Deny</button>
                          <button onClick={() => decide(req.id, "Approved")} disabled={mutation.isPending} className="btn btn-primary">
                            {mutation.isPending ? "Saving…" : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Approved / Upcoming ── */}
      {approved.length > 0 && (
        <section>
          <button
            onClick={() => setShowApproved((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors mb-3"
          >
            {showApproved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span className="font-medium">Approved — upcoming</span>
            <span className="text-ink-tertiary font-normal">({approved.length})</span>
          </button>
          {showApproved && (
            <div className="space-y-1.5">
              {approved.map((req) => (
                <div key={req.id} className="card card-body flex items-center gap-3 py-2.5 opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium">{req.staffName}</span>
                      {req.type && <span className="badge bg-surface-muted text-ink-secondary">{req.type}</span>}
                      <span className="badge bg-status-success-bg text-status-success-fg">Approved</span>
                    </div>
                    <p className="text-[12px] text-ink-tertiary mt-0.5">{dateRange(req)}</p>
                  </div>
                  {req.notes && (
                    <p className="text-[12px] text-ink-secondary italic truncate max-w-[200px]">&ldquo;{req.notes}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
