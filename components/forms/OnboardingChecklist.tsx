"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Check, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { WEEKDAYS, PICKUP_DAYS } from "@/lib/options";

interface Checklist {
  id: string; name: string; lifecycle: string | null; firstClassDate: string | null;
  subjects: string[]; grade: string | null; schedule: string[]; workPickupDay: string | null;
  mathLevel: string | null; readingLevel: string | null;
  folderMade: boolean; nameLabelMade: boolean; worksheetsPulled: boolean; pouchReady: boolean;
  invoiceAccountCreated: boolean; firstInvoiceSent: boolean; recurringInvoiceSet: boolean;
  firstInvoicePaid: boolean; firstPaymentDate: string | null;
  eEnrolled: boolean; eEnrollmentDate: string | null;
  ksisEnrolled: boolean; ksisConfirmedDate: string | null;
}

interface Props { open: boolean; onClose: () => void; studentId: string | null; studentName?: string }

type Toggle = { key: keyof Checklist; field: string; label: string; auto?: boolean };

const MATERIALS: Toggle[] = [
  { key: "folderMade", field: "Folder Made", label: "Plastic folder made" },
  { key: "nameLabelMade", field: "Name Label Made", label: "Name label made" },
  { key: "worksheetsPulled", field: "Worksheets Pulled", label: "Worksheets pulled" },
  { key: "pouchReady", field: "Pouch Ready", label: "Kumon pouch ready" }
];
const BILLING: Toggle[] = [
  { key: "invoiceAccountCreated", field: "Invoice Account Created", label: "Invoice Ninja account created" },
  { key: "firstInvoiceSent", field: "First Invoice Sent", label: "First invoice sent" },
  { key: "recurringInvoiceSet", field: "Recurring Invoice Set", label: "Recurring invoice set" },
  { key: "firstInvoicePaid", field: "First Invoice Paid", label: "First invoice paid (at class one)", auto: true }
];
const ENROLLMENT: Toggle[] = [
  { key: "eEnrolled", field: "eEnrollment Completed", label: "eEnrollment form done", auto: true },
  { key: "ksisEnrolled", field: "KSIS Enrolled", label: "Enrolled in KSIS" }
];

