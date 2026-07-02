"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputBase } from "./Field";

interface Student {
  id: string;
  name: string;
  grade: string | null;
  status: string | null;
}

interface SingleProps {
  value: Student | null;
  onChange: (s: Student | null) => void;
  multi?: false;
  placeholder?: string;
  autoFocus?: boolean;
}
interface MultiProps {
  value: Student[];
  onChange: (s: Student[]) => void;
  multi: true;
  placeholder?: string;
  autoFocus?: boolean;
}
type Props = SingleProps | MultiProps;

export function StudentSelect(props: Props) {
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
    queryKey: ["students-search", query],
    queryFn: async () => {
      const url = `/api/students/search${query ? `?q=${encodeURIComponent(query)}` : ""}`;
      const r = await fetch(url);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as Student[];
    },
    enabled: open,
    staleTime: 30_000
  });

  const select = (s: Student) => {
    if (props.multi) {
      if (!props.value.find((v) => v.id === s.id)) props.onChange([...props.value, s]);
    } else {
      props.onChange(s);
      setOpen(false);
    }
    setQuery("");
  };

  const removeOne = (id: string) => {
    if (props.multi) props.onChange(props.value.filter((v) => v.id !== id));
  };

  return (
    <div ref={wrapRef} className="relative">
      {props.multi ? (
        <div className={cn(inputBase, "flex flex-wrap gap-1.5 items-center min-h-[40px] py-1.5 cursor-text")} onClick={() => setOpen(true)}>
          {props.value.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-tint-purple-bg text-tint-purple-fg px-2 py-0.5 rounded-full text-[12px]">
              {s.name}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeOne(s.id); }} aria-label="Remove">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={props.value.length === 0 ? (props.placeholder ?? "Type to search students…") : "Add another…"}
            autoFocus={props.autoFocus}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-[14px] py-1"
          />
        </div>
      ) : props.value ? (
        <div className={cn(inputBase, "flex items-center justify-between")}>
          <span className="text-[14px]">{props.value.name}{props.value.grade && <span className="text-ink-secondary text-[12px] ml-2">Gr {props.value.grade}</span>}</span>
          <button type="button" onClick={() => props.onChange(null)} aria-label="Clear">
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
            placeholder={props.placeholder ?? "Type to search students…"}
            autoFocus={props.autoFocus}
            className={cn(inputBase, "pl-8")}
          />
        </div>
      )}

      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-line rounded-md shadow-md max-h-72 overflow-y-auto">
          {q.isPending && <p className="px-3 py-2 text-[12px] text-ink-secondary">Searching…</p>}
          {q.isError && <p className="px-3 py-2 text-[12px] text-status-danger-fg">{q.error.message}</p>}
          {q.data && q.data.length === 0 && <p className="px-3 py-2 text-[12px] text-ink-secondary">No matches.</p>}
          {q.data && q.data.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s)}
              className="w-full text-left px-3 py-2 hover:bg-surface-muted flex items-center justify-between text-[14px]"
            >
              <span>{s.name}</span>
              {s.grade && <span className="text-[12px] text-ink-tertiary">Gr {s.grade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
