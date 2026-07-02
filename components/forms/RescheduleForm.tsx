"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { useReschedulePO } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { todayInET } from "@/lib/time";
import { formatDate } from "@/lib/utils";
import type { PORow } from "@/types/kumon";

interface Props {
  open: boolean;
  onClose: () => void;
  po: PORow | null;
}

export function RescheduleForm({ open, onClose, po }: Props) {
  const [newDate, setNewDate] = useState(todayInET());
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useReschedulePO();
  const toast = useToast();

  // Prefill with the PO's current date/time each time the dialog opens.
  useEffect(() => {
    if (open && po) {
      setNewDate(po.date ?? todayInET());
      setNewTime(po.time ?? "");
      setReason("");
      setError(null);
    }
  }, [open, po]);

  const submit = async () => {
    if (!po) return;
    setError(null);
    if (!newDate) { setError("Pick a new date"); return; }
    if (!newTime.trim()) { setError("Enter a new time"); return; }
    try {
      await mutation.mutateAsync({
        poId: po.id,
        newDate,
        newTime: newTime.trim(),
        reason: reason.trim() || undefined
      });
      toast.push(`Rescheduled to ${formatDate(newDate, "short")} · ${newTime.trim()}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to reschedule", "error");
    }
  };

  if (!po) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reschedule PO · ${po.student}`}
      icon={<CalendarClock className="w-4 h-4" />}
      tintClassName="bg-tint-pos-bg text-tint-pos-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Rescheduling…" : "Reschedule"}
          </button>
        </>
      }
    >
      <div className="bg-surface-subtle rounded p-2.5 mb-4 text-[12px] text-ink-secondary">
        <span className="font-medium text-ink">Currently:</span>{" "}
        {po.date ? formatDate(po.date, "short") : "—"}{po.time ? ` · ${po.time}` : ""}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="New date" required>
          <TextInput type="date" value={newDate} min={todayInET()} onChange={(e) => setNewDate(e.target.value)} />
        </Field>
        <Field label="New time" required hint="e.g. 5:00 PM">
          <TextInput value={newTime} onChange={(e) => setNewTime(e.target.value)} placeholder="5:00 PM" />
        </Field>
      </div>

      <Field label="Reason" hint="optional — added to the original PO's notes">
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family conflict, moved to Thursday" rows={2} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Keeps the original PO on record marked “Rescheduled” and creates a new PO at the new date/time, linked to the same family and student(s).
      </p>
    </Modal>
  );
}
