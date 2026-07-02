"use client";

import { useState, useEffect } from "react";
import { NotebookPen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useCreateInstructionNote } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { InstructionNoteCreate } from "@/lib/schemas";
import { NOTE_CATEGORIES } from "@/lib/options";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void }

export function InstructionNoteForm({ open, onClose }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateInstructionNote();
  const toast = useToast();

  useEffect(() => {
    if (!open) { setStudent(null); setNote(""); setCategory(null); setCreatedBy(""); setError(null); }
  }, [open]);

  const submit = async () => {
    setError(null);
    const payload = { studentId: student?.id ?? "", note: note.trim(), category: category ?? "", createdBy };
    const parsed = InstructionNoteCreate.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("; ")); return; }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.push("Instruction note saved.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save note", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add instruction note"
      icon={<NotebookPen className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save note"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Student" required>
          <StudentSelect value={student} onChange={setStudent} autoFocus />
        </Field>
        <Field label="Created by" required>
          <StaffNameSelect value={createdBy} onChange={setCreatedBy} />
        </Field>
      </div>
      <Field label="Note" required hint="internal-only — never parent-facing">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Field label="Category" required>
        <ChipGroup value={category} onChange={setCategory} options={NOTE_CATEGORIES} />
      </Field>
      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Surfaces on the dashboard on the student's scheduled class days.
      </p>
    </Modal>
  );
}
