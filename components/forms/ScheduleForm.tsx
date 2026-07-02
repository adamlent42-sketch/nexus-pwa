"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { useToast } from "@/lib/toast";
import { WEEKDAYS } from "@/lib/options";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void }

export function ScheduleForm({ open, onClose }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  // When a student is picked, fetch their current schedule to prefill
  const current = useQuery({
    queryKey: ["student-schedule", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const r = await fetch(`/api/students/${student!.id}/schedule`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as { schedule: string[] };
    },
    staleTime: 0
  });

  useEffect(() => {
    if (current.data) setDays(current.data.schedule);
  }, [current.data]);

  useEffect(() => {
    if (!open) { setStudent(null); setDays([]); setError(null); }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (body: { schedule: string[] }) => {
      const r = await fetch(`/api/students/${student!.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      // Notes panel + staff panel depend on student schedules — invalidate
      qc.invalidateQueries({ queryKey: ["instruction-notes"] });
      qc.invalidateQueries({ queryKey: ["students-search"] });
    }
  });

  const submit = async () => {
    setError(null);
    if (!student) { setError("Pick a student first"); return; }
    try {
      await mutation.mutateAsync({ schedule: days });
      toast.push(`${student.name}'s schedule updated.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change a student's schedule"
      icon={<CalendarDays className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending || !student} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : "Save schedule"}
          </button>
        </>
      }
    >
      <Field label="Student" required>
        <StudentSelect value={student} onChange={setStudent} autoFocus />
      </Field>

      {student && (
        <>
          <Field label="Days of week" hint={current.isPending ? "loading current schedule…" : "pick all days this student attends"}>
            <ChipGroup multi value={days} onChange={setDays} options={WEEKDAYS} />
          </Field>
          <p className="text-[11px] text-ink-secondary">
            Affects which days instruction notes for {student.name.split(" ")[0]} surface on the dashboard.
          </p>
        </>
      )}

      {error && <p className="text-[12px] text-status-danger-fg mt-2">{error}</p>}
    </Modal>
  );
}
