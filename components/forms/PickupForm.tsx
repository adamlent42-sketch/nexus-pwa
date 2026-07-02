"use client";

import { useState, useEffect } from "react";
import { Car } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useCreatePickupNotification } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { PickupNotificationCreate } from "@/lib/schemas";

interface Student { id: string; name: string; grade: string | null; status: string | null }

interface Props { open: boolean; onClose: () => void }

export function PickupForm({ open, onClose }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [submittedBy, setSubmittedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreatePickupNotification();
  const toast = useToast();

  useEffect(() => {
    if (!open) { setStudents([]); setSubmittedBy(""); setNotes(""); setError(null); }
  }, [open]);

  const submit = async () => {
    setError(null);
    const payload = {
      studentIds: students.map((s) => s.id),
      submittedBy,
      notes: notes.trim() || undefined
    };
    const parsed = PickupNotificationCreate.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("; ")); return; }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.push(`Pickup notice sent · ${students.length} student${students.length === 1 ? "" : "s"}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to send", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pickup notification"
      icon={<Car className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Sending…" : "Send notifications"}
          </button>
        </>
      }
    >
      <Field label="Students" required>
        <StudentSelect multi value={students} onChange={setStudents} autoFocus placeholder="Type to search students…" />
        <p className="text-[12px] text-tint-purple-sub mt-1.5">
          {students.length} student{students.length === 1 ? "" : "s"} · groups by family — one email per family
        </p>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Submitted by" required>
          <StaffNameSelect value={submittedBy} onChange={setSubmittedBy} />
        </Field>
        <Field label="Notes" hint="optional">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. by the side door" />
        </Field>
      </div>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Existing Airtable automation groups by family and sends one email per family via Gmail.
      </p>
    </Modal>
  );
}
