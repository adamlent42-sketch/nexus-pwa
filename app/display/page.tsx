"use client";

import { useEffect, useState } from "react";

// -- Types -------------------------------------------------------------------

interface ActiveSession {
  id: string;
  studentId: string | null;
  studentName: string;
  checkInTime: string;
  minutesIn: number;
  streak: number;
  birthdayFlag: boolean;
  milestoneTriggered: number | null;
  observationAdded: boolean;
}

// -- Config ------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

// -- Helpers -----------------------------------------------------------------

function formatTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: true
  });
}

// Running clock display: "22:30" or "1:04:12"
function formatElapsedClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

function getEtTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: true
  });
}

function getEtDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York"
  });
}

// First name + last initial: "John R."
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// -- Component ---------------------------------------------------------------

export default function DisplayPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState({ time: getEtTime(), date: getEtDate() });
  const [tick, setTick] = useState(0); // second-level tick for running clocks

  // Fetch active sessions
  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/checkin/active", { cache: "no-store" });
      const json = await res.json() as { ok: boolean; data?: ActiveSession[] };
      if (json.ok && json.data) setSessions(json.data);
    } catch {
      // Silently continue -- TV stays showing last known data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const fetchTimer = setInterval(fetchSessions, REFRESH_INTERVAL_MS);
    return () => clearInterval(fetchTimer);
  }, []);

  // Second-level tick for running clocks; update display clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      setClock({ time: getEtTime(), date: getEtDate() });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  void tick; // used to trigger re-render every second

  const liveSessions = sessions.map((s) => ({
    ...s,
    elapsedSeconds: Math.floor((Date.now() - new Date(s.checkInTime).getTime()) / 1000)
  }));

  const hasBirthday = liveSessions.some((s) => s.birthdayFlag);
  const hasAnyone = liveSessions.length > 0;

  // Responsive columns: up to 4 columns for large groups
  const cols = liveSessions.length <= 2 ? liveSessions.length || 1
    : liveSessions.length <= 6 ? 3
    : 4;

  return (
    <div className="w-full h-full flex flex-col text-white" style={{ fontFamily: "var(--font-display, sans-serif)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10"
        style={{ background: "rgba(63,90,168,0.25)" }}>
        <div>
          <div className="text-[30px] font-black tracking-tight leading-none text-white">
            KUMON
          </div>
          <div className="text-[14px] text-white/50 mt-1">{clock.date}</div>
        </div>
        <div className="text-right">
          <div className="text-[44px] font-black leading-none">{clock.time}</div>
          {hasAnyone && (
            <div className="text-[14px] text-white/50 mt-1">
              {liveSessions.length} student{liveSessions.length !== 1 ? "s" : ""} working
            </div>
          )}
        </div>
      </div>

      {/* Birthday banner */}
      {hasBirthday && (
        <div className="text-center py-3 text-[20px] font-black tracking-wide"
          style={{ background: "linear-gradient(90deg, #e91e8c, #ff6b35)", color: "white" }}>
          🎂 Happy Birthday Week!
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : !hasAnyone ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-[64px]">🌟</div>
            <div className="text-[32px] font-black text-white/50">No students checked in yet</div>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {liveSessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Session Card ------------------------------------------------------------

function SessionCard({ session: s }: {
  session: ActiveSession & { elapsedSeconds: number }
}) {
  return (
    <div
      className="rounded-2xl px-6 py-5 flex flex-col gap-2"
      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      {/* Name */}
      <div className="font-black text-white leading-tight" style={{ fontSize: "clamp(22px, 2.5vw, 32px)" }}>
        {displayName(s.studentName)}
        {s.birthdayFlag && <span className="ml-2">🎂</span>}
      </div>

      {/* Running clock -- the main element */}
      <div
        className="font-black text-white tabular-nums leading-none"
        style={{ fontSize: "clamp(40px, 5vw, 64px)" }}
      >
        {formatElapsedClock(s.elapsedSeconds)}
      </div>

      {/* Check-in time */}
      <div className="text-white/40 text-[13px]">
        Since {formatTime(s.checkInTime)}
      </div>
    </div>
  );
}
