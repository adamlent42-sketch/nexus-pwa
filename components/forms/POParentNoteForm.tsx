"use client";

import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { useUpdatePONote } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import type { PORow } from "@/types/kumon";

interface Props {
  open: boolean;
  onClose: () => void;
  po: PORow | null;
}

export function POParentNoteForm({ open, onClose, po }: Props) {
  const [note, setNote] = useState("");
  const mutation = useUpdatePONote();
  const toast = useToast();

  useEffect(() => {
    if (open && po) {
      setNote(po.parentNotes ?? "");
    }
  }, [open, po]);

  const submit = async () => {
    if (!po) return;
    try {
      await mutation.mutateAsync({ poId: po.id, parentNotes: note.trim() });
      toast.push("Parent note saved.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save note", "error");
    }
  };

  if (!po) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Parent note · ${po.student}`}
      icon={<MessageSquare className="w-4 h-4" />}
      tintClassName="bg-tint-pos-bg text-tint-pos-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save note"}
          </button>
        </>
      }
    >
      <Field label="Note from parent" hint="Paste or type anything relevant for the PO — background, concerns, grades, etc.">
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Riley has been struggling with fractions since 3rd grade…"
          rows={6}
          autoFocus
        />
      </Field>
      <p className="text-[11px] text-ink-tertiary mt-2">
        Shows on the PO dashboard so staff can review before the appointment.
      </p>
    </Modal>
  );
}
