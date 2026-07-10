"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useToast } from "@/lib/toast";
import { WEEKDAYS, PICKUP_DAYS, SUBJECTS, GRADES, PAPER_CONNECT, LIFECYCLE_STAGES } from "@/lib/options";
import { todayInET } from "@/lib/time";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void; presetStudent?: Student | null }

interface PO { id: string; poDate: string | null; status: string | null; outcome: string | null; plannedStartDate: string | null }
interface FormState {
  subjects: string[];
  mathLevel: string;
  readingLevel: string;
  grade: string | null;
  school: string;
  paperConnect: string | null;
  dob: string;
  enrollDate: string;
  firstClassDate: string;
  firstClassAttended: string;
  endDate: string;
  lifecycleStage: string | null;
  eEnrollmentCompleted: boolean;
  schedule: string[];
  workPickupDay: string | null;
  holdStart: string;
  plannedReturn: string;
  breakCheckin: string;
  holdNotes: string;
  invoiceAction: string | null;
  po: PO | null;
}

const PO_STATUS = ["Scheduled", "Rescheduled", "Attended", "Not Attended", "Family Cancelled", "Instructor Cancelled"];
const PO_OUTCOME = ["Plan to Enroll", "Enrolled", "Undecided", "Not Interested"];

export function StudentUpdateForm({ open, onClose, presetStudent }: Props) {
  const [student, setStudent] = useState<Student | null>(presetStudent ?? null);
  const [form, setForm] = useState<FormState | null>(null);
  const [submittedBy, setSubmittedBy] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["student-profile-edit", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const r = await fetch(`/api/students/${student!.id}/profile`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as FormState & { po: PO | null };
    },
    staleTime: 0
  });

  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      setForm({
        subjects: p.subjects ?? [],
        mathLevel: p.mathLevel ?? "",
        readingLevel: p.readingLevel ?? "",
        grade: p.grade ?? null,
        school: p.school ?? "",
        paperConnect: p.paperConnect ?? null,
        dob: p.dob ?? "",
        enrollDate: p.enrollDate ?? "",
        firstClassDate: p.firstClassDate ?? "",
        firstClassAttended: p.firstClassAttended ?? "",
        endDate: p.endDate ?? "",
        lifecycleStage: p.lifecycleStage ?? null,
        eEnrollmentCompleted: p.eEnrollmentCompleted ?? false,
        schedule: p.schedule ?? [],
        workPickupDay: p.workPickupDay ?? null,
        holdStart: p.holdStart ?? "",
        plannedReturn: p.plannedReturn ?? "",
        breakCheckin: p.breakCheckin ?? "",
        holdNotes: p.holdNotes ?? "",
        invoiceAction: p.invoiceAction ?? null,
        po: p.po ?? null
      });
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (open) {
      setStudent(presetStudent ?? null);
    } else {
      setStudent(null);
      setForm(null);
      setSubmittedBy("");
      setReason("");
      setError(null);
    }
  }, [open, presetStudent]);

  const saveMutation = useMutation({
    mutationFn: async ({ body, type }: { body: Record<string, unknown>; type: string }) => {
      // 1. Save student record
      const r = await fetch(`/api/students/${student!.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);

      // 2. Log change request for audit trail
      const cr = await fetch(`/api/student-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student!.id,
          studentName: student!.name,
          type,
          effectiveDate: todayInET(),
          reason: reason.trim() || undefined,
          submittedBy,
          ksisCompletedByStaff: false
        })
      });
      const crJson = await cr.json();
      if (!crJson.ok) throw new Error(crJson.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile-edit"] });
      qc.invalidateQueries({ queryKey: ["students-search"] });
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-outreach"] });
      qc.invalidateQueries({ queryKey: ["admin", "change-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "attention"] });
      qc.invalidateQueries({ queryKey: ["admin", "breaks"] });
    }
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const setPo = <K extends keyof PO>(k: K, v: PO[K]) =>
    setForm((f) => (f && f.po ? { ...f, po: { ...f.po, [k]: v } } : f));

  const validate = (): boolean => {
    if (!student) { setError("Pick a student"); return false; }
    if (!submittedBy) { setError("Pick who's submitting"); return false; }
    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validate() || !form) return;
    try {
      await saveMutation.mutateAsync({
        body: {
          subjects: form.subjects,
          mathLevel: form.mathLevel.trim() || null,
          readingLevel: form.readingLevel.trim() || null,
          grade: form.grade,
          school: form.school.trim() || null,
          paperConnect: form.paperConnect,
          dob: form.dob || null,
          enrollDate: form.enrollDate || null,
          firstClassDate: form.firstClassDate || null,
          firstClassAttended: form.firstClassAttended || null,
          endDate: form.endDate || null,
          lifecycleStage: form.lifecycleStage,
          eEnrollmentCompleted: form.eEnrollmentCompleted,
          schedule: form.schedule,
          workPickupDay: form.workPickupDay,
          holdStart: form.holdStart || null,
          plannedReturn: form.plannedReturn || null,
          breakCheckin: form.breakCheckin || null,
          holdNotes: form.holdNotes || null,
          invoiceAction: form.invoiceAction,
          ...(form.po ? {
            po: {
              id: form.po.id,
              status: form.po.status ?? undefined,
              outcome: form.po.outcome ?? undefined,
              plannedStartDate: form.po.plannedStartDate || null
            }
          } : {})
        },
        type: "Edit Details"
      });
      toast.push(`${student!.name}'s record updated.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  const handleBreakAction = async (action: "plan" | "return") => {
    if (!validate() || !form) return;
    if (action === "plan" && !form.plannedReturn) {
      setError("Planned return date is required to plan a break");
      return;
    }
    try {
      await saveMutation.mutateAsync({
        body: {
          breakAction: action,
          holdStart: form.holdStart || null,
          plannedReturn: form.plannedReturn || null,
          breakCheckin: form.breakCheckin || null,
          holdNotes: form.holdNotes || null
        },
        type: action === "plan" ? "Pause / Break" : "Restart Enrollment"
      });
      toast.push(
        action === "plan"
          ? "Break planned — Adam will cancel the recurring invoice."
          : "Marked returned — Adam will reactivate the invoice.",
        "success"
      );
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const pending = saveMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update student"
      icon={<UserCog className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={handleSave} disabled={pending || !student || !form} className="btn btn-primary">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <Field label="Student" required>
        <StudentSelect
          value={student}
          onChange={(s) => { setStudent(s); setForm(null); }}
          autoFocus={!presetStudent}
        />
      </Field>

      {student && profileQuery.isPending && (
        <p className="text-[12px] text-ink-tertiary mb-4">Loading current record…</p>
      )}
      {student && profileQuery.isError && (
        <p className="text-[12px] text-status-danger-fg mb-4">{(profileQuery.error as Error).message}</p>
      )}

      {form && (
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Lifecycle stage">
              <Select value={form.lifecycleStage ?? ""} onChange={(e) => set("lifecycleStage", e.target.value || null)}>
                <option value="">—</option>
                {LIFECYCLE_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
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
            <ChipGroup multi value={form.subjects} onChange={(v) => set("subjects", v)} options={SUBJECTS} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Math level" hint="e.g. 7A, 2A, BII">
              <TextInput value={form.mathLevel} onChange={(e) => set("mathLevel", e.target.value)} placeholder="—" />
            </Field>
            <Field label="Reading level" hint="e.g. 7A, AI, CII">
              <TextInput value={form.readingLevel} onChange={(e) => set("readingLevel", e.target.value)} placeholder="—" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="School">
              <TextInput value={form.school} onChange={(e) => set("school", e.target.value)} placeholder="—" />
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
              <TextInput type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
            </Field>
            <Field label="Enroll date">
              <TextInput type="date" value={form.enrollDate} onChange={(e) => set("enrollDate", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First class date" hint="planned start">
              <TextInput type="date" value={form.firstClassDate} onChange={(e) => set("firstClassDate", e.target.value)} />
            </Field>
            <Field label="First class attended" hint="set = Active">
              <TextInput type="date" value={form.firstClassAttended} onChange={(e) => set("firstClassAttended", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="End date" hint="set when a student discontinues">
              <TextInput type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="eEnrollment">
              <ChipGroup
                value={form.eEnrollmentCompleted ? "Completed" : "Not done"}
                onChange={(v) => set("eEnrollmentCompleted", v === "Completed")}
                options={["Not done", "Completed"]}
              />
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
              <p className="text-[13px] font-medium mb-2">
                Latest PO{form.po.poDate && <span className="text-ink-tertiary font-normal"> · {form.po.poDate}</span>}
              </p>
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
                  <TextInput
                    type="date"
                    value={form.po.plannedStartDate ?? ""}
                    onChange={(e) => setPo("plannedStartDate", e.target.value || null)}
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <p className="text-[13px] font-medium mb-2">Plan a break</p>
            {form.invoiceAction && form.invoiceAction !== "Done" && (
              <div className="mb-3 rounded-md bg-status-warning-bg text-status-warning-fg text-[12px] px-3 py-2">
                Invoice to-do: <b>{form.invoiceAction}</b> — Adam will handle this in Invoice Ninja.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Hold start">
                <TextInput type="date" value={form.holdStart} onChange={(e) => set("holdStart", e.target.value)} />
              </Field>
              <Field label="Planned return">
                <TextInput type="date" value={form.plannedReturn} onChange={(e) => set("plannedReturn", e.target.value)} />
              </Field>
              <Field label="Check-in date" hint="when to reach out">
                <TextInput type="date" value={form.breakCheckin} onChange={(e) => set("breakCheckin", e.target.value)} />
              </Field>
            </div>
            <Field label="Break notes">
              <TextInput
                value={form.holdNotes}
                onChange={(e) => set("holdNotes", e.target.value)}
                placeholder="e.g. family travel in July"
              />
            </Field>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleBreakAction("plan")}
                disabled={pending || !form.plannedReturn}
                className="btn"
              >
                Plan break →
              </button>
              {form.lifecycleStage === "Planned Break" && (
                <button
                  type="button"
                  onClick={() => handleBreakAction("return")}
                  disabled={pending}
                  className="btn btn-primary"
                >
                  Mark returned
                </button>
              )}
            </div>
            <p className="text-[11px] text-ink-tertiary mt-1">
              Set the dates, then <b>Plan break</b> → moves them to &ldquo;Planned Break&rdquo; and flags Adam to cancel the recurring invoice.{" "}
              <b>Mark returned</b> sets them back to Active and flags Adam to reactivate it.
            </p>
          </div>

          <div className="border-t border-line pt-3 space-y-3">
            <Field label="Reason / notes" hint="optional — what changed and why">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field label="Submitted by" required>
              <StaffNameSelect value={submittedBy} onChange={setSubmittedBy} />
            </Field>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-status-danger-fg mt-2 mb-1">{error}</p>}
    </Modal>
  );
}
