"use client";

import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StaffSelect } from "@/components/ui/StaffSelect";
import { useAddStaffToday } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { STAFF_ROLES } from "@/lib/options";

interface Props {
  open: boolean;
  onClose: () => void;
  /** ISO date the staff member is being added to. Defaults to today on the server. */
  date?: string;
}

export function AddStaffTodayForm({ open, onClose, date }: Props) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [role, setRole] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useAddStaffToday();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setStaffId(null);
      setRole([]);
      setStartTime("");
      setEndTime("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!staffId) { setError("Pick a staff member"); return; }
    if (role.length === 0) { setError("Pick at least one role"); return; }
    try {
      await mutation.mutateAsync({
        staffId,
        role,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        ...(date ? { date } : {})
      });
      toast.push("Added to today's class.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to add staff", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff for today's class"
      icon={<UserPlus className="w-4 h-4" />}
      tintClassName="bg-tint-staff-bg text-tint-staff-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Adding…" : "Add for today"}
          </button>
        </>
      }
    >
      <Field label="Staff member" required>
        <StaffSelect value={staffId} onChange={setStaffId} required />
      </Field>

      <Field label="Role" required>
        <ChipGroup multi value={role} onChange={setRole} options={[...STAFF_ROLES]} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Start time" hint="optional, e.g. 4:00 PM">
          <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="4:00 PM" />
        </Field>
        <Field label="End time" hint="optional, e.g. 6:30 PM">
          <TextInput value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="6:30 PM" />
        </Field>
      </div>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Adds this person to today only — it does not create a recurring weekly shift, and it won’t appear on any other day.
      </p>
    </Modal>
  );
}
