"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useToast } from "@/lib/toast";
import { NOTE_CATEGORIES } from "@/lib/options";
import type { InstructionNoteRow } from "@/types/kumon";

interface Props {
  open: boolean;
  onClose: () => void;
  note: InstructionNoteRow | null;
}

// Inline edit for an Active Instruction Note. Updates the note text + category
// without closing the note — staff can refine the language without flowing the
// note into Adam's review queue.
export function NoteEditForm({ open, onClose, note }: Props) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open && note) {
      setText(note.note ?? "");
      setCategory(note.category ?? null);
      setError(null);
    } else if (!open) {
      setText("");
      setCategory(null);
      setError(null);
    }
  }, [open, note]);

  const mutation = useMutation({
    mutationFn: async (body: { note?: string; category?: string }) => {
      const r = await fetch(`/api/instruction-notes/${note!.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instruction-notes"] })
  });

  const submit = async () => {
    setError(null);
    if (!note) return;
    if (!text.trim()) { setError("Note text is required"); return; }
    try {
      await mutation.mutateAsync({
        note: text.trim(),
        category: category ?? undefined
      });
      toast.push("Note updated.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to update", "error");
    }
  };

  if (!note) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit note — ${note.studentName ?? "(student)"}`}
      icon={<Pencil className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <p className="text-[12px] text-ink-secondary mb-4">
        Refine the note text without closing it. The note stays Active and keeps surfacing on the student's class days.
      </p>

      <Field label="Note" required>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} />
      </Field>

      <Field label="Category">
        <ChipGroup value={category} onChange={setCategory} options={NOTE_CATEGORIES} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
    </Modal>
  );
}
