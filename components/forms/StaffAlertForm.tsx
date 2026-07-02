"use client";

import { useState, useEffect } from "react";
import { Bell, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { StaffNameSelect } from "@/components/ui/StaffNameSelect";
import { useCreateStaffAlert, useUpdateStaffAlert } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { StaffAlertCreate, StaffAlertUpdate } from "@/lib/schemas";
import { ALERT_CATEGORIES } from "@/lib/options";
import type { AlertRow } from "@/types/kumon";

interface Student { id: string; name: string; grade: string | null; status: string | null }
interface Props { open: boolean; onClose: () => void; editing?: AlertRow | null }

export function StaffAlertForm({ open, onClose, editing = null }: Props) {
  const isEdit = !!editing;
  const [alert, setAlert] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateStaffAlert();
  const updateMutation = useUpdateStaffAlert();
  const mutation = isEdit ? updateMutation : createMutation;
  const toast = useToast();

  useEffect(() => {
    if (!open) {
      setAlert(""); setStudent(null); setCategory(null); setCreatedBy(""); setError(null);
    } else if (editing) {
      setAlert(editing.alert ?? "");
      setStudent(
        editing.studentId
          ? { id: editing.studentId, name: editing.studentName ?? "Student", grade: null, status: null }
          : null
      );
      setCategory(editing.category ?? null);
      setCreatedBy(editing.createdBy ?? "");
      setError(null);
    }
  }, [open, editing]);

  const submit = async () => {
    setError(null);
    const payload = { alert: alert.trim(), studentId: student?.id ?? null, category: category ?? "", createdBy };
    const schema = isEdit ? StaffAlertUpdate : StaffAlertCreate;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("; ")); return; }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: editing!.id, ...parsed.data });
        toast.push("Alert updated.", "success");
      } else {
        await createMutation.mutateAsync(parsed.data);
        toast.push("Alert added.", "success");
      }
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : `Failed to ${isEdit ? "update" : "add"} alert`, "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit staff alert" : "Add staff alert"}
      icon={isEdit ? <Pencil className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      tintClassName="bg-tint-alerts-bg text-tint-alerts-fg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Save alert"}
          </button>
        </>
      }
    >
      <Field label="Alert" required>
        <TextArea value={alert} onChange={(e) => setAlert(e.target.value)} placeholder="What needs to happen?" autoFocus />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Student" hint="optional">
          <StudentSelect value={student} onChange={setStudent} placeholder="Type to search…" />
        </Field>
        <Field label="Created by" required>
          <StaffNameSelect value={createdBy} onChange={setCreatedBy} />
        </Field>
      </div>
      <Field label="Category" required>
        <ChipGroup value={category} onChange={setCategory} options={ALERT_CATEGORIES} />
      </Field>
      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        {isEdit ? "Stays in Active alerts. No emails fire." : "Adds to Active alerts. No emails fire."}
      </p>
    </Modal>
  );
}
