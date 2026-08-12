"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type KioskState =
  | { type: "idle" }
  | { type: "manual" }
  | { type: "loading" }
  | { type: "checkin"; firstName: string; streak: number; milestone: number | null; birthday: boolean; subjects: string[] }
  | { type: "checkout"; firstName: string; durationMinutes: number; subjects: string[] }
  | { type: "unknown" }
  | { type: "ignored"; firstName: string };

interface CheckinResponse {
  direction: "in" | "out" | "ignored" | "unknown";
  firstName?: string;
  studentName?: string;
  streak?: number;
  milestoneTriggered?: number | null;
  birthdayFlag?: boolean;
  durationMinutes?: number;
  subjects?: string[];
  subjectCount?: number;
}

interface StudentRow {
  id: string;
  name: string;
  firstName: string | null;
  subjects: string[];
  grade: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const RESET_DELAY_MS = 4000; // return to idle after showing result

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getStreakEmoji(streak: number): string {
  if (streak >= 50) return "🌟";
  if (streak >= 25) return "🏆";
  if (streak >= 10) return "🎯";
  if (streak >= 5) return "🔥";
  return "✨";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const [state, setState] = useState<KioskState>({ type: "idle" });
  const [buffer, setBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  const isManual = state.type === "manual";

  // Keep the hidden input focused (disabled while manual overlay is open)
  const refocusInput = useCallback(() => {
    if (!isManual) inputRef.current?.focus();
  }, [isManual]);

  useEffect(() => {
    refocusInput();
  }, [refocusInput]);

  // Schedule auto-reset to idle
  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState({ type: "idle" });
      setBuffer("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }, RESET_DELAY_MS);
  }, []);

  // Core check-in/out logic — shared by scanner and manual picker
  const submitScan = useCallback(async (scannedId: string) => {
    if (submittingRef.current) return;
    const id = scannedId.trim();
    if (!id) return;

    submittingRef.current = true;
    setState({ type: "loading" });
    setBuffer("");

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id })
      });
      const json = await res.json() as { ok: boolean; data?: CheckinResponse; error?: string };

      if (!json.ok || !json.data) {
        setState({ type: "unknown" });
      } else {
        const d = json.data;
        const fn = d.firstName ?? d.studentName?.split(" ")[0] ?? "Student";
        const subjects = d.subjects ?? [];

        if (d.direction === "in") {
          setState({
            type: "checkin",
            firstName: fn,
            streak: d.streak ?? 0,
            milestone: d.milestoneTriggered ?? null,
            birthday: d.birthdayFlag ?? false,
            subjects
          });
        } else if (d.direction === "out") {
          setState({
            type: "checkout",
            firstName: fn,
            durationMinutes: d.durationMinutes ?? 0,
            subjects
          });
        } else if (d.direction === "ignored") {
          setState({ type: "ignored", firstName: fn });
        } else {
          setState({ type: "unknown" });
        }
      }
    } catch {
      setState({ type: "unknown" });
    } finally {
      submittingRef.current = false;
      scheduleReset();
    }
  }, [scheduleReset]);

  // Capture keystrokes from HID barcode scanner — suspended while manual overlay is open
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isManual) return;
    if (e.key === "Enter") {
      const scanned = buffer.trim();
      if (scanned) submitScan(scanned);
      else setBuffer("");
      return;
    }
    if (e.key.length === 1) {
      setBuffer((prev) => prev + e.key);
    }
  }, [buffer, submitScan, isManual]);

  const openManual = useCallback(() => setState({ type: "manual" }), []);
  const closeManual = useCallback(() => {
    setState({ type: "idle" });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center select-none cursor-default"
      onClick={refocusInput}
      onTouchEnd={refocusInput}
    >
      {/* Hidden input — captures all barcode scanner keystrokes */}
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        value={buffer}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        aria-label="Barcode input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* State screens */}
      {state.type === "idle" && <IdleScreen onManual={openManual} />}
      {state.type === "loading" && <LoadingScreen />}
      {state.type === "checkin" && <CheckInScreen s={state} />}
      {state.type === "checkout" && <CheckOutScreen s={state} />}
      {state.type === "unknown" && <UnknownScreen />}
      {state.type === "ignored" && <IgnoredScreen s={state} />}

      {/* Manual overlay — rendered on top of whatever state is showing */}
      {state.type === "manual" && (
        <ManualOverlay onClose={closeManual} onSelect={submitScan} />
      )}
    </div>
  );
}

// ── State Screens ─────────────────────────────────────────────────────────────

function IdleScreen({ onManual }: { onManual: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-8 text-center px-8 relative">
      <div className="text-brand font-display font-black text-[72px] leading-none tracking-tight">
        KUMON
      </div>
      <div className="text-ink-secondary font-body text-[28px] font-medium">
        Scan your folder to check in or out
      </div>
      <div className="mt-4 text-[18px] text-ink-tertiary animate-pulse">
        Waiting for scan...
      </div>

      {/* Unobtrusive staff button — bottom-right corner */}
      <button
        className="absolute bottom-6 right-6 text-[13px] text-ink-tertiary border border-surface-border rounded-lg px-3 py-2 hover:bg-surface-subtle transition-colors"
        onClick={(e) => { e.stopPropagation(); onManual(); }}
        onTouchEnd={(e) => { e.stopPropagation(); onManual(); }}
      >
        Staff: Manual check-in / out
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      <p className="text-ink-secondary text-[22px]">Looking you up…</p>
    </div>
  );
}

