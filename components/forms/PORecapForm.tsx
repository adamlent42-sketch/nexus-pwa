"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useSubmitPORecap } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { PORecapSubmit } from "@/lib/schemas";
import { PO_STATUSES, PO_OUTCOMES, WEEKDAYS } from "@/lib/options";
import type { PORow } from "@/types/kumon";

interface Props {
  open: boolean;
  onClose: () => void;
  po: PORow | null;
}

// "Plan to Enroll" is the single committed outcome — the kid only becomes
// Active-Engaged when they actually attend class one (the "Arrived" button).
// (Legacy "Enrolled" records still validate via the schema, but it's no longer
// a pickable recap outcome so a recap can never jump a kid straight to active.)
const ATTENDED_OUTCOMES = ["Plan to Enroll", "Undecided", "Not Interested"] as const;

export function PORecapForm({ open, onClose, po }: Props) {
  const [status, setStatus] = useState<string | null>("Attended");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [eEnroll, setEEnroll] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [classTime, setClassTime] = useState("");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [mathLevel, setMathLevel] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [leadSource, setLeadSource] = useState("");
  const [thirtyDayVision, setThirtyDayVision] = useState("");
  const [gpsPriorities, setGpsPriorities] = useState<string[]>([]);
  const [staffNotes, setStaffNotes] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useSubmitPORecap();
  const toast = useToast();

  // A recap already exists on this PO -> we're editing, so pre-fill its values.
  const isEdit = !!(po && po.recap);

  useEffect(() => {
    if (open && po) {
      const rc = po.recap;
      setStatus(po.status || "Attended");
      setSubjects(po.subjects ?? []);
      setLeadSource(rc?.leadSource ?? po.source ?? "");
      setOutcome(rc?.outcome ?? null);
      setEEnroll(rc?.eEnrollmentCompleted ?? false);
      setStartDate(rc?.plannedStartDate ?? "");
      setClassTime(rc?.plannedClassTime ?? "");
      setSchedule(rc?.plannedSchedule ?? []);
      setMathLevel(rc?.recommendedMathLevel ?? "");
      setReadingLevel(rc?.recommendedReadingLevel ?? "");
      setThirtyDayVision(rc?.thirtyDayVision ?? "");
      setGpsPriorities(rc?.gpsPriorities ?? []);
      setStaffNotes(rc?.staffNotes ?? "");
      setSubmittedBy("");
      setError(null);
    }
  }, [open, po]);

  if (!po) return null;

  const submit = async () => {
    setError(null);
    const payload = {
      poId: po.id,
      status: (status ?? "Attended") as typeof PO_STATUSES[number],
      outcome: status === "Attended" ? (outcome as typeof PO_OUTCOMES[number] | null) : null,
      eEnrollmentCompleted: status === "Attended" ? eEnroll : false,
      plannedStartDate: status === "Attended" && startDate ? startDate : null,
      plannedClassTime: status === "Attended" && classTime ? classTime : null,
      plannedSchedule: status === "Attended" && schedule.length ? schedule : undefined,
      recommendedMathLevel: status === "Attended" && mathLevel ? mathLevel : null,
      recommendedReadingLevel: status === "Attended" && readingLevel ? readingLevel : null,
      subjectInterest: subjects.length ? subjects : undefined,
      leadSource: leadSource || null,
      thirtyDayVision: thirtyDayVision.trim() || undefined,
      gpsPriorities: gpsPriorities.length ? gpsPriorities : undefined,
      staffNotes: staffNotes.trim(),
      submittedBy
    };
    if (status === "Attended" && !outcome) { setError("Outcome required when Attended"); return; }
    const parsed = PORecapSubmit.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      const result = await mutation.mutateAsync(parsed.data);
      const r = result as { autoFinalized?: boolean; lifecyclePushed?: string | null; studentsPushed?: number };
      if (isEdit) {
        toast.push("Recap updated.", "success");
      } else if (r.autoFinalized && r.lifecyclePushed) {
        toast.push(`Recap finalized - ${r.studentsPushed ?? 0} student moved to ${r.lifecyclePushed}. Outreach will follow up.`, "success");
      } else if (r.autoFinalized) {
        toast.push("Recap finalized.", "success");
      } else {
        toast.push("Recap submitted. Pending owner review.", "success");
      }
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to submit", "error");
    }
  };

  const nonAttendedMessage = (() => {
    if (!status || status === "Attended" || status === "Scheduled") return null;
    if (status === "Not Attended") {
      return "Family didn't show up — auto-moves to PO No-Show. No owner review needed. Outreach will offer to reschedule (3 follow-ups over 45 days).";
    }
    if (status === "Family Cancelled") {
      return "Family called ahead to cancel — auto-moves to PO Cancelled. No owner review needed. Outreach will send a gentle win-back sequence (4 touches over 30 days).";
    }
    if (status === "Instructor Cancelled") {
      return "We cancelled on them — linked student stays at PO Booked. We owe them a new PO; please create one.";
    }
    if (status === "Rescheduled") {
      return "Create a new PO record for the rescheduled date. This one will close out.";
    }
    return null;
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? "Edit PO recap" : "PO recap"} - ${po.student} ${po.time ? "(" + po.time + ")" : ""}`}
      icon={<CalendarClock className="w-4 h-4" />}
      tintClassName="bg-tint-pos-bg text-tint-pos-fg"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving..." : isEdit ? "Update recap" : "Submit recap"}
          </button>
        </>
      }
    >
      {isEdit && (
        <div className="bg-status-info-bg text-status-info-fg rounded p-2.5 mb-4 text-[12px]">
          Editing a recap that was already submitted - your changes overwrite the previous recap. Re-enter the optional fields you want to keep: a field left blank is NOT cleared, it just keeps its old value. To remove something, replace it with new text rather than emptying it.
        </div>
      )}

      <div className="bg-tint-notes-bg text-tint-notes-fg rounded p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
        <div><span className="font-medium">Student:</span> {po.student}</div>
        <div><span className="font-medium">Grade:</span> {po.grade ?? "-"}</div>
        <div><span className="font-medium">Phone:</span> {po.phone ?? "-"}</div>
        <div><span className="font-medium">Booking:</span> {po.source ?? "-"}</div>
      </div>

      <Field label="Status" required>
        <ChipGroup value={status} onChange={setStatus} options={PO_STATUSES} />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-ink-tertiary border-t border-line pt-2">
          <div><span className="font-medium text-ink-secondary">Attended</span> — family came in for the PO</div>
          <div><span className="font-medium text-ink-secondary">Not Attended</span> — family didn&apos;t show, no call ahead</div>
          <div><span className="font-medium text-ink-secondary">Family Cancelled</span> — family called ahead to cancel</div>
          <div><span className="font-medium text-ink-secondary">Instructor Cancelled</span> — we had to cancel on them</div>
          <div><span className="font-medium text-ink-secondary">Rescheduled</span> — new date agreed; create a new PO for that date</div>
        </div>
      </Field>

      {status === "Attended" && (
        <Field label="Outcome" required hint="required when Attended">
          <ChipGroup value={outcome} onChange={setOutcome} options={ATTENDED_OUTCOMES} />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-[11px] text-ink-tertiary border-t border-line pt-2">
            <div><span className="font-medium text-ink-secondary">Plan to Enroll</span> — wants to enroll; fill in start date below if you have one</div>
            <div><span className="font-medium text-ink-secondary">Undecided</span> — interested but not committing today; system will follow up gently</div>
            <div><span className="font-medium text-ink-secondary">Not Interested</span> — definite no; no further outreach will be sent</div>
          </div>
        </Field>
      )}

      {status === "Attended" && (
        <>
          <div className="bg-tint-alerts-bg text-tint-alerts-fg rounded p-2.5 mb-4">
            <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={eEnroll} onChange={(e) => setEEnroll(e.target.checked)} />
              <span className="font-medium">eEnrollment form completed</span>
              <span className="text-[12px] font-normal">- family submitted it during/after the PO</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Planned start date">
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Planned class time">
              <TextInput value={classTime} onChange={(e) => setClassTime(e.target.value)} placeholder="e.g. 4:30 PM" />
            </Field>
          </div>

          <Field label="Planned schedule">
            <ChipGroup multi value={schedule} onChange={setSchedule} options={WEEKDAYS} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Recommended math level">
              <TextInput value={mathLevel} onChange={(e) => setMathLevel(e.target.value)} placeholder="e.g. 2A" />
            </Field>
            <Field label="Recommended reading level">
              <TextInput value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} placeholder="e.g. 3A" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Subject interest" hint="pre-filled from booking">
              <ChipGroup multi value={subjects} onChange={setSubjects} options={["Math", "Reading"]} />
            </Field>
            <Field label="Lead source">
              <TextInput value={leadSource} onChange={(e) => setLeadSource(e.target.value)} />
            </Field>
          </div>
          <div className="border border-line rounded-md p-3 mt-1">
            <p className="text-[12px] font-medium text-ink-secondary mb-2">📍 30-Day Plan (Skills GPS)</p>
            <Field label="30-day vision" hint="what does success look like after 30 days? describe behaviors, not levels">
              <TextArea
                value={thirtyDayVision}
                onChange={(e) => setThirtyDayVision(e.target.value)}
                placeholder="e.g. Student starts work promptly without prompting, reads directions before beginning, maintains concentration for full worksheet time"
                rows={3}
              />
            </Field>
            <Field label="GPS priorities" hint="pick 2–3 to focus on in the first month">
              <ChipGroup
                multi
                value={gpsPriorities}
                onChange={setGpsPriorities}
                options={[
                  "Studies with concentration",
                  "Reads instructions first",
                  "Pencil keeps moving",
                  "Eyes on paper",
                  "Starts promptly",
                  "Writes neatly",
                  "Attempts independently",
                  "Completes within SCT",
                  "Positive attitude",
                  "Consistent attendance & HW",
                ]}
              />
            </Field>
          </div>
        </>
      )}

      {nonAttendedMessage && (
        <div className="bg-status-info-bg text-status-info-fg rounded p-3 mb-4 text-[13px]">
          <span className="font-medium">{status}:</span> {nonAttendedMessage}
        </div>
      )}

      <Field label="Staff notes" required hint={status === "Attended" ? "the narrative - what happened during the PO" : "what happened - context Adam will use for the re-engagement email"}>
        <TextArea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} />
      </Field>

      <Field label="Submitted by" required>
        <StaffNameSelect value={submittedBy} onChange={setSubmittedBy} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        No emails fire on submit. If Adam is the one recapping, it applies right away; otherwise it goes to Adam's review queue in Admin.
      </p>
    </Modal>
  );
}
