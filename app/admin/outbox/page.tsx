"use client";

import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface Row {
  id: string; job: string; type: string; status: string;
  trigger: string | null; error: string | null; draftedAt: string | null;
  createdTime: string | null; stuck: boolean;
}
interface OutboxData {
  health: "green" | "red";
  counts: Record<string, number>;
  stuck: number;
  draftedToday: number;
  rows: Row[];
}

const STATUS_TONE: Record<string, string> = {
  Pending: "bg-status-warn-bg text-status-warn-fg",
  Drafting: "bg-status-info-bg text-status-info-fg",
  Drafted: "bg-status-success-bg text-status-success-fg",
  Sent: "bg-status-success-bg text-status-success-fg",
  Failed: "bg-status-danger-bg text-status-danger-fg",
  Skipped: "bg-surface-subtle text-ink-secondary"
};

export default function OutboxPage() {
  const q = useQuery({ queryKey: ["admin", "outbox"], queryFn: () => adminFetch<OutboxData>("/api/admin/outbox") });

  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Inbox className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Email Outbox</p>
        <span className={`badge ml-1 ${d.health === "green" ? "bg-status-success-bg text-status-success-fg" : "bg-status-danger-bg text-status-danger-fg"}`}>
          {d.health === "green" ? "✓ Healthy" : "🔴 Needs attention"}
        </span>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">Every intended parent email, queued and drafted by the worker. A red status here is the early warning the watchdog also emails you.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Tile label="Pending" value={d.counts.Pending ?? 0} />
        <Tile label="Drafted today" value={d.draftedToday} />
        <Tile label="Failed" value={d.counts.Failed ?? 0} alert={(d.counts.Failed ?? 0) > 0} />
        <Tile label="Stuck >4h" value={d.stuck} alert={d.stuck > 0} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-ink-secondary border-b border-line">
              <th className="px-3 py-2 font-medium">Job</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-secondary">Queue is empty.</td></tr>
            )}
            {d.rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="px-3 py-2">{r.job}</td>
                <td className="px-3 py-2 text-ink-secondary">{r.type}</td>
                <td className="px-3 py-2">
                  <span className={`badge ${STATUS_TONE[r.status] ?? "bg-surface-subtle text-ink-secondary"}`}>{r.status}</span>
                  {r.stuck && <span className="ml-1 badge bg-status-danger-bg text-status-danger-fg">stuck</span>}
                </td>
                <td className="px-3 py-2 text-ink-tertiary">{r.trigger ?? "—"}</td>
                <td className="px-3 py-2 text-ink-tertiary">
                  {r.status === "Failed" && r.error ? <span className="text-status-danger-fg">{r.error}</span>
                    : r.status === "Skipped" && r.error ? r.error
                    : r.draftedAt ? `drafted ${r.draftedAt}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`card card-body ${alert ? "ring-1 ring-status-danger-fg" : ""}`}>
      <p className="text-[12px] text-ink-secondary">{label}</p>
      <p className={`text-[22px] font-semibold ${alert ? "text-status-danger-fg" : ""}`}>{value}</p>
    </div>
  );
}
