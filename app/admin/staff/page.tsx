"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Plus } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffEditor, type StaffRecord } from "@/components/admin/StaffEditor";
import { AddStaffForm } from "@/components/admin/AddStaffForm";
import { CoverageView } from "@/components/admin/CoverageView";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cls =
    status === "Active" ? "bg-status-success-bg text-status-success-fg"
    : status === "Departing" ? "bg-status-warning-bg text-status-warning-fg"
    : "bg-surface-muted text-ink-tertiary";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function ShiftSummary({ shifts }: { shifts: StaffRecord["shifts"] }) {
  if (shifts.length === 0) return <span className="text-ink-tertiary">No shifts</span>;
  return (
    <>
      {shifts.map((s, i) => (
        <span key={s.id}>
          {i > 0 && <span className="text-ink-tertiary"> · </span>}
          <span className="text-ink">{(s.dayOfWeek ?? "?").slice(0, 3)}</span>
          {(s.startTime || s.endTime) && (
            <span className="text-ink-secondary"> {s.startTime ?? ""}{s.startTime && s.endTime ? "–" : ""}{s.endTime ?? ""}</span>
          )}
          {s.role.length > 0 && <span className="text-ink-tertiary"> ({s.role.join("/")})</span>}
        </span>
      ))}
    </>
  );
}

export default function StaffAdminPage() {
  // Track only the staff ID — derive the live record from the query each
  // render so newly added/updated shifts appear in the editor without closing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"roster" | "coverage">("roster");

  const q = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => adminFetch<StaffRecord[]>("/api/admin/staff")
  });

  const toggle = (
    <div className="flex gap-1 mb-4">
      <button onClick={() => setView("roster")} className={`btn ${view === "roster" ? "btn-primary" : ""}`}>Roster</button>
      <button onClick={() => setView("coverage")} className={`btn ${view === "coverage" ? "btn-primary" : ""}`}>Coverage by day</button>
    </div>
  );

  if (view === "coverage") {
    return <div>{toggle}<CoverageView /></div>;
  }

  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;

  const editing = editingId ? q.data.find((s) => s.id === editingId) ?? null : null;

  // Group: Active first, then Departing, then Departed.
  const active = q.data.filter((s) => s.status === "Active");
  const departing = q.data.filter((s) => s.status === "Departing");
  const departed = q.data.filter((s) => s.status === "Departed");

  return (
    <div>
      {toggle}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-ink-secondary">
          {active.length} active · {departing.length} departing · {departed.length} departed. Click any row to edit details + weekly shifts.
        </p>
        <button onClick={() => setAdding(true)} className="btn btn-primary">
          <Plus className="w-3.5 h-3.5" /> Add staff
        </button>
      </div>

      {q.data.length === 0 && (
        <EmptyState icon={<Users className="w-5 h-5" />} message="No staff on file yet." />
      )}

      {[
        { label: "Active", rows: active },
        { label: "Departing", rows: departing },
        { label: "Departed", rows: departed }
      ].map(({ label, rows }) =>
        rows.length === 0 ? null : (
          <div key={label} className="mb-6">
            <p className="text-[12px] uppercase tracking-wide text-ink-tertiary mb-2">{label}</p>
            <div className="space-y-1.5">
              {rows.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setEditingId(s.id)}
                  className="w-full text-left card card-body hover:bg-surface-muted transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium leading-tight flex items-center gap-2">
                      {s.name}
                      {s.tier && <span className="badge bg-tint-purple-bg text-tint-purple-fg">T{s.tier}</span>}
                      <StatusBadge status={s.status} />
                    </p>
                    <p className="meta mt-1 truncate">
                      <ShiftSummary shifts={s.shifts} />
                    </p>
                    {(s.email || s.phone) && (
                      <p className="text-[11px] text-ink-tertiary mt-0.5 truncate">
                        {s.email}{s.email && s.phone ? " · " : ""}{s.phone}
                        {s.primaryRoles.length > 0 && <> · {s.primaryRoles.join("/")}</>}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      <StaffEditor open={!!editing} onClose={() => setEditingId(null)} staff={editing} />
      <AddStaffForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
