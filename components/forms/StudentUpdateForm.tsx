"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useToast } from "@/lib/toast";
import { WEEKDAYS, PICKUP_DAYS, SUBJECTS, GRADES, PAPER_CONNECT, LIFECYCLE_STAGES } from "@/lib/options";
import { todayInET } from "@/lib/time";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void; presetStudent?: Student | null }

interface DetailsState {
  subjects: string[];
  mathLevel: string;
  readingLevel: string;
  grade: string | null;
  school: string;
  paperConnect: string | null;
  dob: string;
  enrollDate: string;
  firstClassDate: string;
  endDate: string;
  lifecycleStage: string | null;
}

const KINDS = [
  "Edit details",
  "Schedule",
  "Pickup Day",
  "Pause / Break",
  "Stop Enrollment",
  "Restart Enrollment",
  "Other"
] as const;
type ChangeKind = typeof KINDS[number];

const HELP: Record<ChangeKind, string> = {
  "Edit details": "Directly edit this student's record — subjects, levels, grade, school, key dates (incl. End Date), and lifecycle. Saves immediately.",
  "Schedule": "Days of week this student attends. Applies right away. KSIS also needs to be updated.",
  "Pickup Day": "Day this student picks up their week's work. Applies right away — KSIS needs syncing too.",
  "Pause / Break": "Family is taking a temp break. Set the dates below so Adam can close the invoice and the return reminder fires automatically.",
  "Stop Enrollment": "Family is discontinuing. Student moves to Recently Discontinued immediately. Adam closes KSIS and sends the final invoice.",
  "Restart Enrollment": "Family is starting back up. Student moves to Active-Engaged immediately. Adam reopens KSIS and resumes billing.",
  "Other": "Anything else worth flagging — describe it below. Logs a request for Adam to review."
};

// Maps chip label → the change request type stored in Airtable.
const REQUEST_TYPE: Record<ChangeKind, string> = {
  "Edit details":       "Edit Details",
  "Schedule":           "Schedule Change",
  "Pickup Day":         "Pickup Day Change",
  "Pause / Break":      "Pause / Break",
  "Stop Enrollment":    "Stop Enrollment",
  "Restart Enrollment": "Restart Enrollment",
  "Other":              "Other"
};

const needsEffectiveDateFor = new Set<ChangeKind>(["Pause / Break", "Stop Enrollment", "Restart Enrollment"]);

