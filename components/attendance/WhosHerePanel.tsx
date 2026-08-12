"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Eye, AlertTriangle, BookOpen } from "lucide-react";
import { ObservationModal } from "./ObservationModal";
import { Skeleton } from "@/components/ui/Skeleton";

// -- Types -------------------------------------------------------------------

export interface ActiveSession {
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

// Staff-side color thresholds (kids never see this panel)
const WARN_MIN = 45;
const ALARM_MIN = 75;

// -- Helpers -----------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: true
  });
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function statusBadge(minutes: number) {
  if (minutes >= ALARM_MIN) return "badge bg-status-danger-bg text-status-danger-fg";
  if (minutes >= WARN_MIN) return "badge bg-status-warning-bg text-status-warning-fg";
  return "badge bg-status-success-bg text-status-success-fg";
}

// -- Component ---------------------------------------------------------------

interface WhosHerePanelProps {
  pollMs?: number;
}

export function WhosHerePanel({ pollMs = 30_000 }: WhosHerePanelProps) {
  const [observing, setObserving] = useState<ActiveSession | null>(null);

  const q = useQuery<ActiveSession[]>({
    queryKey: ["checkin", "active"],
    queryFn: async () => {
      const res = await fetch("/api/checkin/active", { cache: "no-store" });
      const json = await res.json() as { ok: boolean; data?: ActiveSession[] };
      if (!json.ok) throw new Error("Failed to load active sessions");
      return json.data ?? [];
    },
    refetchInterval: pollMs
  });

  // Live elapsed -- recompute from check-in timestamp (not cached server value)
  const sessions = (q.data ?? []).map((s) => ({
    ...s,
    minutesIn: Math.round((Date.now() - new Date(s.checkInTime).getTime()) / 60_000)
  }));

  return (
    <>
      <div className="card card-body space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="sec-title flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Who&apos;s Here Now
          </h2>
          {q.isFetching && (
            <span className="meta-sm text-ink-tertiary animate-pulse">Refreshing...</span>
          )}
        </div>

        {/* Content */}
        {q.isPending ? (
          <Skeleton rows={3} />
        ) : q.isError ? (
          <p className="text-[13px] text-status-danger-fg">{q.error.message}</p>
        ) : sessions.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No students checked in right now.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onObserve={() => setObserving(s)}
              />
            ))}
          </div>
        )}

        <p className="meta-sm text-ink-tertiary">Auto-refreshes every {Math.round(pollMs / 1000)}s</p>
      </div>

      {/* Observation modal */}
      {observing && (
        <ObservationModal
          session={observing}
          onClose={() => setObserving(null)}
          onSaved={() => {
            setObserving(null);
            q.refetch();
          }}
        />
      )}
    </>
  );
}

// -- Session Row -------------------------------------------------------------

function SessionRow({
  session: s,
  onObserve
}: {
  session: ActiveSession & { minutesIn: number };
  onObserve: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-surface-subtle last:border-0">
      {/* Name + flags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-medium">{s.studentName}</span>
          {s.birthdayFlag && <span className="text-[13px]">🎂</span>}
          {s.milestoneTriggered && (
            <span className="badge bg-yellow-100 text-yellow-800">🏆 {s.milestoneTriggered}wk</span>
          )}
          {s.observationAdded && (
            <span className="meta-sm text-status-success-fg flex items-center gap-0.5">
              <Eye className="w-3 h-3" /> logged
            </span>
          )}
        </div>
        <p className="meta-sm text-ink-tertiary">In at {formatTime(s.checkInTime)}</p>
      </div>

      {/* Elapsed time badge */}
      <span className={statusBadge(s.minutesIn)}>
        {s.minutesIn >= ALARM_MIN && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
        {formatElapsed(s.minutesIn)}
      </span>

      {/* Add observation button */}
      <button
        className="btn flex items-center gap-1 shrink-0"
        title="Add observation"
        onClick={onObserve}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-[12px]">Observe</span>
      </button>
    </div>
  );
}
