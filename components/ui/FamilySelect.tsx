"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputBase } from "./Field";

export interface FamilyOption {
  id: string;
  name: string;
  motherFirst: string | null;
  motherEmail: string | null;
  motherPhone: string | null;
  fatherFirst: string | null;
  fatherEmail: string | null;
  fatherPhone: string | null;
  students: { id: string; name: string }[];
}

interface Props {
  value: FamilyOption | null;
  onChange: (f: FamilyOption | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function FamilySelect({ value, onChange, placeholder = "Type to search families…", autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const q = useQuery({
    queryKey: ["families-search", query],
    queryFn: async () => {
      const url = `/api/families/search${query ? `?q=${encodeURIComponent(query)}` : ""}`;
      const r = await fetch(url);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as FamilyOption[];
    },
    enabled: open,
    staleTime: 30_000
  });

  return (
    <div ref={wrapRef} className="relative">
      {value ? (
        <div className={cn(inputBase, "flex items-center justify-between")}>
          <span className="text-[14px]">
            {value.name}
            {(value.motherFirst || value.fatherFirst) && (
              <span className="text-ink-secondary text-[12px] ml-2">
                {[value.motherFirst, value.fatherFirst].filter(Boolean).join(" / ")}
              </span>
            )}
          </span>
          <button type="button" onClick={() => onChange(null)} aria-label="Clear">
            <X className="w-3.5 h-3.5 text-ink-tertiary hover:text-ink" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(inputBase, "pl-8")}
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-line rounded-md shadow-md max-h-72 overflow-y-auto">
          {q.isPending && <p className="px-3 py-2 text-[12px] text-ink-secondary">Searching…</p>}
          {q.isError && <p className="px-3 py-2 text-[12px] text-status-danger-fg">{q.error.message}</p>}
          {q.data && q.data.length === 0 && <p className="px-3 py-2 text-[12px] text-ink-secondary">No matches.</p>}
          {q.data && q.data.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { onChange(f); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-surface-muted text-[14px] border-b border-line last:border-b-0"
            >
              <div className="font-medium">{f.name}</div>
              {f.students.length > 0 && (
                <div className="text-[11px] text-ink-tertiary mt-0.5">
                  Kids: {f.students.map((s) => s.name).join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
