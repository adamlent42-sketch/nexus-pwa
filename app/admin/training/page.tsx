"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface Cell { status: string; score: number | null; total: number | null }
interface StaffRow { id: string; name: string; byModule: Record<string, Cell> }
interface Data { modules: { id: string; name: string }[]; staff: StaffRow[] }

const DOT: Record<string, string> = {
  Complete: "bg-status-success-bg text-status-success-fg",
  Incomplete: "bg-status-warn-bg text-status-warn-fg",
  "In Progress": "bg-status-info-bg text-status-info-fg",
  "Not started": "bg-surface-subtle text-ink-tertiary"
};

export default function AdminTrainingPage() {
  const q = useQuery({ queryKey: ["admin", "training"], queryFn: () => adminFetch<Data>("/api/admin/training") });
  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Training matrix</p>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">Who's completed what. Staff sorted by tier. A kid who passed shows their score.</p>

      {d.modules.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">No published modules yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left border-b border-line">
                <th className="px-3 py-2 font-medium sticky left-0 bg-surface">Staff</th>
                {d.modules.map((m) => <th key={m.id} className="px-3 py-2 font-medium whitespace-nowrap">{m.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.staff.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-surface">{s.name}</td>
                  {d.modules.map((m) => {
                    const c = s.byModule[m.id];
                    return (
                      <td key={m.id} className="px-3 py-2">
                        <span className={`badge ${DOT[c?.status] ?? "bg-surface-subtle text-ink-tertiary"}`}>
                          {c?.status === "Complete" && c.total ? `✓ ${c.score}/${c.total}` : c?.status ?? "Not started"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
