"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { STAFF_TIERS, STAFF_ROLES } from "@/lib/options";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Minimal "add a staff member" form. Shifts get added afterward via the editor.
export function AddStaffForm({ open, onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tier, setTier] = useState<string>("");
  const [primaryRoles, setPrimaryRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setName(""); setEmail(""); setPhone(""); setTier(""); setPrimaryRoles([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () =>
      adminFetch<{ id: string }>(`/api/admin/staff`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          tier: (tier || null) as typeof STAFF_TIERS[number] | null,
          primaryRoles
        })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] })
  });

  const submit = async () => {
    if (!name.trim()) {
      toast.push("Name is required", "error");
      return;
    }
    try {
      await mutation.mutateAsync();
      toast.push(`Added ${name.trim()}.`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to add staff", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff"
      icon={<UserPlus className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-ink-secondary mb-4">
        Create a new staff record. Add weekly shifts on the next screen.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Tier">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">—</option>
            {STAFF_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Primary roles">
        <ChipGroup multi value={primaryRoles} onChange={setPrimaryRoles} options={STAFF_ROLES} />
      </Field>
    </Modal>
  );
}