const GRADES = ["PK1", "PK2", "PreK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

// Airtable field name → local cache key, for optimistic updates.
const FIELD_KEY: Record<string, keyof Checklist> = {
  ...Object.fromEntries([...MATERIALS, ...BILLING, ...ENROLLMENT].map((t) => [t.field, t.key])),
  Subjects: "subjects", Grade: "grade", "Math Level": "mathLevel", "Reading Level": "readingLevel",
  "First Class Date": "firstClassDate", Schedule: "schedule", "Work Pickup Day": "workPickupDay"
};

export function OnboardingChecklist({ open, onClose, studentId, studentName }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["student", "checklist", studentId];

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Checklist> => {
      const res = await fetch(`/api/students/${studentId}/checklist`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed to load");
      return body.data as Checklist;
    },
    enabled: open && !!studentId
  });

  // Read-only Invoice Ninja lookup — the amount due at the first class.
  const invoice = useQuery({
    queryKey: ["student", "invoice", studentId],
    queryFn: async (): Promise<{ configured: boolean; found: boolean; ambiguous?: boolean; candidates?: string[]; number?: string; amount?: number; balance?: number; status?: string; firstInvoicePaid?: boolean; firstPaymentDate?: string | null }> => {
      const res = await fetch(`/api/students/${studentId}/invoice`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    enabled: open && !!studentId,
    staleTime: 60_000
  });

  const save = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean | string | string[] }) => {
      const res = await fetch(`/api/students/${studentId}/checklist`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Failed");
      return body.data;
    },
    onMutate: async ({ field, value }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Checklist>(key);
      const dataKey = FIELD_KEY[field];
      if (prev && dataKey) qc.setQueryData<Checklist>(key, { ...prev, [dataKey]: value });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["students", "onboarding"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    }
  });

  const d = q.data;

  // The invoice route writes "First Invoice Paid" back to Airtable when Invoice
  // Ninja shows the first invoice fully paid. When that happens, refetch the
  // checklist so the box flips to checked without the user toggling it.
  useEffect(() => {
    if (invoice.data?.firstInvoicePaid && d && !d.firstInvoicePaid) {
      qc.invalidateQueries({ queryKey: ["student", "checklist", studentId] });
      qc.invalidateQueries({ queryKey: ["students", "onboarding"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.data?.firstInvoicePaid, d?.firstInvoicePaid, studentId]);

  const hasMath = d?.subjects.includes("Math");
  const hasReading = d?.subjects.includes("Reading");
  const levelsDone = !!d && d.subjects.length > 0 &&
    (!hasMath || !!d.mathLevel) && (!hasReading || !!d.readingLevel);

  // Progress: derived recap completeness + toggleable boxes.
  const recapDone = d ? [
    d.subjects.length > 0, !!d.grade, levelsDone, !!d.firstClassDate, d.schedule.length > 0, !!d.workPickupDay
  ] : [];
  const allToggles = [...MATERIALS, ...BILLING, ...ENROLLMENT];
  const doneCount = (d ? allToggles.filter((t) => d[t.key]).length : 0) + recapDone.filter(Boolean).length;
  const total = allToggles.length + recapDone.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Onboarding checklist · ${d?.name ?? studentName ?? "student"}`}
      icon={<ClipboardCheck className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      size="md"
      footer={<button onClick={onClose} className="btn btn-primary">Done</button>}
    >
      {q.isPending && <Skeleton rows={6} />}
      {q.isError && <p className="text-[13px] text-status-danger-fg">{(q.error as Error).message}</p>}
      {d && (
        <div>
          {/* progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[12px] text-ink-secondary mb-1">
              <span>{doneCount} of {total} done{d.firstClassDate ? ` · starts ${formatDate(d.firstClassDate, "short")}` : ""}</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* From the PO recap — editable inline */}
          <Group title="From the PO recap" hint="edit right here">
            <div className="space-y-2.5 px-1">
              <EditRow label="Subjects" missing={d.subjects.length === 0}>
                <ChipGroup multi value={d.subjects} onChange={(v) => save.mutate({ field: "Subjects", value: v })} options={["Math", "Reading"]} />
              </EditRow>
              <EditRow label="Grade" missing={!d.grade}>
                <Select value={d.grade ?? ""} onChange={(e) => save.mutate({ field: "Grade", value: e.target.value })} className="w-[110px]">
                  <option value="">—</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </EditRow>
              {hasMath && (
                <EditRow label="Math level" missing={!d.mathLevel}>
                  <LevelInput value={d.mathLevel ?? ""} onSave={(v) => save.mutate({ field: "Math Level", value: v })} />
                </EditRow>
              )}
              {hasReading && (
                <EditRow label="Reading level" missing={!d.readingLevel}>
                  <LevelInput value={d.readingLevel ?? ""} onSave={(v) => save.mutate({ field: "Reading Level", value: v })} />
                </EditRow>
              )}
              <EditRow label="Start date" missing={!d.firstClassDate}>
                <TextInput type="date" value={d.firstClassDate ?? ""} onChange={(e) => save.mutate({ field: "First Class Date", value: e.target.value })} className="w-[150px]" />
              </EditRow>
              <EditRow label="Class days" missing={d.schedule.length === 0}>
                <ChipGroup multi value={d.schedule} onChange={(v) => save.mutate({ field: "Schedule", value: v })} options={[...WEEKDAYS]} />
              </EditRow>
              <EditRow label="Pickup day" missing={!d.workPickupDay}>
                <ChipGroup value={d.workPickupDay ?? ""} onChange={(v) => save.mutate({ field: "Work Pickup Day", value: v })} options={[...PICKUP_DAYS]} />
              </EditRow>
            </div>
          </Group>

          <Group title="Materials prep">
            {MATERIALS.map((t) => (
              <ToggleRow key={t.field} label={t.label} done={!!d[t.key]} disabled={save.isPending}
                onToggle={() => save.mutate({ field: t.field, value: !d[t.key] })} />
            ))}
          </Group>

          <Group title="Billing">
            {invoice.data?.configured && (
              <div className="mb-1.5 px-2 py-1.5 rounded bg-surface-subtle text-[12px]">
                {invoice.data.found ? (
                  invoice.data.amount != null ? (
                    <span>
                      <span className="text-ink-secondary">Family invoice — due at first class:</span>{" "}
                      <span className="font-semibold text-ink">${(invoice.data.balance ?? invoice.data.amount).toFixed(2)}</span>
                      {invoice.data.number && <span className="text-ink-tertiary"> · inv {invoice.data.number}</span>}
                      {invoice.data.status && <span className="text-ink-tertiary"> · {invoice.data.status}</span>}
                      <span className="block text-ink-tertiary mt-0.5">One invoice per family — covers all siblings, not per child.</span>
                    </span>
                  ) : (
                    <span className="text-ink-tertiary">Invoice Ninja client found, no invoice yet.</span>
                  )
                ) : invoice.data.ambiguous ? (
                  <span className="text-status-warn-fg">Multiple Invoice Ninja clients on this email{invoice.data.candidates?.length ? ` (${invoice.data.candidates.join(", ")})` : ""} — check manually.</span>
                ) : (
                  <span className="text-ink-tertiary">No matching invoice in Invoice Ninja yet.</span>
                )}
              </div>
            )}
            {BILLING.map((t) => (
              <ToggleRow key={t.field} label={t.label} done={!!d[t.key]} disabled={save.isPending}
                auto={t.auto}
                hint={t.key === "firstInvoicePaid" && d.firstPaymentDate ? `paid ${formatDate(d.firstPaymentDate, "short")}` : undefined}
                onToggle={() => save.mutate({ field: t.field, value: !d[t.key] })} />
            ))}
          </Group>

          <Group title="Enrollment">
            {ENROLLMENT.map((t) => (
              <ToggleRow key={t.field} label={t.label} done={!!d[t.key]} disabled={save.isPending}
                auto={t.auto}
                hint={t.key === "ksisEnrolled" && d.ksisConfirmedDate ? `confirmed ${formatDate(d.ksisConfirmedDate, "short")}`
                  : t.key === "eEnrolled" && d.eEnrollmentDate ? `done ${formatDate(d.eEnrollmentDate, "short")}` : undefined}
                onToggle={() => save.mutate({ field: t.field, value: !d[t.key] })} />
            ))}
          </Group>

          <p className="text-[11px] text-ink-tertiary mt-3">
            First invoice paid and eEnrollment auto-check from Invoice Ninja and the confirmation email — both stay manually toggleable as a fallback. KSIS is your manual check-off; it reconciles with the KSIS import over the next week or two.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline gap-2 mb-1.5">
        <p className="text-[12px] font-semibold text-ink-secondary">{title}</p>
        {hint && <span className="text-[11px] text-ink-tertiary">· {hint}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EditRow({ label, missing, children }: { label: string; missing: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="w-[78px] shrink-0 text-[12px] text-ink-secondary pt-1.5 flex items-center gap-1">
        {label}
        {missing && <span className="w-1.5 h-1.5 rounded-full bg-status-warn-fg" title="missing" />}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// Free-text level input that only saves on blur (levels look like "7A", "2A", "BII").
function LevelInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <TextInput
      key={value}
      defaultValue={value}
      placeholder="e.g. 7A"
      className="w-[110px]"
      onBlur={(e) => { const v = e.target.value.trim(); if (v !== value) onSave(v); }}
    />
  );
}

function ToggleRow({ label, done, onToggle, disabled, auto, hint }:
  { label: string; done: boolean; onToggle: () => void; disabled?: boolean; auto?: boolean; hint?: string }) {
  return (
    <button onClick={onToggle} disabled={disabled}
      className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-surface-subtle text-left transition-colors disabled:opacity-60">
      <span className={`shrink-0 w-[18px] h-[18px] rounded border flex items-center justify-center ${done ? "bg-brand border-brand text-white" : "border-line bg-surface"}`}>
        {done && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      <span className={`flex-1 text-[13px] ${done ? "text-ink-secondary line-through" : "text-ink"}`}>{label}</span>
      {hint && <span className="text-[11px] text-ink-tertiary">{hint}</span>}
      {auto && <span className="badge bg-status-info-bg text-status-info-fg inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />auto</span>}
    </button>
  );
}
