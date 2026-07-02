"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, UserCheck, ClipboardCheck, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface UpcomingStart {
  id: string;
  studentIds: string[];
  alreadyStarted: boolean;
  student: string;
  grade: string | null;
  subjects: string[];
  plannedStartDate: string | null;
  plannedClassTime: string | null;
  plannedSchedule: string[];
  outcome: string | null;
  recapStatus: string | null;
  eEnrollmentCompleted: boolean;
  phone: string | null;
  invoiceSent: boolean;
  recurringInvoiceSetUp: boolean;
  plasticFolderMade: boolean;
  booksPulled: boolean;
  firstInvoicePaid: boolean;
  enrolledInKsis: boolean;
}

type ChecklistKey =
  | "eEnrollmentCompleted" | "invoiceSent" | "recurringInvoiceSetUp"
  | "plasticFolderMade" | "booksPulled" | "firstInvoicePaid";

const CHECKLIST_STEPS: { key: ChecklistKey; label: string; bodyKey: string }[] = [
  { key: "eEnrollmentCompleted",  label: "eEnrollment form",      bodyKey: "eEnrollmentCompleted" },
  { key: "invoiceSent",           label: "Invoice sent",          bodyKey: "invoiceSent" },
  { key: "recurringInvoiceSetUp", label: "Recurring invoice set", bodyKey: "recurringInvoiceSetUp" },
  { key: "plasticFolderMade",     label: "Plastic folder made",   bodyKey: "plasticFolderMade" },
  { key: "booksPulled",           label: "Books pulled",          bodyKey: "booksPulled" },
  { key: "firstInvoicePaid",      label: "First invoice paid",    bodyKey: "firstInvoicePaid" },
];

function doneCount(s: UpcomingStart): number {
  return CHECKLIST_STEPS.reduce((n, step) => n + (s[step.key] ? 1 : 0), 0);
}

const QUERY_KEY = ["admin", "upcoming-starts"] as const;

