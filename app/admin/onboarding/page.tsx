"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Check, Lock, ArrowRight, GraduationCap, Phone } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface OnboardingPO {
  id: string;
  student: string;
  grade: string | null;
  poDate: string | null;
  subjects: string[];
  phone: string | null;
  outcome: string | null;
  plannedStartDate: string | null;
  plannedClassTime: string | null;
  plannedSchedule: string[];
  daysSinceContact: number | null;
  stalled: boolean;
  startDateSet: boolean;
  scheduleSet: boolean;
  eEnrollmentCompleted: boolean;
  invoiceSent: boolean;
  recurringInvoiceSetUp: boolean;
  plasticFolderMade: boolean;
  booksPulled: boolean;
  firstInvoicePaid: boolean;
  enrolledInKsis: boolean;
}

const QUERY_KEY = ["admin", "onboarding"] as const;

// The prerequisite steps shown as the checklist grid. "Enrolled in KSIS" is NOT
// here — it's the final, deliberate action rendered separately at the bottom of
// each card (with a confirmation), because it activates the student and clears
// the card from this list.
type Step = {
  key: keyof OnboardingPO;
  label: string;
  bodyKey?: string;
  derivedHint?: string;
};

const PREREQ_STEPS: Step[] = [
  { key: "startDateSet", label: "Start date set", derivedHint: "Set on the PO recap / Upcoming starts" },
  { key: "scheduleSet", label: "Schedule set", derivedHint: "Set on the PO recap" },
  { key: "eEnrollmentCompleted", label: "eEnrollment form done", bodyKey: "eEnrollmentCompleted" },
  { key: "invoiceSent", label: "Invoice sent", bodyKey: "invoiceSent" },
  { key: "recurringInvoiceSetUp", label: "Recurring invoice set up", bodyKey: "recurringInvoiceSetUp" },
  { key: "plasticFolderMade", label: "Plastic folder made", bodyKey: "plasticFolderMade" },
  { key: "booksPulled", label: "Books pulled", bodyKey: "booksPulled" },
  { key: "firstInvoicePaid", label: "First invoice paid", bodyKey: "firstInvoicePaid" }
];

const TOTAL = PREREQ_STEPS.length;

function doneCount(po: OnboardingPO): number {
  return PREREQ_STEPS.reduce((n, s) => n + (po[s.key] ? 1 : 0), 0);
}

// "Ready for KSIS" once every prerequisite step is done.
function readyForKsis(po: OnboardingPO): boolean {
  return PREREQ_STEPS.every((s) => Boolean(po[s.key]));
}

function quietLabel(days: number | null): string {
  if (days === null) return "Call · no contact yet";
  return `Call · ${days}d quiet`;
}