function CheckInScreen({ s }: { s: Extract<KioskState, { type: "checkin" }> }) {
  const isMilestone = !!s.milestone;
  const isBirthday = s.birthday;

  return (
    <div className="flex flex-col items-center gap-6 text-center px-8 max-w-[900px]">
      {isBirthday && (
        <div className="text-[72px] leading-none animate-bounce">🎂</div>
      )}
      {isMilestone && !isBirthday && (
        <div className="text-[72px] leading-none">{getStreakEmoji(s.milestone!)}</div>
      )}
      <div
        className={`font-display font-black leading-tight ${isBirthday || isMilestone ? "text-[60px]" : "text-[80px]"}`}
        style={{ color: isBirthday ? "#e91e8c" : "#3F5AA8" }}
      >
        {isBirthday ? `Happy Birthday Week, ${s.firstName}!` : `Welcome, ${s.firstName}!`}
      </div>
      {isMilestone && (
        <div className="bg-yellow-400 text-yellow-900 font-display font-black text-[40px] px-8 py-4 rounded-2xl shadow-lg">
          🏆 {s.milestone}-Week Streak!
        </div>
      )}
      {!isMilestone && s.streak > 0 && (
        <div className="text-[28px] text-ink-secondary font-body">
          {getStreakEmoji(s.streak)} Week streak: <strong>{s.streak}</strong>
        </div>
      )}
      {s.subjects.length > 0 && (
        <div className="text-[22px] text-ink-tertiary font-body">
          {s.subjects.join(" + ")} today
        </div>
      )}
      <div className="text-[20px] text-status-success-fg font-body font-medium mt-2">
        ✓ Checked in
      </div>
    </div>
  );
}

function CheckOutScreen({ s }: { s: Extract<KioskState, { type: "checkout" }> }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-8 max-w-[900px]">
      <div className="text-[64px] leading-none">👋</div>
      <div className="font-display font-black text-[80px] leading-tight text-brand">
        See you next time, {s.firstName}!
      </div>
      <div className="text-[32px] text-ink-secondary font-body">
        {formatDuration(s.durationMinutes)} today
        {s.subjects.length > 0 && ` · ${s.subjects.join(" + ")}`}
      </div>
      <div className="text-[20px] text-status-success-fg font-body font-medium mt-2">
        ✓ Checked out
      </div>
    </div>
  );
}

function UnknownScreen() {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-8">
      <div className="text-[64px] leading-none">🤔</div>
      <div className="font-display font-black text-[64px] text-status-danger-fg leading-tight">
        Folder not recognized
      </div>
      <div className="text-[24px] text-ink-secondary font-body">
        Please see a staff member
      </div>
    </div>
  );
}

function IgnoredScreen({ s }: { s: Extract<KioskState, { type: "ignored" }> }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-8">
      <div className="text-[64px] leading-none">👍</div>
      <div className="font-display font-black text-[64px] text-ink-primary leading-tight">
        Already checked in, {s.firstName}!
      </div>
    </div>
  );
}

// ── Manual Check-In Overlay ───────────────────────────────────────────────────

function ManualOverlay({
  onClose,
  onSelect
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    fetch("/api/checkin/students")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: StudentRow[] }) => {
        if (j.ok && j.data) setStudents(j.data);
        else setError("Could not load students");
      })
      .catch(() => setError("Could not load students"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-subtle shrink-0">
          <h2 className="text-[17px] font-semibold">Manual Check-In / Out</h2>
          <button
            className="text-ink-tertiary hover:text-ink-primary p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-subtle shrink-0">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-surface-border rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* Student list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-ink-tertiary text-[15px]">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-status-danger-fg text-[15px]">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-ink-tertiary text-[15px]">No students found</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                className="w-full text-left px-5 py-3.5 border-b border-surface-subtle last:border-0 hover:bg-surface-subtle active:bg-surface-muted transition-colors"
                onClick={() => onSelect(s.id)}
              >
                <div className="text-[15px] font-medium leading-tight">
                  {s.name}
                  {s.grade && (
                    <span className="ml-2 text-[12px] text-ink-tertiary font-normal">Gr {s.grade}</span>
                  )}
                </div>
                {s.subjects.length > 0 && (
                  <div className="text-[13px] text-ink-tertiary mt-0.5">
                    {s.subjects.join(" + ")}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-subtle shrink-0 text-[12px] text-ink-tertiary text-center">
          {filtered.length} student{filtered.length !== 1 ? "s" : ""}
          {search ? " matched" : " total"}
        </div>
      </div>
    </div>
  );
}
