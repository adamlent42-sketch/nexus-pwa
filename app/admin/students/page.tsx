"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog, ClipboardCheck } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { OnboardingChecklist } from "@/components/forms/OnboardingChecklist";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { WEEKDAYS, PICKUP_DAYS } from "@/lib/options";

interface Picked { id: string; name: string; grade: string | null; status: string | null }
interface PO { id: string; poDate: string | null; status: string | null; outcome: string | null; plannedStartDate: string | null }
interface StudentRecord {
  id: string; name: string; grade: string | null; subjects: string[]; lifecycle: string | null;
  firstClassDate: string | null; firstClassAttended: string | null; eEnrollmentCompleted: boolean;
  schedule: string[]; workPickupDay: string | null; mathLevel: string | null; readingLevel: string | null;
  school: string | null; paperConnect: string | null; dob: string | null; enrollDate: string | null; endDate: string | null;
  holdStart: string | null; plannedReturn: string | null; breakCheckin: string | null; holdNotes: string | null; invoiceAction: string | null;
  po: PO | null;
}

const LIFECYCLE = [
  "Lead", "PO Booked", "Attended PO", "PO Attended - Did Not Enroll", "PO No-Show", "PO Cancelled",
  "Pending Start", "Pending Start State", "Active-Engaged", "Active-At-Risk", "Planned Break",
  "Recently Discontinued", "Reactivation Target", "Long Lapsed", "No Interest", "Historical"
];
const GRADES = ["PK1", "PK2", "PreK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];
const PO_STATUS = ["Scheduled", "Rescheduled", "Attended", "Not Attended", "Family Cancelled", "Instructor Cancelled"];
const PO_OUTCOME = ["Plan to Enroll", "Enrolled", "Undecided", "Not Interested"];
const PAPER_CONNECT = ["Paper", "Kumon Connect"];

export default function StudentManagerPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [form, setForm] = useState<StudentRecord | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Deep-link support: /admin/students?id=...&name=... preloads a student
  // (used by the "Fix" links on the Missing-data page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) setPicked({ id, name: params.get("name") ?? "(student)", grade: null, status: null });
  }, []);

  const q = useQuery({
    queryKey: ["admin", "student", picked?.id],
    queryFn: () => adminFetch<StudentRecord>(`/api/admin/students/${picked!.id}`),
    enabled: !!picked
  });

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: (rec: StudentRecord) =>
      adminFetch<{ id: string }>(`/api/admin/students/${rec.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lifecycle: rec.lifecycle ?? undefined,
          grade: rec.grade ?? undefined,
          subjects: rec.subjects,
          firstClassDate: rec.firstClassDate,
          firstClassAttended: rec.firstClassAttended,
          eEnrollmentCompleted: rec.eEnrollmentCompleted,
          schedule: rec.schedule,
          workPickupDay: rec.workPickupDay,
          mathLevel: rec.mathLevel,
          readingLevel: rec.readingLevel,
          school: rec.school,
          paperConnect: rec.paperConnect,
          dob: rec.dob,
          enrollDate: rec.enrollDate,
          endDate: rec.endDate,
          holdStart: rec.holdStart,
          plannedReturn: rec.plannedReturn,
          breakCheckin: rec.breakCheckin,
          holdNotes: rec.holdNotes,
          invoiceAction: rec.invoiceAction,
          po: rec.po ? { id: rec.po.id, status: rec.po.status ?? undefined, outcome: rec.po.outcome ?? undefined, plannedStartDate: rec.po.plannedStartDate } : undefined
        })
      }),
    onSuccess: () => {
      toast.push("Student updated.", "success");
      qc.invalidateQueries({ queryKey: ["admin", "student", picked?.id] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["admin", "upcoming-starts"] });
      qc.invalidateQueries({ queryKey: ["admin", "missing-data"] });
      qc.invalidateQueries({ queryKey: ["admin", "attention"] });
    },
    onError: (e) => toast.push(e instanceof Error ? e.message : "Failed to save", "error")
  });

  const breakMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "plan" | "return" }) =>
      adminFetch<{ id: string }>(`/api/admin/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify(
          action === "plan"
            ? { breakAction: "plan", holdStart: form?.holdStart ?? null, plannedReturn: form?.plannedReturn ?? null, breakCheckin: form?.breakCheckin ?? null, holdNotes: form?.holdNotes ?? null }
            : { breakAction: "return" }
        )
      }),
    onSuccess: (_d, v) => {
      toast.push(v.action === "plan" ? "Break planned — now cancel the recurring invoice in Invoice Ninja." : "Marked returned — now reactivate the invoice in Invoice Ninja.", "success");
      qc.invalidateQueries({ queryKey: ["admin", "student", picked?.id] });
      qc.invalidateQueries({ queryKey: ["admin", "breaks"] });
      qc.invalidateQueries({ queryKey: ["admin", "attention"] });
    },
    onError: (e) => toast.push(e instanceof Error ? e.message : "Failed", "error")
  });

  const set = <K extends keyof StudentRecord>(k: K, v: StudentRecord[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const setPo = <K extends keyof PO>(k: K, v: PO[K]) =>
    setForm((f) => (f && f.po ? { ...f, po: { ...f.po, [k]: v } } : f));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <UserCog className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Student manager</p>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">Find any student and update their record — lifecycle, grade, subjects, dates, schedule, and their latest PO.</p>

      <Field label="Find a student">
        <StudentSelect value={picked} onChange={(s) => { setPicked(s); setForm(null); }} autoFocus />
      </Field>

      {picked && q.isPending && <Skeleton rows={6} />}
      {picked && q.isError && <p className="text-[13px] text-status-danger-fg">{(q.error as Error).message}</p>}

      {form && (
        <div className="card card-body mt-3 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-medium">{form.name}</p>
            <button onClick={() => setChecklistOpen(true)} className="btn text-[12px]" title="Open onboarding checklist">
              <ClipboardCheck className="w-3.5 h-3.5" /> Onboarding checklist
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Lifecycle stage">
              <Select value={form.lifecycle ?? ""} onChange={(e) => set("lifecycle", e.target.value || null)}>
                <option value="">—</option>
                {LIFECYCLE.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Grade">
              <Select value={form.grade ?? ""} onChange={(e) => set("grade", e.target.value || null)}>
                <option value="">—</option>
                {GRADES.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Subjects">
            <ChipGroup multi value={form.subjects} onChange={(v) => set("subjects", v)} options={["Math", "Reading"]} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Math level" hint="e.g. 7A, 2A, BII">
              <TextInput value={form.mathLevel ?? ""} onChange={(e) => set("mathLevel", e.target.value || null)} placeholder="—" />
            </Field>
            <Field label="Reading level" hint="e.g. 7A, AI, CII">
              <TextInput value={form.readingLevel ?? ""} onChange={(e) => set("readingLevel", e.target.value || null)} placeholder="—" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="School">
              <TextInput value={form.school ?? ""} onChange={(e) => set("school", e.target.value || null)} placeholder="—" />
            </Field>
            <Field label="Format">
              <Select value={form.paperConnect ?? ""} onChange={(e) => set("paperConnect", e.target.value || null)}>
                <option value="">—</option>
                {PAPER_CONNECT.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date of birth">
              <TextInput type="date" value={form.dob ?? ""} onChange={(e) => set("dob", e.target.value || null)} />
            </Field>
            <Field label="Enroll date">
              <TextInput type="date" value={form.enrollDate ?? ""} onChange={(e) => set("enrollDate", e.target.value || null)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First class date" hint="planned start">
              <TextInput type="date" value={form.firstClassDate ?? ""} onChange={(e) => set("firstClassDate", e.target.value || null)} />
            </Field>
            <Field label="First class attended" hint="set = Active">
              <TextInput type="date" value={form.firstClassAttended ?? ""} onChange={(e) => set("firstClassAttended", e.target.value || null)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="End date" hint="set when a student discontinues">
              <TextInput type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="eEnrollment">
              <ChipGroup value={form.eEnrollmentCompleted ? "Completed" : "Not done"} onChange={(v) => set("eEnrollmentCompleted", v === "Completed")} options={["Not done", "Completed"]} />
            </Field>
            <Field label="Work pickup day">
              <Select value={form.workPickupDay ?? ""} onChange={(e) => set("workPickupDay", e.target.value || null)}>
                <option value="">—</option>
                {PICKUP_DAYS.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Class schedule (days)">
            <ChipGroup multi value={form.schedule} onChange={(v) => set("schedule", v)} options={[...WEEKDAYS]} />
          </Field>

          {form.po && (
            <div className="border-t border-line pt-3">
              <p className="text-[13px] font-medium mb-2">Latest PO {form.po.poDate && <span className="text-ink-tertiary font-normal">· {form.po.poDate}</span>}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="PO status">
                  <Select value={form.po.status ?? ""} onChange={(e) => setPo("status", e.target.value || null)}>
                    <option value="">—</option>
                    {PO_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="PO outcome">
                  <Select value={form.po.outcome ?? ""} onChange={(e) => setPo("outcome", e.target.value || null)}>
                    <option value="">—</option>
                    {PO_OUTCOME.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="Planned start">
                  <TextInput type="date" value={form.po.plannedStartDate ?? ""} onChange={(e) => setPo("plannedStartDate", e.target.value || null)} />
                </Field>
              </div>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <p className="text-[13px] font-medium mb-2">Plan a break</p>
            {form.invoiceAction && form.invoiceAction !== "Done" && (
              <div className="mb-3 rounded-md bg-status-warning-bg text-status-warning-fg text-[12px] px-3 py-2">
                Invoice to-do: <b>{form.invoiceAction}</b> in Invoice Ninja, then mark it handled.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Hold start"><TextInput type="date" value={form.holdStart ?? ""} onChange={(e) => set("holdStart", e.target.value || null)} /></Field>
              <Field label="Planned return"><TextInput type="date" value={form.plannedReturn ?? ""} onChange={(e) => set("plannedReturn", e.target.value || null)} /></Field>
              <Field label="Check-in date" hint="when to reach out"><TextInput type="date" value={form.breakCheckin ?? ""} onChange={(e) => set("breakCheckin", e.target.value || null)} /></Field>
            </div>
            <Field label="Break notes">
              <TextInput value={form.holdNotes ?? ""} onChange={(e) => set("holdNotes", e.target.value || null)} placeholder="e.g. family travel in July" />
            </Field>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => form && breakMut.mutate({ id: form.id, action: "plan" })} disabled={breakMut.isPending || !form.plannedReturn} className="btn">Plan break →</button>
              {form.lifecycle === "Planned Break" && (
                <button onClick={() => form && breakMut.mutate({ id: form.id, action: "return" })} disabled={breakMut.isPending} className="btn btn-primary">Mark returned</button>
              )}
              {form.invoiceAction && form.invoiceAction !== "Done" && (
                <button onClick={() => { if (form) { const u = { ...form, invoiceAction: "Done" }; setForm(u); save.mutate(u); } }} className="btn text-[12px]">Invoice handled</button>
              )}
            </div>
            <p className="text-[11px] text-ink-tertiary mt-1">Set the dates, then <b>Plan break</b> → moves them to &ldquo;Planned Break&rdquo;, mutes overdue nudges until the return date, and flags you to cancel the recurring invoice. <b>Mark returned</b> sets them back to Active and flags you to reactivate it.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => form && save.mutate(form)} disabled={save.isPending} className="btn btn-primary">
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
          <p className="text-[11px] text-ink-tertiary">Changes write straight to the student record (and the PO, if edited). Lifecycle and First Class Date drive the dashboard, welcome, and nudge — so this is the place to fix anything that changed after a recap.</p>
        </div>
      )}

      <OnboardingChecklist
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        studentId={picked?.id ?? null}
        studentName={form?.name}
      />
    </div>
  );
}
