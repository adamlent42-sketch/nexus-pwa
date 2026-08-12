"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import type { ActiveSession } from "./WhosHerePanel";

// -- Option lists ------------------------------------------------------------

const COMPLETION_OPTIONS = [
  "Completed all sheets",
  "Completed most sheets",
  "Completed some sheets",
  "Did not complete"
];

const FOCUS_OPTIONS = [
  "Excellent focus",
  "Good focus",
  "Somewhat distracted",
  "Struggled to focus"
];

const PROGRESS_OPTIONS = [
  "Strong session",
  "On pace",
  "Needs extra support",
  "Concern -- follow up"
];

// -- Helpers -----------------------------------------------------------------

const STAFF_LS_KEY = "kumon-pwa.lastStaffName";

function getLastStaff(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STAFF_LS_KEY) ?? "";
}

function saveLastStaff(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAFF_LS_KEY, name);
}

// -- Component ---------------------------------------------------------------

interface Props {
  session: ActiveSession;
  onClose: () => void;
  onSaved: () => void;
}

export function ObservationModal({ session, onClose, onSaved }: Props) {
  const [completion, setCompletion] = useState("");
  const [focus, setFocus] = useState("");
  const [progress, setProgress] = useState("");
  const [notes, setNotes] = useState("");
  const [flagCallParent, setFlagCallParent] = useState(false);
  const [flagInstruction, setFlagInstruction] = useState(false);
  const [addedBy, setAddedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAddedBy(getLastStaff());
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (addedBy) saveLastStaff(addedBy);
      await adminFetch("/api/admin/checkin/observation", {
        method: "PATCH",
        body: JSON.stringify({
          attendanceId: session.id,
          completion: completion || undefined,
          focus: focus || undefined,
          progress: progress || undefined,
          notes: notes.trim() || undefined,
          flagCallParent: flagCallParent || undefined,
          flagAddInstructionNote: flagInstruction || undefined,
          addedBy: addedBy.trim() || undefined
        })
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-subtle">
          <div>
            <h2 className="text-[16px] font-semibold">Observation -- {session.studentName}</h2>
            <p className="meta-sm text-ink-tertiary mt-0.5">This session</p>
          </div>
          <button className="btn p-1.5" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Completion */}
          <PickerRow
            label="Completion"
            options={COMPLETION_OPTIONS}
            value={completion}
            onChange={setCompletion}
          />

          {/* Focus */}
          <PickerRow
            label="Focus"
            options={FOCUS_OPTIONS}
            value={focus}
            onChange={setFocus}
          />

          {/* Progress */}
          <PickerRow
            label="Progress"
            options={PROGRESS_OPTIONS}
            value={progress}
            onChange={setProgress}
          />

          {/* Notes */}
          <div>
            <label className="text-[13px] font-medium text-ink-secondary mb-1 block">Notes</label>
            <textarea
              rows={3}
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-[14px] resize-none focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Free-form observation notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Flags */}
          <div className="space-y-2">
            <CheckFlag
              label="📞 Flag -- call parent"
              checked={flagCallParent}
              onChange={setFlagCallParent}
            />
            <CheckFlag
              label="📝 Flag -- add instruction note"
              checked={flagInstruction}
              onChange={setFlagInstruction}
            />
          </div>

          {/* Staff name */}
          <div>
            <label className="text-[13px] font-medium text-ink-secondary mb-1 block">Added by</label>
            <input
              type="text"
              className="border border-surface-border rounded-lg px-3 py-2 text-[14px] w-full focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Your name..."
              value={addedBy}
              onChange={(e) => setAddedBy(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && <p className="text-[13px] text-status-danger-fg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-surface-subtle flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save observation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components ----------------------------------------------------------

function PickerRow({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[13px] font-medium text-ink-secondary mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            className={`chip ${value === opt ? "chip-on" : ""}`}
            onClick={() => onChange(value === opt ? "" : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckFlag({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-brand"
      />
      <span className="text-[14px]">{label}</span>
    </label>
  );
}