export default function OnboardingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<{ id: string; student: string } | null>(null);

  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => adminFetch<OnboardingPO[]>("/api/admin/onboarding")
  });

  const mutation = useMutation({
    mutationFn: ({ id, bodyKey, value }: { id: string; bodyKey: string; value: boolean }) =>
      adminFetch<{ id: string }>(`/api/admin/po-recaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [bodyKey]: value })
      }),
    // Optimistic update so the UI feels instant. Enrolling in KSIS removes the
    // card immediately; other toggles just flip the step.
    onMutate: async ({ id, bodyKey, value }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<OnboardingPO[]>(QUERY_KEY);
      qc.setQueryData<OnboardingPO[]>(QUERY_KEY, (old) => {
        const list = old ?? [];
        if (bodyKey === "enrolledInKsis" && value) {
          return list.filter((po) => po.id !== id);
        }
        return list.map((po) => (po.id === id ? { ...po, [bodyKey]: value } : po));
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.push(err instanceof Error ? err.message : "Failed to save", "error");
    },
    onSuccess: (_data, vars) => {
      if (vars.bodyKey === "enrolledInKsis" && vars.value) {
        toast.push("Enrolled in KSIS — student activated, filed away. 🎉", "success");
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY })
  });

  const toggle = (po: OnboardingPO, step: Step) => {
    if (!step.bodyKey) return; // derived, not directly editable
    mutation.mutate({ id: po.id, bodyKey: step.bodyKey, value: !po[step.key] });
  };

  const confirmEnroll = () => {
    if (!confirm) return;
    mutation.mutate({ id: confirm.id, bodyKey: "enrolledInKsis", value: true });
    setConfirm(null);
  };

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="w-5 h-5" />}
        message="No families in onboarding right now. Every enrolling family is either fully set up or hasn't reached the enrollment stage yet."
      />
    );
  }

  const rows = q.data;
  const ready = rows.filter(readyForKsis).length;
  const stalledCount = rows.filter((p) => p.stalled).length;
  const tally = (key: keyof OnboardingPO) => rows.filter((p) => !p[key]).length;
  const board: { label: string; count: number; tone?: "ready" | "warn" }[] = [
    { label: "In onboarding", count: rows.length },
    { label: "Stalled — call", count: stalledCount, tone: "warn" },
    { label: "Ready for KSIS", count: ready, tone: "ready" },
    { label: "Invoices to send", count: tally("invoiceSent") },
    { label: "Recurring to set up", count: tally("recurringInvoiceSetUp") },
    { label: "Folders to make", count: tally("plasticFolderMade") },
    { label: "Books to pull", count: tally("booksPulled") },
    { label: "Awaiting 1st payment", count: tally("firstInvoicePaid") }
  ];

  return (
    <div className="space-y-4">
      {/* Scoreboard — what needs doing */}
      <div className="card card-body">
        <p className="text-[13px] font-medium mb-3">What needs doing</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {board.map((b) => {
            const lit = (b.count ?? 0) > 0;
            return (
              <div
                key={b.label}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  b.tone === "warn" && lit
                    ? "border-tint-alerts-fg/40 bg-tint-alerts-bg text-tint-alerts-fg"
                    : b.tone === "ready" && lit
                    ? "border-brand/40 bg-tint-purple-bg text-tint-purple-fg"
                    : "border-line bg-surface"
                )}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-semibold leading-none tabular-nums">{b.count}</span>
                  {b.tone === "ready" && lit && <ArrowRight className="w-3.5 h-3.5" />}
                  {b.tone === "warn" && lit && <Phone className="w-3.5 h-3.5" />}
                </div>
                <p className={cn("text-[11px] mt-1 leading-tight", !b.tone && "text-ink-secondary")}>{b.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] text-ink-secondary">
        Families actively enrolling, tracked through to KSIS — the digital green folder sleeve.
        A <span className="font-medium">Call</span> flag means they planned to enroll but have no start date and
        have gone quiet (7+ days) — chase them down. The final <span className="font-medium">Enroll in KSIS</span>{" "}
        button (bottom-right of each card) activates the student and files them off this list.
      </p>

      {rows.map((po) => {
        const done = doneCount(po);
        const isReady = readyForKsis(po);
        return (
          <div key={po.id} className={cn("card", po.stalled && "ring-1 ring-tint-alerts-fg/40")}>
            <div className="panel-head bg-tint-notes-bg text-tint-notes-fg">
              <span className="font-medium">
                {po.student}
                {po.grade && <span className="ml-2 text-[12px] font-normal">Gr {po.grade}</span>}
              </span>
              <span className="inline-flex items-center gap-2">
                {po.stalled && (
                  <span className="badge bg-tint-alerts-bg text-tint-alerts-fg inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {quietLabel(po.daysSinceContact)}
                  </span>
                )}
                {isReady && <span className="badge bg-tint-purple-bg text-tint-purple-fg">Ready for KSIS</span>}
                <span
                  className={cn(
                    "badge",
                    isReady ? "bg-status-success-bg text-status-success-fg" : "bg-surface text-ink-secondary"
                  )}
                >
                  {done}/{TOTAL} done
                </span>
              </span>
            </div>

            <div className="panel-body space-y-3">
              <p className="meta">
                {po.subjects.join(" + ") || "—"}
                {po.plannedStartDate && ` · starts ${formatDate(po.plannedStartDate, "short")}`}
                {po.plannedClassTime && ` · ${po.plannedClassTime}`}
                {po.plannedSchedule.length > 0 &&
                  ` · ${po.plannedSchedule.map((d) => d.slice(0, 3)).join("/")}`}
                {po.phone && ` · ${po.phone}`}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {PREREQ_STEPS.map((step) => {
                  const checked = Boolean(po[step.key]);
                  const derived = !step.bodyKey;
                  return (
                    <button
                      key={String(step.key)}
                      onClick={() => toggle(po, step)}
                      disabled={derived}
                      title={derived ? step.derivedHint : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                        checked
                          ? "border-status-success-fg/30 bg-status-success-bg text-status-success-fg"
                          : "border-line bg-surface hover:bg-surface-muted",
                        derived ? "cursor-default opacity-90" : "cursor-pointer"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                          checked
                            ? "border-status-success-fg bg-status-success-fg text-white"
                            : "border-line bg-surface"
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1">{step.label}</span>
                      {derived && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
                    </button>
                  );
                })}
              </div>

              {/* Final action — deliberate, confirmed, bottom-right */}
              <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
                {!isReady && (
                  <span className="text-[11px] text-ink-tertiary">Finish the steps above, then enroll</span>
                )}
                <button
                  onClick={() => setConfirm({ id: po.id, student: po.student })}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all",
                    "bg-tint-purple-bg text-tint-purple-fg border border-tint-purple-fg/30 hover:opacity-90",
                    isReady && "ring-2 ring-tint-purple-fg/40"
                  )}
                >
                  <GraduationCap className="h-4 w-4" /> Enroll in KSIS
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Confirmation for the irreversible-feeling final step */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Enroll in KSIS?"
        icon={<GraduationCap className="w-4 h-4" />}
        tintClassName="bg-tint-purple-bg text-tint-purple-fg"
        size="sm"
        footer={
          <>
            <button onClick={() => setConfirm(null)} className="btn">Cancel</button>
            <button onClick={confirmEnroll} className="btn btn-primary">Yes, enroll in KSIS</button>
          </>
        }
      >
        <p className="text-[14px]">
          Mark <span className="font-medium">{confirm?.student}</span> as enrolled in KSIS?
        </p>
        <p className="text-[13px] text-ink-secondary mt-2">
          This moves the student to <span className="font-medium">Active-Engaged</span> and removes
          them from the onboarding list. It does not set an enrollment date — that comes from the KSIS report.
        </p>
      </Modal>
    </div>
  );
}
