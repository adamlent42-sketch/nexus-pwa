"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, UserCheck, Mail, ClipboardCheck } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextInput } from "@/components/ui/Field";
import { OnboardingChecklist } from "@/components/forms/OnboardingChecklist";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  firstClassDate: string | null;
  firstClassAttended: string | null;
  eEnrolled: boolean;
  amountDue?: number | null;
  coveredByFamily?: boolean;
  nudged?: boolean;
  nudgeCount?: number;
  nudgedDate?: string | null;
  checklistDone?: number;
  checklistTotal?: number;
}

function money(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
interface OnboardingData { planned: Row[]; pastDue: Row[]; firstMonthWatch: Row[]; }

async function fetchOnboarding(): Promise<OnboardingData> {
  const res = await fetch("/api/students/onboarding");
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "Failed to load");
  return body.data as OnboardingData;
}

function meta(s: Row): string {
  const parts: string[] = [];
  if (s.grade) parts.push(`Gr ${s.grade}`);
  if (s.subjects.length) parts.push(s.subjects.join(" + "));
  return parts.join(" · ");
}

export function Onboarding() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editDate, setEditDate] = useState<Record<string, string>>({});
  const [checklistFor, setChecklistFor] = useState<{ id: string; name: string } | null>(null);

  // Cache 15 min and don't refetch on tab focus — invoice amounts (pulled live
  // inside this query) rarely change. Owner actions invalidate it for instant
  // updates, so the list never feels stale.
  const q = useQuery({
    queryKey: ["students", "onboarding"],
    queryFn: fetchOnboarding,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["students", "onboarding"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const markActive = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch("/api/students/mark-first-class", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId] })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onSuccess: invalidate
  });

  const reschedule = useMutation({
    mutationFn: async ({ studentId, date }: { studentId: string; date: string }) => {
      const res = await fetch("/api/students/set-first-class-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, date })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onSuccess: invalidate
  });

  const arrived = async (s: Row) => {
    try {
      await markActive.mutateAsync(s.id);
      toast.push(`${s.name} marked active — first class attended.`, "success");
    } catch (e) { toast.push(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const saveDate = async (s: Row) => {
    const newDate = editDate[s.id];
    if (!newDate || newDate === s.firstClassDate) return;
    try {
      await reschedule.mutateAsync({ studentId: s.id, date: newDate });
      toast.push(`${s.name}'s start moved to ${formatDate(newDate, "short")}.`, "success");
      setEditDate((p) => { const n = { ...p }; delete n[s.id]; return n; });
    } catch (e) { toast.push(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const nudgeNow = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch("/api/students/nudge-now", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onSuccess: invalidate
  });

  const sendNudge = async (s: Row) => {
    try {
      const r = await nudgeNow.mutateAsync(s.id);
      toast.push(r?.queued === false ? "Already queued — no duplicate sent." : `Check-in queued for ${s.name}'s family.`, "success");
    } catch (e) { toast.push(e instanceof Error ? e.message : "Failed", "error"); }
  };

  // First-month watch now lives in its own "Recently started" card — this card
  // covers the pre-start journey only (planned + past due).
  const total = q.data
    ? q.data.planned.length + q.data.pastDue.length
    : undefined;
  const rightSlot = q.data
    ? [q.data.planned.length && `${q.data.planned.length} planned`,
       q.data.pastDue.length && `${q.data.pastDue.length} past due`]
        .filter(Boolean).join(" · ")
    : undefined;

  return (
    <PanelCard
      tint="purple"
      title="Onboarding · before first class"
      icon={<GraduationCap className="w-4 h-4" />}
      rightSlot={rightSlot || undefined}
    >
      {q.isPending && <Skeleton rows={3} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && total === 0 && (
        <EmptyState icon={<GraduationCap className="w-4 h-4" />} message="No one in the onboarding pipeline." />
      )}
      {q.data && total !== undefined && total > 0 && (
        <div className="py-1">

          {/* Planned — action: arrived + reschedule */}
          {q.data.planned.length > 0 && (
            <Section label="Planned to start" tone="bg-status-info-bg text-status-info-fg">
              {q.data.planned.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-tight">
                      {s.name}
                      {meta(s) && <span className="text-[12px] text-ink-secondary ml-2 font-normal">· {meta(s)}</span>}
                      {typeof s.amountDue === "number" && <span className="ml-2 badge bg-tint-pos-bg text-tint-pos-fg" title="Family invoice balance due — one invoice for the whole family">Due {money(s.amountDue)}</span>}
                      {s.coveredByFamily && <span className="ml-2 badge bg-surface-subtle text-ink-tertiary border border-line" title="Covered by the family invoice shown on a sibling — not billed separately">on family invoice</span>}
                      {!s.eEnrolled && <span className="ml-2 badge bg-surface-subtle text-ink-secondary border border-line">No eEnroll</span>}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <ChecklistButton done={s.checklistDone ?? 0} total={s.checklistTotal ?? 16} onClick={() => setChecklistFor({ id: s.id, name: s.name })} />
                    <TextInput
                      type="date"
                      value={editDate[s.id] ?? s.firstClassDate ?? ""}
                      onChange={(e) => { setEditDate({ ...editDate, [s.id]: e.target.value }); }}
                      onBlur={() => saveDate(s)}
                      className="w-[150px]"
                      title="Reschedule first-class date"
                    />
                    <button onClick={() => arrived(s)} disabled={markActive.isPending} className="btn btn-primary" title="Mark first class attended → Active">
                      <UserCheck className="w-3.5 h-3.5" /> Arrived
                    </button>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Past due — late-arrival path + send-now nudge; auto-nudge backstops in 3 days */}
          {q.data.pastDue.length > 0 && (
            <Section label="Past due — mark arrived, reschedule, or no-show" tone="bg-status-warn-bg text-status-warn-fg">
              {q.data.pastDue.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-tight">
                      {s.name}
                      {meta(s) && <span className="text-[12px] text-ink-secondary ml-2 font-normal">· {meta(s)}</span>}
                      <span className="ml-2 text-[12px] text-ink-tertiary">· due {s.firstClassDate ? formatDate(s.firstClassDate, "short") : "—"}</span>
                      {s.nudged && (
                        <span className="ml-2 badge bg-status-success-bg text-status-success-fg">
                          nudged{s.nudgeCount && s.nudgeCount > 1 ? ` ×${s.nudgeCount}` : ""}{s.nudgedDate ? ` · ${formatDate(s.nudgedDate, "short")}` : ""}
                        </span>
                      )}
                      {(s.nudgeCount ?? 0) >= 2 && (
                        <span className="ml-2 badge bg-status-danger-bg text-status-danger-fg">Call</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <ChecklistButton done={s.checklistDone ?? 0} total={s.checklistTotal ?? 16} onClick={() => setChecklistFor({ id: s.id, name: s.name })} />
                    <TextInput
                      type="date"
                      value={editDate[s.id] ?? s.firstClassDate ?? ""}
                      onChange={(e) => { setEditDate({ ...editDate, [s.id]: e.target.value }); }}
                      onBlur={() => saveDate(s)}
                      className="w-[140px]"
                      title="Reschedule first-class date"
                    />
                    <button onClick={() => arrived(s)} disabled={markActive.isPending} className="btn btn-primary" title="Mark first class attended → Active">
                      <UserCheck className="w-3.5 h-3.5" /> Arrived
                    </button>
                    {!s.nudged && (
                      <button onClick={() => sendNudge(s)} disabled={nudgeNow.isPending} className="btn" title="No-show → send the gentle 'we missed you' check-in now (otherwise it auto-sends after 3 days)">
                        <Mail className="w-3.5 h-3.5" /> No-show
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

        </div>
      )}

      <OnboardingChecklist
        open={!!checklistFor}
        onClose={() => setChecklistFor(null)}
        studentId={checklistFor?.id ?? null}
        studentName={checklistFor?.name}
      />
    </PanelCard>
  );
}

// Onboarding checklist button — green fills left-to-right via a thin meter under
// the label, based on how many of the 16 checklist items are complete.
function ChecklistButton({ done, total, onClick }: { done: number; total: number; onClick: () => void }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <button onClick={onClick} title="Open onboarding checklist"
      className={`shrink-0 w-[150px] rounded-md border bg-surface px-2.5 py-[7px] text-left transition-colors ${complete ? "border-status-success-fg" : "border-line hover:border-brand"}`}>
      <span className="flex items-center justify-between text-[12px] leading-none">
        <span className="inline-flex items-center gap-1 text-ink">
          <ClipboardCheck className="w-3.5 h-3.5" /> {complete ? "Complete" : "Checklist"}
        </span>
        <span className={complete ? "text-status-success-fg font-medium" : "text-ink-secondary"}>{done}/{total}</span>
      </span>
      <span className="block h-[5px] rounded-full bg-surface-subtle mt-2 overflow-hidden">
        <span className="block h-full rounded-full bg-status-success-fg transition-all" style={{ width: `${pct}%` }} />
      </span>
    </button>
  );
}

function Section({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  // Full-width solid bar (not an inline pill) so the section header reads as a
  // divider and is never confused with the small chips on individual rows.
  return (
    <div className="mb-3 last:mb-0">
      <div className={`rounded-md px-3 py-1.5 mb-2 text-[12px] font-semibold tracking-wide ${tone}`}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
