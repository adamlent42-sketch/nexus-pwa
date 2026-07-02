"use client";

import { useState, useEffect } from "react";
import { NotebookPen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useCloseNote } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import type { InstructionNoteRow } from "@/types/kumon";
import { formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  note: InstructionNoteRow | null;
}

export function NoteUpdateForm({ open, onClose, note }: Props) {
  const [closingNote, setClosingNote] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCloseNote();
  const toast = useToast();

  useEffect(() => {
    if (!open) { setClosingNote(""); setCompletedBy(""); setError(null); }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!note) return;
    if (!closingNote.trim()) { setError("Closing note required"); return; }
    if (!completedBy) { setError("Pick who closed this note"); return; }
    try {
      await mutation.mutateAsync({ id: note.id, closingNote: closingNote.trim(), completedBy });
      toast.push("Note closed. Pending owner review.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to close note", "error");
    }
  };

  if (!note) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update note · ${note.studentName ?? "(student)"}`}
      icon={<NotebookPen className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Closing…" : "Close note"}
          </button>
        </>
      }
    >
      <Field label="Original note" hint="internal · since">
        <div className="text-[14px] bg-surface-muted p-3 rounded leading-snug">
          {note.note}
          <p className="text-[11px] text-ink-tertiary mt-2">
            {note.createdBy && <span>by {note.createdBy} · </span>}
            {note.dateNoted && <span>{formatDate(note.dateNoted, "short")}</span>}
          </p>
        </div>
      </Field>

      <Field label="Closing note" required hint="what was worked on + the outcome — Adam edits the parent-facing version">
        <TextArea
          value={closingNote}
          onChange={(e) => setClosingNote(e.target.value)}
          placeholder="e.g. Jacob hit 7:45 on his last 3 D-level sets. Moved up to E on 5/28."
        />
      </Field>

      <Field label="Closed by" required>
        <StaffNameSelect value={completedBy} onChange={setCompletedBy} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        On close: Status → Complete, Owner Review Status → Pending Review. Drops off the dashboard.
      </p>
    </Modal>
  );
}
