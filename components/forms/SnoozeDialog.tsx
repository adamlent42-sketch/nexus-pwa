"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { useSnoozeNote } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { addDays, todayInET } from "@/lib/time";
import type { InstructionNoteRow } from "@/types/kumon";

interface Props {
  open: boolean;
  onClose: () => void;
  note: InstructionNoteRow | null;
}

export function SnoozeDialog({ open, onClose, note }: Props) {
  const [until, setUntil] = useState(addDays(todayInET(), 7));
  const mutation = useSnoozeNote();
  const toast = useToast();

  useEffect(() => {
    if (open) setUntil(addDays(todayInET(), 7));
  }, [open]);

  const submit = async () => {
    if (!note) return;
    try {
      await mutation.mutateAsync({ id: note.id, snoozedUntil: until });
      toast.push(`Snoozed until ${until}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to snooze", "error");
    }
  };

  const quickSet = (days: number) => setUntil(addDays(todayInET(), days));

  if (!note) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Snooze note · ${note.studentName ?? "(student)"}`}
      icon={<Clock className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Snooze"}
          </button>
        </>
      }
    >
      <Field label="Until" required>
        <TextInput type="date" value={until} min={todayInET()} onChange={(e) => setUntil(e.target.value)} />
      </Field>
      <div className="flex gap-2 mt-2">
        <button type="button" className="btn" onClick={() => quickSet(1)}>1 day</button>
        <button type="button" className="btn" onClick={() => quickSet(3)}>3 days</button>
        <button type="button" className="btn" onClick={() => quickSet(7)}>1 week</button>
        <button type="button" className="btn" onClick={() => quickSet(14)}>2 weeks</button>
      </div>
      <p className="text-[11px] text-ink-tertiary mt-3">
        Hides this note from the dashboard until the date passes. Set status back to Active in Airtable to bring it back early.
      </p>
    </Modal>
  );
}
