"use client";

import { useQuery } from "@tanstack/react-query";
import { Select } from "./Field";

interface StaffOption { id: string; name: string }

interface Props {
  value: string;                // staff NAME (not ID)
  onChange: (name: string) => void;
  placeholder?: string;
}

// Like StaffSelect but submits the staff NAME for singleSelect/text fields
// (Created By, Submitted By, Completed By, etc).
// Live-fetched from /api/staff/list so adding a Staff record shows up immediately
// — the API routes pass typecast: true so Airtable auto-creates the singleSelect
// option if it doesn't exist yet.
export function StaffNameSelect({ value, onChange, placeholder = "Select…" }: Props) {
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={q.isPending}
    >
      <option value="">{q.isPending ? "Loading…" : placeholder}</option>
      {q.data?.map((s) => (
        <option key={s.id} value={s.name}>{s.name}</option>
      ))}
    </Select>
  );
}
