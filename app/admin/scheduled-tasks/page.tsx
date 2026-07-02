"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Mail, ListChecks, Inbox, FileSpreadsheet, Power, AlertCircle, CheckCircle2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface ScheduledTaskRow {
  taskId: string;
  label: string;
  description: string;
  schedule: string;
  enabled: boolean;
  category: "po" | "outreach" | "drafts" | "ingest" | "hygiene" | "other";
  pendingCountSource?: string;
  pendingCount: number | null;
  lastSeenAt: string | null;
  hoursSinceLastSeen: number | null;
  expectedIntervalHours: number;
  health: "ok" | "overdue" | "stale" | "unknown";
}

const CATEGORIES: { key: string; label: string; icon: React.ReactNode; tone: string }[] = [
  { key: "drafts",   label: "Draft generators",     icon: <Mail className="w-4 h-4" />,           tone: "text-brand" },
  { key: "po",       label: "PO lifecycle watchers", icon: <ListChecks className="w-4 h-4" />,    tone: "text-tint-pos-sub" },
  { key: "outreach", label: "Outreach",              icon: <Mail className="w-4 h-4" />,           tone: "text-tint-purple-sub" },
  { key: "hygiene",  label: "Comms + hygiene",       icon: <Inbox className="w-4 h-4" />,          tone: "text-ink-secondary" },
  { key: "ingest",   label: "KSIS + ingest",         icon: <FileSpreadsheet className="w-4 h-4" />, tone: "text-tint-notes-sub" },
  { key: "other",    label: "Legacy / disabled",     icon: <Power className="w-4 h-4" />,          tone: "text-ink-tertiary" }
];

function healthDot(health: ScheduledTaskRow["health"]): { dot: string; label: string } {
  switch (health) {
    case "ok": return { dot: "bg-status-success-fg", label: "Healthy" };
    case "overdue": return { dot: "bg-status-warn-fg", label: "Overdue" };
    case "stale": return { dot: "bg-status-danger-fg", label: "Stale — check it" };
    default: return { dot: "bg-ink-tertiary", label: "Unknown" };
  }
}

function humanHours(h: number | null): string {
  if (h === null) return "never";
  if (h === 0) return "<1h ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ScheduledTasksPage() {
  const q = useQuery({
    queryKey: ["admin", "scheduled-tasks"],
    queryFn: () => adminFetch<ScheduledTaskRow[]>("/api/admin/scheduled-tasks")
  });

  const byCategory = useMemo(() => {
    if (!q.data) return {} as Record<string, ScheduledTaskRow[]>;
    const out: Record<string, ScheduledTaskRow[]> = {};
    for (const t of q.data) {
      (out[t.category] ??= []).push(t);
    }
    return out;
  }, [q.data]);

  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const enabledCount = q.data?.filter((t) => t.enabled).length ?? 0;
  const totalPending = q.data?.reduce((sum, t) => sum + (t.pendingCount ?? 0), 0) ?? 0;
  const stale = q.data?.filter((t) => t.health === "stale").length ?? 0;
  const overdue = q.data?.filter((t) => t.health === "overdue").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-ink-secondary">
          Every Claude scheduled task that powers Kumon ops. Tasks run on Adam's machine; this page shows their cadence, health, and queued work.
        </p>
        <p className="text-[12px] text-ink-tertiary mt-1">
          {enabledCount} enabled · {totalPending} item{totalPending === 1 ? "" : "s"} waiting
          {stale > 0 && <> · <span className="text-status-danger-fg font-medium">{stale} stale</span></>}
          {overdue > 0 && <> · <span className="text-status-warn-fg font-medium">{overdue} overdue</span></>}
        </p>
      </div>

      {CATEGORIES.map((cat) => {
        const tasks = byCategory[cat.key];
        if (!tasks || tasks.length === 0) return null;
        return (
          <section key={cat.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cat.tone}>{cat.icon}</span>
              <h3 className="text-[14px] font-medium">{cat.label}</h3>
              <span className="text-[12px] text-ink-tertiary">{tasks.length}</span>
            </div>
            <div className="space-y-2">
              {tasks.map((t) => <TaskRow key={t.taskId} t={t} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({ t }: { t: ScheduledTaskRow }) {
  const showPending = t.pendingCount !== null;
  const hasWork = showPending && (t.pendingCount ?? 0) > 0;
  const { dot, label: healthLabel } = healthDot(t.health);
  return (
    <div className={`card card-body flex items-start justify-between gap-3 ${t.enabled ? "" : "opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium leading-tight flex items-center gap-2 flex-wrap">
          <span
            className={`inline-block w-2 h-2 rounded-full ${dot}`}
            title={healthLabel}
          />
          {t.label}
          {!t.enabled && <span className="badge bg-surface-muted text-ink-tertiary">Disabled</span>}
          {hasWork && (
            <span className="badge bg-status-warn-bg text-status-warn-fg">
              {t.pendingCount} waiting
            </span>
          )}
          {showPending && !hasWork && (
            <span className="badge bg-status-success-bg text-status-success-fg">
              <CheckCircle2 className="w-3 h-3 inline-block mr-0.5" /> Queue clear
            </span>
          )}
          {t.health === "stale" && (
            <span className="badge bg-status-danger-bg text-status-danger-fg">Stale — check it</span>
          )}
          {t.health === "overdue" && (
            <span className="badge bg-status-warn-bg text-status-warn-fg">Overdue</span>
          )}
        </p>
        <p className="text-[13px] text-ink-secondary mt-1">{t.description}</p>
        <p className="text-[12px] text-ink-tertiary mt-1 inline-flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {t.schedule}
          </span>
          {t.enabled && (
            <span>Last seen: {humanHours(t.hoursSinceLastSeen)}</span>
          )}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <button
          className="btn"
          title="Triggering a manual run isn't wired up yet — open the scheduled-tasks runner on Adam's machine to force it."
          onClick={() => alert(
            `To run "${t.taskId}" right now:\n\n` +
            `1. Open the scheduled-tasks runner on Adam's machine.\n` +
            `2. Find the task and click "Run now."\n\n` +
            `A direct trigger from this page via Airtable checkbox is on the roadmap.`
          )}
        >
          <AlertCircle className="w-3.5 h-3.5" /> Run now
        </button>
      </div>
    </div>
  );
}
