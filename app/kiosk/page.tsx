"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type KioskState =
  | { type: "idle" }
  | { type: "manual" }
  | { type: "loading" }
  | { type: "checkin"; firstName: string; streak: number; totalWeeks: number; milestone: number | null; birthday: boolean; subjects: string[]; mathLevel: string | null; readingLevel: string | null; workPickupDay: string | null; schedule: string[] }
  | { type: "checkout"; firstName: string; durationMinutes: number; totalWeeks: number; subjects: string[]; mathLevel: string | null; readingLevel: string | null; workPickupDay: string | null; schedule: string[] }
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
  totalWeeks?: number;
  subjects?: string[];
  subjectCount?: number;
  mathLevel?: string | null;
  readingLevel?: string | null;
  workPickupDay?: string | null;
  schedule?: string[];
}

interface StudentRow {
  id: string;
  name: string;
  firstName: string | null;
  subjects: string[];
  grade: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const RESET_DELAY_MS = 5500; // return to idle after showing result

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
            totalWeeks: d.totalWeeks ?? 0,
            milestone: d.milestoneTriggered ?? null,
            birthday: d.birthdayFlag ?? false,
            subjects,
            mathLevel: d.mathLevel ?? null,
            readingLevel: d.readingLevel ?? null,
            workPickupDay: d.workPickupDay ?? null,
            schedule: d.schedule ?? []
          });
        } else if (d.direction === "out") {
          setState({
            type: "checkout",
            firstName: fn,
            durationMinutes: d.durationMinutes ?? 0,
            totalWeeks: d.totalWeeks ?? 0,
            subjects,
            mathLevel: d.mathLevel ?? null,
            readingLevel: d.readingLevel ?? null,
            workPickupDay: d.workPickupDay ?? null,
            schedule: d.schedule ?? []
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

// ── Level Roadmap ─────────────────────────────────────────────────────────────

// Full Kumon level progression (math and reading share the same sequence)
const KUMON_LEVELS = ["7A","6A","5A","4A","3A","2A","A","B","C","D","E","F","G","H","I","J"];

function LevelRoadmap({
  label,
  level,
  color
}: {
  label: string;
  level: string | null;
  color: string;
}) {
  const upper = (level ?? "").toUpperCase();
  const currentIdx = KUMON_LEVELS.indexOf(upper);

  // If level isn't recognised, show a simple placeholder card
  if (currentIdx === -1) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-[13px] font-semibold uppercase tracking-widest opacity-60" style={{ color }}>{label}</div>
        <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-[26px]"
          style={{ background: `${color}18`, border: `2px solid ${color}40`, color }}>
          {upper || "—"}
        </div>
      </div>
    );
  }

  // Show 2 before current, current, 2 after — window of 5
  const startIdx = Math.max(0, currentIdx - 2);
  const endIdx   = Math.min(KUMON_LEVELS.length - 1, currentIdx + 2);
  const visible  = KUMON_LEVELS.slice(startIdx, endIdx + 1);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[13px] font-semibold uppercase tracking-widest" style={{ color, opacity: 0.7 }}>{label}</div>
      <div className="flex items-center">
        {visible.map((lvl, i) => {
          const lvlIdx   = KUMON_LEVELS.indexOf(lvl);
          const isCur    = lvl === upper;
          const isPast   = lvlIdx < currentIdx;
          const dotSize  = isCur ? 72 : 48;
          const fontSize = isCur ? 30 : 18;

          return (
            <div key={lvl} className="flex items-center">
              {/* connector line before each node except first */}
              {i > 0 && (
                <div
                  style={{
                    width: 28,
                    height: 3,
                    borderRadius: 2,
                    background: isPast || isCur ? color : `${color}22`,
                    opacity: isPast || isCur ? 1 : 0.5,
                  }}
                />
              )}
              <div
                className="flex items-center justify-center rounded-full font-black leading-none transition-all"
                style={{
                  width: dotSize,
                  height: dotSize,
                  fontSize,
                  background: isCur ? color : isPast ? `${color}22` : `${color}0a`,
                  color: isCur ? "white" : isPast ? color : `${color}55`,
                  border: `${isCur ? 3 : 2}px solid ${isCur ? color : isPast ? `${color}55` : `${color}22`}`,
                  boxShadow: isCur ? `0 0 0 6px ${color}18` : "none",
                }}
              >
                {lvl}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Streak + Total Weeks block ────────────────────────────────────────────────

function StreakBlock({
  streak,
  totalWeeks,
  milestone,
  compact = false,
}: {
  streak: number;
  totalWeeks: number;
  milestone: number | null;
  compact?: boolean;
}) {
  if (milestone) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="bg-yellow-400 text-yellow-900 font-display font-black rounded-2xl shadow-lg px-6 py-3 text-center"
          style={{ fontSize: compact ? 28 : 36 }}>
          🏆 {milestone}-Week Streak!
        </div>
        {totalWeeks > 0 && (
          <div className="text-ink-tertiary font-body" style={{ fontSize: compact ? 16 : 18 }}>
            {totalWeeks} total weeks
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-display font-black" style={{ color: "#3F5AA8", fontSize: compact ? 44 : 56, lineHeight: 1 }}>
          {streak}
        </span>
        <span className="text-ink-tertiary font-body" style={{ fontSize: compact ? 15 : 17 }}>
          {streak === 1 ? "week" : "weeks"}<br />in a row
        </span>
      </div>
      {totalWeeks > 0 && (
        <div className="text-ink-tertiary font-body mt-1" style={{ fontSize: compact ? 14 : 16 }}>
          {getStreakEmoji(streak)} {totalWeeks} total weeks
        </div>
      )}
    </div>
  );
}

// ── Check-In / Check-Out screens ──────────────────────────────────────────────

function CheckInScreen({ s }: { s: Extract<KioskState, { type: "checkin" }> }) {
  const isBirthday = s.birthday;
  const hasMath    = s.subjects.some((x) => x.toLowerCase() === "math");
  const hasReading = s.subjects.some((x) => x.toLowerCase() === "reading");
  const dualSubject = hasMath && hasReading;

  const greetColor = isBirthday ? "#e91e8c" : "#3F5AA8";
  const greeting   = isBirthday
    ? `Happy Birthday Week, ${s.firstName}! 🎂`
    : `Welcome, ${s.firstName}!`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-8 text-center">
      {/* Name */}
      <div className="font-display font-black leading-tight" style={{ color: greetColor, fontSize: "clamp(44px,6vw,80px)" }}>
        {greeting}
      </div>

      {dualSubject ? (
        /* ── Two subjects: Reading | Streak | Math ── */
        <div className="flex items-center justify-center gap-8 w-full max-w-[1100px]">
          <div className="flex-1 flex justify-end">
            <LevelRoadmap label="Reading" level={s.readingLevel} color="#0d7d62" />
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <StreakBlock streak={s.streak} totalWeeks={s.totalWeeks} milestone={s.milestone} />
          </div>
          <div className="flex-1 flex justify-start">
            <LevelRoadmap label="Math" level={s.mathLevel} color="#3F5AA8" />
          </div>
        </div>
      ) : (
        /* ── Single subject: centered ── */
        <div className="flex flex-col items-center gap-4">
          <StreakBlock streak={s.streak} totalWeeks={s.totalWeeks} milestone={s.milestone} />
          {hasMath && <LevelRoadmap label="Math" level={s.mathLevel} color="#3F5AA8" />}
          {hasReading && <LevelRoadmap label="Reading" level={s.readingLevel} color="#0d7d62" />}
        </div>
      )}

      <div className="text-[20px] text-status-success-fg font-body font-medium">
        ✓ Checked in
      </div>
    </div>
  );
}

function CheckOutScreen({ s }: { s: Extract<KioskState, { type: "checkout" }> }) {
  const hasMath    = s.subjects.some((x) => x.toLowerCase() === "math");
  const hasReading = s.subjects.some((x) => x.toLowerCase() === "reading");
  const dualSubject = hasMath && hasReading;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-8 text-center">
      {/* Name */}
      <div className="font-display font-black leading-tight text-brand" style={{ fontSize: "clamp(40px,5.5vw,72px)" }}>
        👋 See you next time, {s.firstName}!
      </div>

      {dualSubject ? (
        /* ── Two subjects: Reading | Duration+Weeks | Math ── */
        <div className="flex items-center justify-center gap-8 w-full max-w-[1100px]">
          <div className="flex-1 flex justify-end">
            <LevelRoadmap label="Reading" level={s.readingLevel} color="#0d7d62" />
          </div>
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="font-display font-black text-ink-primary" style={{ fontSize: "clamp(32px,4vw,52px)", lineHeight: 1 }}>
              {formatDuration(s.durationMinutes)}
            </div>
            <div className="text-ink-tertiary text-[15px]">today</div>
            {s.totalWeeks > 0 && (
              <div className="text-ink-tertiary text-[15px] mt-2">
                🗓 {s.totalWeeks} total weeks
              </div>
            )}
          </div>
          <div className="flex-1 flex justify-start">
            <LevelRoadmap label="Math" level={s.mathLevel} color="#3F5AA8" />
          </div>
        </div>
      ) : (
        /* ── Single subject: centered ── */
        <div className="flex flex-col items-center gap-4">
          <div className="font-display font-black text-ink-primary" style={{ fontSize: "clamp(36px,4.5vw,56px)", lineHeight: 1 }}>
            {formatDuration(s.durationMinutes)} today
          </div>
          {s.totalWeeks > 0 && (
            <div className="text-ink-tertiary text-[17px]">🗓 {s.totalWeeks} total weeks</div>
          )}
          {hasMath && <LevelRoadmap label="Math" level={s.mathLevel} color="#3F5AA8" />}
          {hasReading && <LevelRoadmap label="Reading" level={s.readingLevel} color="#0d7d62" />}
        </div>
      )}

      <div className="text-[20px] text-status-success-fg font-body font-medium">
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
