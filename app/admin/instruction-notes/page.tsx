"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextArea } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";

interface PendingNote {
  id: string;
  studentName: string | null;
  studentGrade: string | null;
  note: string;
  closingNote: string;
  parentFacingVersion: string;
  category: string | null;
  createdBy: string | null;
  dateNoted: string | null;
  completedBy: string | null;
  completedDate: string | null;
}

const CATEGORY_TONE: Record<string, string> = {
  "Attendance":   "bg-status-warn-bg text-status-warn-fg",
  "Behavior":     "bg-status-danger-bg text-status-danger-fg",
  "Academic":     "bg-tint-notes-bg text-tint-notes-fg",
  "Achievement":  "bg-status-success-bg text-status-success-fg",
  "Logistics":    "bg-surface-muted text-ink-secondary"
};

export default function AdminNotesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["admin", "instruction-notes"],
    queryFn: () => adminFetch<PendingNote[]>("/api/admin/instruction-notes")
  });

  // Optimistically acknowledged notes (disappear from list after click)
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  // Per-note editable parent-facing version
  const [edits, setEdits] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: ({ id, parentFacingVersion }: { id: string; parentFacingVersion: string }) =>
      adminFetch<{ id: string }>(`/api/admin/instruction-notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision: "Approved", parentFacingVersion })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "instruction-notes"] })
  });

  const acknowledge = async (note: PendingNote) => {
    const parentVersion = edits[note.id] ?? note.parentFacingVersion ?? note.closingNote ?? "";
    setAcknowledgedIds((prev) => new Set(prev).add(note.id));
    if (expandedId === note.id) setExpandedId(null);
    try {
      await mutation.mutateAsync({ id: note.id, parentFacingVersion: parentVersion });
      toast.push("Acknowledged.", "success");
    } catch (e) {
      setAcknowledgedIds((prev) => { const next = new Set(prev); next.delete(note.id); return next; });
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const all = q.data ?? [];
  const pending = all.filter((n) => !acknowledgedIds.has(n.id));
  const acknowledged = all.filter((n) => acknowledgedIds.has(n.id));

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-ink-secondary">
        Staff can add instruction notes without approval — they go live immediately. Review them here, edit the parent-facing version if needed, then acknowledge to clear from your list.
      </p>

      {/* Pending review */}
      <section>
        <h3 className="text-[14px] font-medium mb-3">
          Needs review{" "}
          <span className="text-[12px] text-ink-tertiary font-normal">({pending.length})</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState message="All notes reviewed — nothing pending." />
        ) : (
          <div className="space-y-1.5">
            {pending.map((note) => {
              const isExpanded = expandedId === note.id;
              const catTone = CATEGORY_TONE[note.category ?? ""] ?? "bg-surface-muted text-ink-secondary";
              const editedVersion = edits[note.id] ?? note.parentFacingVersion ?? note.closingNote ?? "";

              return (
                <div key={note.id} className="border border-line rounded-lg overflow-hidden">
                  {/* Row */}
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-muted transition-colors ${isExpanded ? "bg-surface-muted" : "bg-surface"}`}
                    onClick={() => setExpandedId(isExpanded ? null : note.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium">{note.studentName ?? "(student)"}</span>
                        {note.studentGrade && <span className="text-[12px] text-ink-secondary">Gr. {note.studentGrade}</span>}
                        {note.category && <span className={`badge ${catTone}`}>{note.category}</span>}
                      </div>
                      <p className="text-[12px] text-ink-tertiary mt-0.5 truncate">
                        {note.createdBy ?? "—"}
                        {note.dateNoted && ` · ${formatDate(note.dateNoted, "short")}`}
                        {note.note && ` · "${note.note.slice(0, 60)}${note.note.length > 60 ? "…" : ""}"`}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); acknowledge(note); }}
                        className="btn btn-primary"
                        title="Acknowledge — saves parent-facing version and clears from list"
                      >
                        <Check className="w-3.5 h-3.5" /> Acknowledged
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-line p-4 bg-surface space-y-4">
                      <div>
                        <p className="text-[11px] text-ink-tertiary uppercase tracking-wider mb-1">Original note <span className="normal-case">— internal</span></p>
                        <div className="text-[14px] bg-surface-muted rounded p-3 leading-snug">
                          {note.note}
                          <p className="text-[11px] text-ink-tertiary mt-2">
                            by {note.createdBy ?? "—"} · {note.dateNoted && formatDate(note.dateNoted, "short")}
                          </p>
                        </div>
                      </div>

                      {note.closingNote && (
                        <div>
                          <p className="text-[11px] text-ink-tertiary uppercase tracking-wider mb-1">Staff closing note <span className="normal-case">— internal</span></p>
                          <div className="text-[14px] bg-surface-muted rounded p-3 leading-snug">
                            {note.closingNote}
                            {note.completedBy && (
                              <p className="text-[11px] text-ink-tertiary mt-2">
                                closed by {note.completedBy} · {note.completedDate && formatDate(note.completedDate, "short")}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <Field label="Parent-facing version" hint="editable — polish tone before acknowledging">
                        <div className="relative">
                          <Sparkles className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-tint-notes-sub pointer-events-none" />
                          <TextArea
                            value={editedVersion}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [note.id]: e.target.value }))}
                            className="min-h-[100px] pl-8"
                            style={{ borderColor: "#6DCFF6" }}
                          />
                        </div>
                      </Field>

                      <div className="flex justify-end gap-2">
                        <button onClick={() => acknowledge(note)} className="btn btn-primary">
                          <Check className="w-3.5 h-3.5" /> Acknowledge
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Acknowledged this session */}
      {acknowledged.length > 0 && (
        <section>
          <button
            onClick={() => setShowAcknowledged((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors mb-2"
          >
            {showAcknowledged ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Acknowledged this session ({acknowledged.length})
          </button>
          {showAcknowledged && (
            <div className="space-y-1.5 opacity-50">
              {acknowledged.map((n) => (
                <div key={n.id} className="card card-body flex items-center gap-3 py-2">
                  <Check className="w-3.5 h-3.5 text-status-success-fg shrink-0" />
                  <span className="text-[14px] font-medium">{n.studentName ?? "(student)"}</span>
                  {n.category && <span className="text-[12px] text-ink-tertiary">{n.category}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
