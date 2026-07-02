"use client";

import { useQuery } from "@tanstack/react-query";
import { Select } from "./Field";

interface StaffOption {
  id: string;
  name: string;
}

interface Props {
  value: string | null; // staff record ID
  onChange: (id: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function StaffSelect({ value, onChange, required, disabled, placeholder = "Pick a staff member…" }: Props) {
  const q = useQuery({
    queryKey: ["staff", "list"],
    queryFn: async () => {
      const r = await fetch("/api/staff/list");
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as StaffOption[];
    },
    staleTime: 5 * 60_000
  });

  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      required={required}
      disabled={disabled || q.isPending}
    >
      <option value="">{q.isPending ? "Loading…" : placeholder}</option>
      {q.data?.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </Select>
  );
}
