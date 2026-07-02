"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ArrowRight } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

interface Row { id: string; name: string; stage: string; bucket: string; missing: string[] }
interface Data { count: number; rows: Row[] }

const BUCKET_TONE: Record<string, string> = {
  Active: "bg-status-success-bg text-status-success-fg",
  "Pending start": "bg-status-info-bg text-status-info-fg",
  Lead: "bg-surface-subtle text-ink-secondary"
};

export default function MissingDataPage() {
  const q = useQuery({ queryKey: ["admin", "missing-data"], queryFn: () => adminFetch<Data>("/api/admin/students-missing-data") });

  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Students missing data</p>
        {d.count > 0 && <span className="badge bg-status-warn-bg text-status-warn-fg ml-1">{d.count}</span>}
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">
        Required fields are stage-aware — <span className="font-medium">Active</span>: subjects, grade, class days, pickup day, levels · <span className="font-medium">Pending start</span>: subjects, grade, class days, first-class date, starting levels · <span className="font-medium">Lead</span>: parent email. Click a student to fix it.
      </p>

      {d.count === 0 ? (
        <EmptyState icon={<ClipboardList className="w-5 h-5" />} message="Every student has their required fields. Nice." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-line">
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Missing</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${BUCKET_TONE[r.bucket] ?? "bg-surface-subtle text-ink-secondary"}`}>{r.stage}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {r.missing.map((m) => (
                        <span key={m} className="badge bg-status-warn-bg text-status-warn-fg">{m}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={{ pathname: "/admin/students", query: { id: r.id, name: r.name } }}
                      className="btn text-[12px] inline-flex"
                      title="Open in Student Manager to fill in"
                    >
                      Fix <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
