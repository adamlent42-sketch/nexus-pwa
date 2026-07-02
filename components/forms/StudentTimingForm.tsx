"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useToast } from "@/lib/toast";
import { WEEKDAYS } from "@/lib/options";

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string | null;
}

// Quick inline edit for a student's planned start date + class schedule.
// Planned Start Date lives on the linked PO; schedule lives on the Student.
// The /timing endpoint handles both in one call.
export function StudentTimingForm({ open, onClose, studentId, studentName }: Props) {
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["student-timing", studentId],
    enabled: !!studentId && open,
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/timing`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as { schedule: string[]; plannedStartDate: string | null; poId: string | null };
    },
    staleTime: 0
  });

  useEffect(() => {
    if (open && q.data) {
      setPlannedStartDate(q.data.plannedStartDate ?? "");
      setSchedule(q.data.schedule ?? []);
      setError(null);
    } else if (!open) {
      setPlannedStartDate("");
      setSchedule([]);
      setError(null);
    }
  }, [open, q.data]);

  const mutation = useMutation({
    mutationFn: async (body: { plannedStartDate?: string | null; schedule?: string[] }) => {
      const r = await fetch(`/api/students/${studentId}/timing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["student-timing"] });
    }
  });

  const submit = async () => {
    setError(null);
    if (!studentId) return;
    const body: { plannedStartDate?: string | null; schedule?: string[] } = {};
    if (plannedStartDate) body.plannedStartDate = plannedStartDate;
    body.schedule = schedule;
    try {
      await mutation.mutateAsync(body);
      toast.push(`Updated ${studentName ?? "student"}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to update", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={studentName ? `Update ${studentName}` : "Update student"}
      icon={<CalendarClock className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending || !studentId} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-ink-secondary mb-4">
        Fix the planned start date or set the class schedule. Start date lives on the linked PO; class days live on the Student.
      </p>

      <Field label="Planned start date" hint={q.isPending ? "loading…" : q.data?.poId ? "saves to the linked PO" : "no linked PO — can't update"}>
        <TextInput type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} disabled={!q.data?.poId} />
      </Field>

      <Field label="Class schedule" hint="days of week this student attends">
        <ChipGroup multi value={schedule} onChange={setSchedule} options={WEEKDAYS} />
      </Field>

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
    </Modal>
  );
}