export default function UpcomingStartsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => adminFetch<UpcomingStart[]>("/api/admin/upcoming-starts")
  });

  const today = new Date().toISOString().slice(0, 10);

  // Date editing
  const [editing, setEditing] = useState<Record<string, string>>({});
  // Which checklist modal is open
  const [checklistFor, setChecklistFor] = useState<UpcomingStart | null>(null);

  const dateMutation = useMutation({
    mutationFn: ({ id, plannedStartDate }: { id: string; plannedStartDate: string }) =>
      adminFetch<{ id: string }>(`/api/admin/po-recaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ plannedStartDate })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY })
  });

  const checklistMutation = useMutation({
    mutationFn: ({ id, bodyKey, value }: { id: string; bodyKey: string; value: boolean }) =>
      adminFetch<{ id: string }>(`/api/admin/po-recaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [bodyKey]: value })
      }),
    onMutate: async ({ id, bodyKey, value }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<UpcomingStart[]>(QUERY_KEY);
      qc.setQueryData<UpcomingStart[]>(QUERY_KEY, (old) =>
        (old ?? []).map((s) => s.id === id ? { ...s, [bodyKey]: value } : s)
      );
      // Keep checklist modal in sync
      setChecklistFor((prev) => prev?.id === id ? { ...prev, [bodyKey]: value } : prev);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.push(err instanceof Error ? err.message : "Failed to save", "error");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY })
  });

  const markActive = useMutation({
    mutationFn: ({ studentIds }: { studentIds: string[] }) =>
      adminFetch<{ updated: number }>(`/api/students/mark-first-class`, {
        method: "POST",
        body: JSON.stringify({ studentIds })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY })
  });

  const saveDate = async (id: string) => {
    const newDate = editing[id];
    if (!newDate) return;
    try {
      await dateMutation.mutateAsync({ id, plannedStartDate: newDate });
      toast.push("Start date updated.", "success");
      setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const markStarted = async (s: UpcomingStart) => {
    if (!s.studentIds?.length) { toast.push("No linked student to mark.", "error"); return; }
    try {
      await markActive.mutateAsync({ studentIds: s.studentIds });
      toast.push(`${s.student} marked active — first class attended.`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) {
    return <EmptyState icon={<CalendarDays className="w-5 h-5" />} message="No upcoming starts on the books." />;
  }

  const pastDue = q.data.filter((s) => s.plannedStartDate && s.plannedStartDate < today);
  const upcoming = q.data.filter((s) => !s.plannedStartDate || s.plannedStartDate >= today);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-secondary">
        Students with a planned start date coming up. Past-due are highlighted — call them first.
      </p>

      {pastDue.length > 0 && (
        <section>
          <h3 className="text-[13px] font-medium text-status-danger-fg mb-2">Past due start date ({pastDue.length})</h3>
          <StudentList
            items={pastDue}
            editing={editing}
            today={today}
            onEdit={(id, val) => setEditing({ ...editing, [id]: val })}
            onSaveDate={saveDate}
            onMarkStarted={markStarted}
            onOpenChecklist={setChecklistFor}
            datePending={dateMutation.isPending}
            markPending={markActive.isPending}
            isPastDue
          />
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          {pastDue.length > 0 && <h3 className="text-[13px] font-medium text-ink-secondary mb-2">Upcoming ({upcoming.length})</h3>}
          <StudentList
            items={upcoming}
            editing={editing}
            today={today}
            onEdit={(id, val) => setEditing({ ...editing, [id]: val })}
            onSaveDate={saveDate}
            onMarkStarted={markStarted}
            onOpenChecklist={setChecklistFor}
            datePending={dateMutation.isPending}
            markPending={markActive.isPending}
          />
        </section>
      )}

      {/* Checklist Modal */}
      {checklistFor && (
        <ChecklistModal
          s={checklistFor}
          onClose={() => setChecklistFor(null)}
          onToggle={(bodyKey, value) =>
            checklistMutation.mutate({ id: checklistFor.id, bodyKey, value })
          }
          isPending={checklistMutation.isPending}
        />
      )}
    </div>
  );
}

function StudentList({
  items, editing, today, onEdit, onSaveDate, onMarkStarted, onOpenChecklist,
  datePending, markPending, isPastDue = false
}: {
  items: UpcomingStart[];
  editing: Record<string, string>;
  today: string;
  onEdit: (id: string, val: string) => void;
  onSaveDate: (id: string) => void;
  onMarkStarted: (s: UpcomingStart) => void;
  onOpenChecklist: (s: UpcomingStart) => void;
  datePending: boolean;
  markPending: boolean;
  isPastDue?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const isEditing = s.id in editing;
        const editValue = editing[s.id] ?? s.plannedStartDate ?? "";
        const done = doneCount(s);
        const total = CHECKLIST_STEPS.length;
        const allDone = done === total;

        return (
          <div key={s.id} className={cn(
            "card card-body",
            isPastDue && "border-status-danger-fg/30 bg-status-danger-bg/5"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px] font-medium leading-tight">
                    {s.student}
                    {s.grade && <span className="ml-2 text-[12px] text-ink-secondary font-normal">Gr {s.grade}</span>}
                  </p>
                  {s.eEnrollmentCompleted && (
                    <span className="badge bg-status-success-bg text-status-success-fg">eEnrolled</span>
                  )}
                </div>
                <p className="meta mt-1">
                  {s.subjects.join(" + ")}
                  {s.plannedClassTime && ` · ${s.plannedClassTime}`}
                  {s.plannedSchedule.length > 0 && ` · ${s.plannedSchedule.map((d) => d.slice(0, 3)).join("/")}`}
                </p>
                {/* Contact info */}
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="inline-flex items-center gap-1 text-[12px] text-brand mt-1 hover:underline"
                  >
                    <Phone className="w-3 h-3" /> {s.phone}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex flex-col items-end gap-2">
                {/* Checklist button with progress */}
                <button
                  onClick={() => onOpenChecklist(s)}
                  className={cn(
                    "btn inline-flex items-center gap-1.5",
                    allDone ? "btn-primary" : ""
                  )}
                  title="Open onboarding checklist"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Checklist
                  <span className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded-full",
                    allDone
                      ? "bg-white/20 text-white"
                      : done > 0 ? "bg-status-warn-bg text-status-warn-fg" : "bg-surface-muted text-ink-tertiary"
                  )}>
                    {done}/{total}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  {/* First class done */}
                  <button
                    onClick={() => onMarkStarted(s)}
                    disabled={markPending}
                    className="btn"
                    title="Mark first class attended — flips the student to Active-Engaged"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> First class done
                  </button>

                  {/* Date editor */}
                  <TextInput
                    type="date"
                    value={editValue}
                    onChange={(e) => onEdit(s.id, e.target.value)}
                    className="w-[150px]"
                  />
                  {isEditing && editing[s.id] !== s.plannedStartDate && (
                    <button
                      onClick={() => onSaveDate(s.id)}
                      disabled={datePending}
                      className="btn btn-primary"
                      title="Save new start date"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isEditing && s.plannedStartDate && (
                    <span className={cn(
                      "text-[12px] w-[80px]",
                      isPastDue ? "text-status-danger-fg font-medium" : "text-ink-tertiary"
                    )}>
                      {formatDate(s.plannedStartDate, "short")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChecklistModal({
  s, onClose, onToggle, isPending
}: {
  s: UpcomingStart;
  onClose: () => void;
  onToggle: (bodyKey: string, value: boolean) => void;
  isPending: boolean;
}) {
  const done = doneCount(s);
  const total = CHECKLIST_STEPS.length;
  const allDone = done === total;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${s.student} — Onboarding`}
      icon={<ClipboardCheck className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="sm"
    >
      <p className="text-[13px] text-ink-secondary mb-4">
        {allDone
          ? "All steps done — ready to enroll in KSIS."
          : `${done} of ${total} steps complete.`}
      </p>

      <div className="space-y-2">
        {CHECKLIST_STEPS.map((step) => {
          const checked = Boolean(s[step.key as keyof UpcomingStart]);
          return (
            <label
              key={step.key}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                checked
                  ? "bg-status-success-bg/20 border-status-success-fg/30"
                  : "border-line hover:bg-surface-muted"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(step.bodyKey, e.target.checked)}
                disabled={isPending}
                className="w-4 h-4 accent-status-success-fg"
              />
              <span className={cn("text-[14px]", checked && "line-through text-ink-tertiary")}>
                {step.label}
              </span>
              {checked && <Check className="w-3.5 h-3.5 text-status-success-fg ml-auto" />}
            </label>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-4 bg-status-success-bg text-status-success-fg rounded-lg p-3 text-[13px] font-medium text-center">
          ✓ Ready to enroll in KSIS — go to Onboarding page for the final step
        </div>
      )}
    </Modal>
  );
}