export function StudentUpdateForm({ open, onClose, presetStudent }: Props) {
  const [student, setStudent] = useState<Student | null>(presetStudent ?? null);
  const [kind, setKind] = useState<ChangeKind | null>(null);
  const [schedule, setSchedule] = useState<string[]>([]);
  const [pickupDay, setPickupDay] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string>(todayInET());
  const [reason, setReason] = useState("");
  const [ksisDone, setKsisDone] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");
  const [details, setDetails] = useState<DetailsState | null>(null);
  // Break-specific dates
  const [breakStart, setBreakStart] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const qc = useQueryClient();

  const current = useQuery({
    queryKey: ["student-schedule", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const r = await fetch(`/api/students/${student!.id}/schedule`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as { schedule: string[]; workPickupDay: string | null };
    },
    staleTime: 0
  });

  useEffect(() => {
    if (current.data) {
      setSchedule(current.data.schedule);
      setPickupDay(current.data.workPickupDay);
    }
  }, [current.data]);

  const profileQuery = useQuery({
    queryKey: ["student-profile-edit", student?.id],
    enabled: !!student && kind === "Edit details",
    queryFn: async () => {
      const r = await fetch(`/api/students/${student!.id}/profile`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as {
        subjects?: string[]; mathLevel?: string | null; readingLevel?: string | null;
        grade?: string | null; school?: string | null; paperConnect?: string | null;
        dob?: string | null; enrollDate?: string | null; firstClassDate?: string | null;
        endDate?: string | null; lifecycleStage?: string | null;
      };
    },
    staleTime: 0
  });

  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      setDetails({
        subjects: p.subjects ?? [],
        mathLevel: p.mathLevel ?? "",
        readingLevel: p.readingLevel ?? "",
        grade: p.grade ?? null,
        school: p.school ?? "",
        paperConnect: p.paperConnect ?? null,
        dob: p.dob ?? "",
        enrollDate: p.enrollDate ?? "",
        firstClassDate: p.firstClassDate ?? "",
        endDate: p.endDate ?? "",
        lifecycleStage: p.lifecycleStage ?? null
      });
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (open) {
      setStudent(presetStudent ?? null);
    } else {
      setStudent(null);
      setKind(null);
      setSchedule([]);
      setPickupDay(null);
      setEffectiveDate(todayInET());
      setReason("");
      setKsisDone(false);
      setSubmittedBy("");
      setDetails(null);
      setBreakStart("");
      setExpectedReturn("");
      setFollowUpDate("");
      setError(null);
    }
  }, [open, presetStudent]);

  useEffect(() => {
    setKsisDone(false);
    setDetails(null);
    setBreakStart("");
    setExpectedReturn("");
    setFollowUpDate("");
  }, [kind]);

  const profileMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/students/${student!.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instruction-notes"] });
      qc.invalidateQueries({ queryKey: ["students-search"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-outreach"] });
      qc.invalidateQueries({ queryKey: ["admin", "outreach"] });
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
      qc.invalidateQueries({ queryKey: ["student-profile-edit"] });
    }
  });

  const requestMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/student-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "change-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-outreach"] });
    }
  });

  const showKsisCheckbox = kind === "Pickup Day";
  const needsEffectiveDate = kind ? needsEffectiveDateFor.has(kind) : false;

  const submit = async () => {
    setError(null);
    if (!student) { setError("Pick a student"); return; }
    if (!kind) { setError("Pick what's changing"); return; }
    if (!submittedBy) { setError("Pick who's submitting"); return; }
    if (kind === "Other" && !reason.trim()) { setError("Describe what's changing"); return; }
    if (needsEffectiveDate && !effectiveDate) { setError("Effective date is required"); return; }
    if (kind === "Pause / Break" && !expectedReturn) { setError("Expected return date is required"); return; }

    try {
      // 1. Apply Student record changes for direct-edit kinds.
      if (kind === "Edit details") {
        if (!details) { setError("Still loading the record…"); return; }
        await profileMutation.mutateAsync({
          subjects: details.subjects,
          mathLevel: details.mathLevel.trim() || null,
          readingLevel: details.readingLevel.trim() || null,
          grade: details.grade,
          school: details.school.trim() || null,
          paperConnect: details.paperConnect,
          dob: details.dob || null,
          enrollDate: details.enrollDate || null,
          firstClassDate: details.firstClassDate || null,
          endDate: details.endDate || null,
          lifecycleStage: details.lifecycleStage
        });
      } else if (kind === "Schedule") {
        await profileMutation.mutateAsync({ schedule });
      } else if (kind === "Pickup Day") {
        await profileMutation.mutateAsync({ workPickupDay: pickupDay });
      }

      // 2. Log a change request for EVERY kind — builds the admin audit trail.
      await requestMutation.mutateAsync({
        studentId: student.id,
        studentName: student.name,
        type: REQUEST_TYPE[kind],
        effectiveDate: needsEffectiveDate ? effectiveDate : todayInET(),
        reason: reason.trim() || undefined,
        submittedBy,
        ksisCompletedByStaff: showKsisCheckbox ? ksisDone : false,
        ...(kind === "Pause / Break" ? { breakStart: breakStart || undefined, expectedReturn, followUpDate: followUpDate || undefined } : {})
      });

      // 3. Toast.
      const toastMessages: Record<ChangeKind, string> = {
        "Edit details":       `${student.name}'s record updated.`,
        "Schedule":           `${student.name}'s schedule updated.`,
        "Pickup Day":         ksisDone ? `${student.name}'s pickup day updated. KSIS marked done.` : `${student.name}'s pickup day updated. Logged for KSIS sync.`,
        "Pause / Break":      `${student.name} break logged. Adam will handle the invoice.`,
        "Stop Enrollment":    `Stop Enrollment request logged.`,
        "Restart Enrollment": `Restart Enrollment request logged.`,
        "Other":              "Request logged for Adam to review."
      };
      toast.push(toastMessages[kind], "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to submit", "error");
    }
  };

  const pending = profileMutation.isPending || requestMutation.isPending;

  const submitLabel = pending ? "Saving…"
    : kind === "Edit details" ? "Save changes"
    : kind === "Schedule" || kind === "Pickup Day" ? "Apply change"
    : "Submit";

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
          <button onClick={submit} disabled={pending || !student || !kind} className="btn btn-primary">
            {submitLabel}
          </button>
        </>
      }
    >
      <Field label="Student" required>
        <StudentSelect value={student} onChange={setStudent} autoFocus={!presetStudent} />
      </Field>

      {student && (
        <Field label="What's changing?" required>
          <ChipGroup
            value={kind}
            onChange={(v) => setKind(v as ChangeKind | null)}
            options={KINDS}
          />
        </Field>
      )}

      {kind && (
        <div className="bg-tint-notes-bg text-tint-notes-fg rounded p-2.5 mb-4 text-[12px]">
          {HELP[kind]}
        </div>
      )}

      {/* Edit details fields */}
      {kind === "Edit details" && student && (
        (profileQuery.isPending || !details) ? (
          <p className="text-[12px] text-ink-tertiary mb-4">Loading current record…</p>
        ) : (
          <div className="space-y-3 mb-2">
            <Field label="Subjects">
              <ChipGroup multi value={details.subjects} onChange={(v) => setDetails({ ...details, subjects: v })} options={SUBJECTS} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Math level">
                <TextInput value={details.mathLevel} onChange={(e) => setDetails({ ...details, mathLevel: e.target.value })} placeholder="e.g. D" />
              </Field>
              <Field label="Reading level">
                <TextInput value={details.readingLevel} onChange={(e) => setDetails({ ...details, readingLevel: e.target.value })} placeholder="e.g. CII" />
              </Field>
            </div>
            <Field label="Grade">
              <ChipGroup value={details.grade} onChange={(v) => setDetails({ ...details, grade: v })} options={GRADES} />
            </Field>
            <Field label="School">
              <TextInput value={details.school} onChange={(e) => setDetails({ ...details, school: e.target.value })} />
            </Field>
            <Field label="Format">
              <ChipGroup value={details.paperConnect} onChange={(v) => setDetails({ ...details, paperConnect: v })} options={PAPER_CONNECT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="DOB">
                <TextInput type="date" value={details.dob} onChange={(e) => setDetails({ ...details, dob: e.target.value })} />
              </Field>
              <Field label="Enroll date">
                <TextInput type="date" value={details.enrollDate} onChange={(e) => setDetails({ ...details, enrollDate: e.target.value })} />
              </Field>
              <Field label="First class date">
                <TextInput type="date" value={details.firstClassDate} onChange={(e) => setDetails({ ...details, firstClassDate: e.target.value })} />
              </Field>
              <Field label="End date" hint="set this when a student discontinues">
                <TextInput type="date" value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Lifecycle stage" hint="direct override — skips the KSIS/billing follow-ups that Stop/Restart fire">
              <ChipGroup value={details.lifecycleStage} onChange={(v) => setDetails({ ...details, lifecycleStage: v })} options={LIFECYCLE_STAGES} />
            </Field>
          </div>
        )
      )}

      {/* Schedule fields */}
      {kind === "Schedule" && student && (
        <>
          <Field label="Days of week" hint={current.isPending ? "loading current schedule…" : "pick all days this student attends"}>
            <ChipGroup multi value={schedule} onChange={setSchedule} options={WEEKDAYS} />
          </Field>
          <p className="text-[11px] text-ink-tertiary mb-4">
            ⓘ If their pickup day also changed, run the form again with <span className="font-medium">Pickup Day</span> selected — that one needs KSIS sync.
          </p>
        </>
      )}

      {/* Pickup day fields */}
      {kind === "Pickup Day" && student && (
        <Field label="Pickup day" hint={current.isPending ? "loading…" : "which day they pick up their work"}>
          <ChipGroup value={pickupDay} onChange={setPickupDay} options={PICKUP_DAYS} />
        </Field>
      )}

      {/* Pause / Break expanded fields */}
      {kind === "Pause / Break" && (
        <div className="space-y-3 mb-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Break start date" hint="when the break begins">
              <TextInput type="date" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
            </Field>
            <Field label="Expected return date" hint="required — triggers the return reminder" required>
              <TextInput type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
            </Field>
          </div>
          <Field label="Follow-up date" hint="when to reach out — typically ~2 weeks before return">
            <TextInput type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </Field>
        </div>
      )}

      {/* Effective date for transitions */}
      {needsEffectiveDate && (
        <Field label="Effective date" required>
          <TextInput type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </Field>
      )}

      {/* Reason / notes — shown for all kinds */}
      {kind && (
        <Field
          label={kind === "Other" ? "Describe what's changing" : "Reason / notes"}
          required={kind === "Other"}
          hint={
            kind === "Other" ? "be specific — Adam will read this"
            : kind === "Edit details" ? "optional — what changed and why"
            : "optional — anything Adam should know"
          }
        >
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}

      {/* KSIS checkbox for pickup day */}
      {showKsisCheckbox && (
        <div className="bg-tint-alerts-bg text-tint-alerts-fg rounded p-2.5 mb-4">
          <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={ksisDone} onChange={(e) => setKsisDone(e.target.checked)} />
            <span className="font-medium">I already updated KSIS for this</span>
            <span className="text-[12px] font-normal">— Adam won't see this as pending KSIS work</span>
          </label>
        </div>
      )}

      {/* Submitted by — required for ALL changes */}
      {kind && (
        <Field label="Submitted by" required>
          <StaffNameSelect value={submittedBy} onChange={setSubmittedBy} />
        </Field>
      )}

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
    </Modal>
  );
}
