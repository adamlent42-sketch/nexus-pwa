"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, UserCog, Power, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { STAFF_TIERS, STAFF_STATUSES, STAFF_ROLES, WEEKDAYS_ALL } from "@/lib/options";
import { parseShiftTime, formatShiftTime } from "@/lib/shift-time";

interface Shift {
  id: string;
  dayOfWeek: string | null;
  role: string[];
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

export interface StaffRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string | null;
  status: string | null;
  workingThrough: string | null;
  primaryRoles: string[];
  notes: string | null;
  shifts: Shift[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  staff: StaffRecord | null;
}

export function StaffEditor({ open, onClose, staff }: Props) {
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tier, setTier] = useState<string>("");
  const [status, setStatus] = useState<string>("Active");
  const [workingThrough, setWorkingThrough] = useState("");
  const [primaryRoles, setPrimaryRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && staff) {
      setName(staff.name);
      setEmail(staff.email ?? "");
      setPhone(staff.phone ?? "");
      setTier(staff.tier ?? "");
      setStatus(staff.status ?? "Active");
      setWorkingThrough(staff.workingThrough ?? "");
      setPrimaryRoles(staff.primaryRoles ?? []);
      setNotes(staff.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id]);

  const saveDetails = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      return adminFetch<{ id: string }>(`/api/admin/staff/${staff.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          tier: (tier || null) as typeof STAFF_TIERS[number] | null,
          status: status as typeof STAFF_STATUSES[number],
          workingThrough: workingThrough || null,
          primaryRoles,
          notes: notes.trim() || null
        })
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const deactivate = useMutation({
    mutationFn: async (effective: string | null) => {
      if (!staff) return;
      return adminFetch<{ id: string }>(`/api/admin/staff/${staff.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Departed", workingThrough: effective })
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      return adminFetch<{ id: string }>(`/api/admin/staff/${staff.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Active", workingThrough: null })
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const saveAndClose = async () => {
    if (!staff) return;
    if (!name.trim()) {
      toast.push("Name is required", "error");
      return;
    }
    try {
      await saveDetails.mutateAsync();
      toast.push(`Updated ${name.trim()}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  const onDeactivate = async () => {
    if (!staff) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = window.prompt("Last working day (YYYY-MM-DD). Leave blank for today.", today);
    if (last === null) return;
    const effective = last.trim() || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
      toast.push("Date must be YYYY-MM-DD", "error");
      return;
    }
    try {
      await deactivate.mutateAsync(effective);
      toast.push(`${staff.name} marked Departed.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const onReactivate = async () => {
    if (!staff) return;
    try {
      await reactivate.mutateAsync();
      toast.push(`${staff.name} re-activated.`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (!staff) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${staff.name}`}
      icon={<UserCog className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      size="lg"
      footer={
        <>
          {status !== "Departed" ? (
            <button onClick={onDeactivate} className="btn text-status-danger-fg mr-auto" title="Mark as Departed">
              <Power className="w-3.5 h-3.5" /> Deactivate
            </button>
          ) : (
            <button onClick={onReactivate} className="btn text-status-success-fg mr-auto" title="Set back to Active">
              <RotateCcw className="w-3.5 h-3.5" /> Re-activate
            </button>
          )}
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={saveAndClose} disabled={saveDetails.isPending} className="btn btn-primary">
            {saveDetails.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
        </Field>
        <Field label="Tier">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">—</option>
            {STAFF_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STAFF_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Working through" hint="last day on the schedule">
          <TextInput type="date" value={workingThrough} onChange={(e) => setWorkingThrough(e.target.value)} />
        </Field>
      </div>

      <Field label="Primary roles" hint="what this staff is qualified to cover">
        <ChipGroup multi value={primaryRoles} onChange={setPrimaryRoles} options={STAFF_ROLES} />
      </Field>

      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="mt-6 pt-4 border-t border-line">
        <ShiftsEditor staffId={staff.id} shifts={staff.shifts} />
      </div>
    </Modal>
  );
}

function ShiftsEditor({ staffId, shifts }: { staffId: string; shifts: Shift[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, Partial<Shift>>>({});
  const [adding, setAdding] = useState<Partial<Shift> | null>(null);

  const merged = useMemo(() => {
    return shifts.map((s) => ({ ...s, ...(edits[s.id] ?? {}) }));
  }, [shifts, edits]);

  const updateShift = useMutation({
    mutationFn: async ({ shiftId, body }: { shiftId: string; body: Partial<Shift> }) =>
      adminFetch<{ id: string }>(`/api/admin/staff/${staffId}/shifts/${shiftId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const deleteShift = useMutation({
    mutationFn: async (shiftId: string) =>
      adminFetch<{ id: string }>(`/api/admin/staff/${staffId}/shifts/${shiftId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const createShift = useMutation({
    mutationFn: async (body: Partial<Shift>) =>
      adminFetch<{ id: string }>(`/api/admin/staff/${staffId}/shifts`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const setEdit = (shiftId: string, patch: Partial<Shift>) => {
    setEdits((prev) => ({ ...prev, [shiftId]: { ...prev[shiftId], ...patch } }));
  };

  const saveRow = async (shift: Shift) => {
    const patch = edits[shift.id];
    if (!patch) return;
    // Times come in as HH:MM (24-hour) from <input type="time">; convert to
    // the canonical "h:MM AM/PM" display form before storing.
    const body: Partial<Shift> = {
      dayOfWeek: patch.dayOfWeek,
      role: patch.role,
      notes: patch.notes
    };
    if (patch.startTime !== undefined) body.startTime = formatShiftTime(patch.startTime) || null;
    if (patch.endTime !== undefined) body.endTime = formatShiftTime(patch.endTime) || null;
    try {
      await updateShift.mutateAsync({ shiftId: shift.id, body });
      toast.push("Shift updated.", "success");
      setEdits((prev) => { const n = { ...prev }; delete n[shift.id]; return n; });
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const deleteRow = async (shiftId: string) => {
    if (!window.confirm("Delete this shift?")) return;
    try {
      await deleteShift.mutateAsync(shiftId);
      toast.push("Shift deleted.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const saveNew = async () => {
    if (!adding) return;
    if (!adding.dayOfWeek) { toast.push("Pick a day", "error"); return; }
    if (!adding.role || adding.role.length === 0) { toast.push("Pick at least one role", "error"); return; }
    try {
      await createShift.mutateAsync({
        dayOfWeek: adding.dayOfWeek,
        role: adding.role,
        startTime: formatShiftTime(adding.startTime) || null,
        endTime: formatShiftTime(adding.endTime) || null,
        notes: adding.notes ?? null
      });
      toast.push("Shift added.", "success");
      setAdding(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-medium">Weekly schedule</p>
        {adding === null && (
          <button onClick={() => setAdding({ dayOfWeek: "Monday", role: ["CA"], startTime: "", endTime: "" })} className="btn">
            <Plus className="w-3.5 h-3.5" /> Add shift
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-tertiary mb-2">
        Edit any field below to change a shift — Save appears once you make a change. Trash deletes the shift.
      </p>

      {merged.length === 0 && !adding && (
        <p className="text-[12px] text-ink-tertiary py-3">No shifts on file. Click "Add shift" to add one.</p>
      )}

      <div className="space-y-2">
        {merged.map((s) => {
          const isDirty = edits[s.id] !== undefined;
          return (
            <ShiftRow
              key={s.id}
              shift={s}
              isDirty={isDirty}
              onChange={(patch) => setEdit(s.id, patch)}
              onSave={() => saveRow(s)}
              onDelete={() => deleteRow(s.id)}
              saving={updateShift.isPending}
            />
          );
        })}

        {adding && (
          <ShiftRow
            shift={{ id: "new", ...adding } as Shift}
            isDirty
            isNew
            onChange={(patch) => setAdding((prev) => ({ ...prev, ...patch }))}
            onSave={saveNew}
            onDelete={() => setAdding(null)}
            saving={createShift.isPending}
          />
        )}
      </div>
    </div>
  );
}

function ShiftRow({
  shift, isDirty, isNew, onChange, onSave, onDelete, saving
}: {
  shift: Shift;
  isDirty: boolean;
  isNew?: boolean;
  onChange: (patch: Partial<Shift>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className={`border rounded p-2 flex flex-wrap items-center gap-2 ${isDirty ? "border-brand bg-tint-purple-bg/30" : "border-line"}`}>
      <Select
        value={shift.dayOfWeek ?? ""}
        onChange={(e) => onChange({ dayOfWeek: e.target.value })}
        className="w-[120px]"
      >
        <option value="">Day…</option>
        {WEEKDAYS_ALL.map((d) => <option key={d} value={d}>{d}</option>)}
      </Select>
      <TextInput
        type="time"
        value={parseShiftTime(shift.startTime)}
        onChange={(e) => onChange({ startTime: e.target.value })}
        className="w-[120px]"
      />
      <span className="text-ink-tertiary">–</span>
      <TextInput
        type="time"
        value={parseShiftTime(shift.endTime)}
        onChange={(e) => onChange({ endTime: e.target.value })}
        className="w-[120px]"
      />
      <div className="flex-1 min-w-[200px]">
        <ChipGroup
          multi
          value={shift.role ?? []}
          onChange={(v) => onChange({ role: v })}
          options={STAFF_ROLES}
        />
      </div>
      {isDirty && (
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? "…" : (isNew ? "Add" : "Save")}
        </button>
      )}
      <button onClick={onDelete} className="btn" title={isNew ? "Cancel" : "Delete"}>
        <Trash2 className="w-3.5 h-3.5 text-status-danger-fg" />
      </button>
    </div>
  );
}
