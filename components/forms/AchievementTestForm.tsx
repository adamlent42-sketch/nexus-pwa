"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useCreateAchievementTest } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { AchievementTestCreate } from "@/lib/schemas";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void }

export function AchievementTestForm({ open, onClose }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [subject, setSubject] = useState<string | null>("Math");
  const [level, setLevel] = useState("");
  const [score, setScore] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAchievementTest();
  const toast = useToast();

  useEffect(() => {
    if (!open) {
      setStudent(null); setSubject("Math"); setLevel(""); setScore(""); setTime("");
      setNotes(""); setSubmittedBy(""); setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    const payload = {
      studentId: student?.id ?? "",
      subject: (subject ?? "Math") as "Math" | "Reading",
      level: level.trim(),
      score: parseInt(score, 10),
      timeMinutes: parseInt(time, 10),
      notes: notes.trim() || undefined,
      submittedBy
    };
    if (Number.isNaN(payload.score) || Number.isNaN(payload.timeMinutes)) {
      setError("Score and time must be numbers"); return;
    }
    const parsed = AchievementTestCreate.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("; ")); return; }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.push("Achievement test saved. Email will be drafted on next pass.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Achievement test"
      icon={<Trophy className="w-4 h-4" />}
      tintClassName="bg-tint-pos-bg text-tint-pos-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save result"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Student" required>
          <StudentSelect value={student} onChange={setStudent} autoFocus />
        </Field>
        <Field label="Submitted by" required>
          <StaffNameSelect value={submittedBy} onChange={setSubmittedBy} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Subject" required>
          <ChipGroup value={subject} onChange={setSubject} options={["Math", "Reading"]} />
        </Field>
        <Field label="Level" required hint="e.g. D, 2A, F-II">
          <TextInput value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. D" />
        </Field>
      </div>

      <div className="bg-tint-pos-bg text-tint-pos-fg text-[12px] rounded p-2 mb-4">
        Goal time and Out-of will be pulled from Test Goal Times when you save.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Score" required>
          <TextInput type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 195" />
        </Field>
        <Field label="Time (min)" required>
          <TextInput type="number" value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 7" />
        </Field>
      </div>

      <Field label="Notes" hint="optional · folded into the parent email">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything notable about how the test went." />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Daily draft task pulls the level summary + Goal Time and drafts the Gmail email.
      </p>
    </Modal>
  );
}
