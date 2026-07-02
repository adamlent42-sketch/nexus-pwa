"use client";

import { useState, useEffect } from "react";
import { CalendarOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StaffSelect } from "@/components/ui/StaffSelect";
import { useCreateTimeOff } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { TimeOffCreate } from "@/lib/schemas";
import { TIME_OFF_TYPES } from "@/lib/options";
import { todayInET } from "@/lib/time";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TimeOffForm({ open, onClose }: Props) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [type, setType] = useState<string | null>("Planned Absence");
  const [startDate, setStartDate] = useState(todayInET());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateTimeOff();
  const toast = useToast();

  useEffect(() => {
    if (!open) {
      setStaffId(null);
      setType("Planned Absence");
      setStartDate(todayInET());
      setEndDate("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    const payload = {
      staffId: staffId ?? "",
      type: (type ?? "Planned Absence") as "Planned Absence" | "Sick" | "Other",
      startDate,
      endDate: endDate || null,
      notes: notes.trim() || undefined
    };
    const parsed = TimeOffCreate.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.push("Time off request submitted. Pending approval.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to submit", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit time off"
      icon={<CalendarOff className="w-4 h-4" />}
      tintClassName="bg-tint-staff-bg text-tint-staff-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Staff" required>
          <StaffSelect value={staffId} onChange={setStaffId} />
        </Field>
        <Field label="Type" required>
          <ChipGroup value={type} onChange={setType} options={TIME_OFF_TYPES} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Start date" required>
          <TextInput type="date" value={startDate} min={todayInET()} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date" hint="blank = single day">
          <TextInput type="date" value={endDate} min={startDate || todayInET()} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Notes" hint="optional">
        <TextArea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context helps Adam approve faster — let us know what's up."
        />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Goes to Admin → Time off queue as Pending.
      </p>
    </Modal>
  );
}
