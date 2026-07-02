"use client";

import { useState, useEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useLogConversation } from "@/lib/mutations";
import { useToast } from "@/lib/toast";

interface StudentResult {
  id: string;
  name: string;
  grade: string | null;
  status: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogConversationModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [type, setType] = useState<string | null>("Phone Call");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useLogConversation();
  const toast = useToast();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setType("Phone Call");
      setDate(todayLocal());
      setNotes("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced student search
  useEffect(() => {
    if (selected) return;
    if (searchRef.current) clearTimeout(searchRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json() as { ok: boolean; data?: StudentResult[] };
        if (json.ok && json.data) setResults(json.data);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [query, selected]);

  const pickStudent = (r: StudentResult) => {
    setSelected(r);
    setResults([]);
    setQuery("");
  };

  const clearStudent = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = async () => {
    if (!selected) { toast.push("Pick a student first", "error"); return; }
    if (!type) { toast.push("Select a conversation type", "error"); return; }
    if (!date) { toast.push("Date is required", "error"); return; }
    try {
      await mutation.mutateAsync({
        studentId: selected.id,
        type,
        date,
        notes: notes.trim() || undefined
      });
      toast.push(`${type} with ${selected.name.split(" ")[0]} logged`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to log", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a conversation"
      icon={<Phone className="w-4 h-4" />}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button
            onClick={submit}
            disabled={mutation.isPending || !selected || !type}
            className="btn btn-primary"
          >
            {mutation.isPending ? "Saving..." : "Log it"}
          </button>
        </>
      }
    >
      {/* Student picker */}
      <Field label="Student" required>
        {selected ? (
          <div className="flex items-center justify-between bg-surface-subtle border border-line rounded px-3 py-2 text-[13px]">
            <div>
              <span className="font-medium">{selected.name}</span>
              {selected.grade && (
                <span className="text-ink-tertiary text-[11px] ml-2">Gr. {selected.grade}</span>
              )}
            </div>
            <button
              onClick={clearStudent}
              className="text-[11px] text-ink-tertiary hover:text-ink ml-3 shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <TextInput
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a student name..."
            />
            {(results.length > 0 || searching) && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-line rounded shadow-lg max-h-52 overflow-y-auto">
                {searching && (
                  <p className="px-3 py-2 text-[12px] text-ink-tertiary">Searching…</p>
                )}
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickStudent(r)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-subtle text-[13px] flex items-center gap-2 border-b border-line last:border-0"
                  >
                    <span className="font-medium flex-1">{r.name}</span>
                    {r.grade && (
                      <span className="text-ink-tertiary text-[11px]">Gr.{r.grade}</span>
                    )}
                    {r.status && (
                      <span className="text-ink-tertiary text-[11px] shrink-0">{r.status}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      {/* Type */}
      <Field label="Type" required>
        <ChipGroup value={type} onChange={setType} options={["Phone Call", "In Person"]} />
        <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11px] text-ink-tertiary border-t border-line pt-2">
          <div><span className="font-medium text-ink-secondary">Phone Call</span> — spoke by phone</div>
          <div><span className="font-medium text-ink-secondary">In Person</span> — face-to-face at the center</div>
        </div>
      </Field>

      {/* Date */}
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {/* Notes */}
      <Field label="Notes" hint="what happened — feeds into future email drafts">
        <TextArea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Confirmed starting July 14, looking at Mon/Thu schedule. Parent wants math only for now."
          rows={3}
        />
      </Field>

      <p className="text-[11px] text-ink-tertiary">
        Logs a Communications record and updates Last Contact Date immediately.
        Notes are picked up by the email worker when drafting future messages to this family.
      </p>
    </Modal>
  );
}
