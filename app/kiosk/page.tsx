"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// -- Types -------------------------------------------------------------------

type KioskState =
  | { type: "idle" }
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

// -- Constants ---------------------------------------------------------------

const RESET_DELAY_MS = 4000; // return to idle after showing result

// -- Helpers -----------------------------------------------------------------

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

// -- Component ---------------------------------------------------------------

export default function KioskPage() {
  const [state, setState] = useState<KioskState>({ type: "idle" });
  const [buffer, setBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  // Always keep the hidden input focused
  const refocusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    refocusInput();
  }, [refocusInput]);

  // Schedule auto-reset to idle
  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState({ type: "idle" });
      setBuffer("");
      refocusInput();
    }, RESET_DELAY_MS);
  }, [refocusInput]);

  // Submit scanned barcode to API
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

  // Capture keystrokes from HID barcode scanner
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const scanned = buffer.trim();
      if (scanned) submitScan(scanned);
      else setBuffer("");
      return;
    }
    // Accumulate printable characters
    if (e.key.length === 1) {
      setBuffer((prev) => prev + e.key);
    }
  }, [buffer, submitScan]);

  return (
    // Clicking anywhere refocuses the hidden input
    <div
      className="w-full h-full flex flex-col items-center justify-center select-none cursor-default"
      onClick={refocusInput}
      onTouchEnd={refocusInput}
    >
      {/* Hidden input -- captures all barcode scanner keystrokes */}
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        onChange={() => {}} // controlled via keydown
        value={buffer}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        aria-label="Barcode input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* State screens */}
      {state.type === "idle" && <IdleScreen />}
      {state.type === "loading" && <LoadingScreen />}
      {state.type === "checkin" && <CheckInScreen s={state} />}
      {state.type === "checkout" && <CheckOutScreen s={state} />}
      {state.type === "unknown" && <UnknownScreen />}
      {state.type === "ignored" && <IgnoredScreen s={state} />}
    </div>
  );
}

// -- State Screens ------------------------------------------------------------

function IdleScreen() {
  return (
    <div className="flex flex-col items-center gap-8 text-center px-8">
      {/* Kumon logo wordmark */}
      <div className="text-brand font-display font-black text-[72px] leading-none tracking-tight">
        KUMON
      </div>
      <div className="text-ink-secondary font-body text-[28px] font-medium">
        Scan your folder to check in or out
      </div>
      <div className="mt-4 text-[18px] text-ink-tertiary animate-pulse">
        Waiting for scan...
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      <p className="text-ink-secondary text-[22px]">Looking you up...</p>
    </div>
  );
}

function CheckInScreen({ s }: { s: Extract<KioskState, { type: "checkin" }> }) {
  const isMilestone = !!s.milestone;
  const isBirthday = s.birthday;

  return (
    <div className="flex flex-col items-center gap-6 text-center px-8 max-w-[900px]">
      {/* Birthday takes top priority */}
      {isBirthday && (
        <div className="text-[72px] leading-none animate-bounce">🎂</div>
      )}
      {/* Milestone emoji */}
      {isMilestone && !isBirthday && (
        <div className="text-[72px] leading-none">{getStreakEmoji(s.milestone!)}</div>
      )}
      {/* Welcome message */}
      <div className={`font-display font-black leading-tight ${isBirthday || isMilestone ? "text-[60px]" : "text-[80px]"}`}
        style={{ color: isBirthday ? "#e91e8c" : "#3F5AA8" }}>
        {isBirthday ? `Happy Birthday Week, ${s.firstName}!` : `Welcome, ${s.firstName}!`}
      </div>
      {/* Milestone callout */}
      {isMilestone && (
        <div className="bg-yellow-400 text-yellow-900 font-display font-black text-[40px] px-8 py-4 rounded-2xl shadow-lg">
          🏆 {s.milestone}-Week Streak!
        </div>
      )}
      {/* Streak counter (non-milestone) */}
      {!isMilestone && s.streak > 0 && (
        <div className="text-[28px] text-ink-secondary font-body">
          {getStreakEmoji(s.streak)} Week streak: <strong>{s.streak}</strong>
        </div>
      )}
      {/* Subjects info */}
      {s.subjects.length > 0 && (
        <div className="text-[22px] text-ink-tertiary font-body">
          {s.subjects.join(" + ")} today
        </div>
      )}
      <div className="text-[20px] text-status-success-fg font-body font-medium mt-2">
        Checked in
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
        Checked out
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
