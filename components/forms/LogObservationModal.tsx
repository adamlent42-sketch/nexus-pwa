"use client";

import { useState, useEffect } from "react";
import { Eye, X, Save, ChevronDown } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

// Types
interface ActiveSession {
  id: string;          // attendance record ID
  studentName: string;
  checkInTime: string;
  minutesIn: number;
}

// Option lists (same as existing ObservationModal)
const COMPLETION_OPTIONS = ["Completed all sheets","Completed most sheets","Completed some sheets","Did not complete"];
const FOCUS_OPTIONS = ["Excellent focus","Good focus","Somewhat distracted","Struggled to focus"];
const PROGRESS_OPTIONS = ["Strong session","On pace","Needs extra support","Concern -- follow up"];
const STAFF_LS_KEY = "kumon-pwa.lastStaffName";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LogObservationModal({ open, onClose }: Props) {
  // Step 1: pick a student from checked-in list
  // Step 2: fill in observation fields

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);

  const [completion, setCompletion] = useState("");
  const [focus, setFocus] = useState("");
  const [progress, setProgress] = useState("");
  const [notes, setNotes] = useState("");
  const [flagCallParent, setFlagCallParent] = useState(false);
  const [flagInstruction, setFlagInstruction] = useState(false);
  const [addedBy, setAddedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load checked-in students when modal opens
  useEffect(() => {
    if (!open) return;
    // Reset form state
    setSelectedSession(null);
    setCompletion(""); setFocus(""); setProgress("");
    setNotes(""); setFlagCallParent(false); setFlagInstruction(false);
    setError("");
    // Load last staff name from localStorage
    if (typeof window !== "undefined") {
      setAddedBy(window.localStorage.getItem(STAFF_LS_KEY) ?? "");
    }
    // Fetch active sessions
    setLoadingSessions(true);
    fetch("/api/checkin/active")
      .then(r => r.json())
      .then(data => {
        // API returns { ok: true, data: [...] }
        const list: ActiveSession[] = Array.isArray(data.data) ? data.data : [];
        setSessions(list);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [open]);

  async function handleSave() {
    if (!selectedSession) return;
    setSaving(true);
    setError("");
    try {
      if (addedBy && typeof window !== "undefined") {
        window.localStorage.setItem(STAFF_LS_KEY, addedBy);
      }
      await adminFetch("/api/admin/checkin/observation", {
        method: "PATCH",
        body: JSON.stringify({
          attendanceId: selectedSession.id,
          completion: completion || undefined,
          focus: focus || undefined,
          progress: progress || undefined,
          notes: notes.trim() || undefined,
          flagCallParent: flagCallParent || undefined,
          flagAddInstructionNote: flagInstruction || undefined,
          addedBy: addedBy.trim() || undefined
        })
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand" />
            <h2 className="text-[16px] font-semibold">Log Observation</h2>
          </div>
          <button className="btn p-1.5" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Student picker */}
          <div>
            <label className="text-[13px] font-medium text-ink-secondary mb-1.5 block">Student</label>
            {loadingSessions ? (
              <div className="h-10 bg-surface-muted rounded-lg animate-pulse" />
            ) : sessions.length === 0 ? (
              <p className="text-[13px] text-ink-secondary italic py-2">No students currently checked in.</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedSession?.id ?? ""}
                  onChange={e => {
                    const s = sessions.find(x => x.id === e.target.value) ?? null;
                    setSelectedSession(s);
                  }}
                  className="w-full appearance-none border border-[#e2e8f0] rounded-lg px-3 py-2.5 pr-8 text-[14px] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                >
                  <option value="">Select a student...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.studentName} ({s.minutesIn}m in)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" />
              </div>
            )}
          </div>

          {/* Show observation fields only after student selected */}
          {selectedSession && (
            <>
              {/* Completion */}
              <PickerRow label="Completion" options={COMPLETION_OPTIONS} value={completion} onChange={setCompletion} />
              {/* Focus */}
              <PickerRow label="Focus" options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />
              {/* Progress */}
              <PickerRow label="Progress" options={PROGRESS_OPTIONS} value={progress} onChange={setProgress} />

              {/* Notes */}
              <div>
                <label className="text-[13px] font-medium text-ink-secondary mb-1 block">Notes</label>
                <textarea
                  rows={3}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[14px] resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Free-form observation notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Flags */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={flagCallParent} onChange={e => setFlagCallParent(e.target.checked)} className="w-4 h-4 accent-brand" />
                  <span className="text-[14px]">📞 Flag — call parent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={flagInstruction} onChange={e => setFlagInstruction(e.target.checked)} className="w-4 h-4 accent-brand" />
                  <span className="text-[14px]">📝 Flag — add instruction note</span>
                </label>
              </div>

              {/* Added by */}
              <div>
                <label className="text-[13px] font-medium text-ink-secondary mb-1 block">Added by</label>
                <input
                  type="text"
                  className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-[14px] w-full focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Your name..."
                  value={addedBy}
                  onChange={e => setAddedBy(e.target.value)}
                />
              </div>

              {error && <p className="text-[13px] text-red-600">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#e2e8f0] flex justify-end gap-2 sticky bottom-0 bg-white">
          <button className="btn" onClick={onClose}>Cancel</button>
          {selectedSession && (
            <button
              className="btn btn-primary flex items-center gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save observation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components
function PickerRow({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-ink-secondary mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} className={`chip ${value === opt ? "chip-on" : ""}`} onClick={() => onChange(value === opt ? "" : opt)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
