"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ClassRosterStudent } from "@/app/api/admin/class-roster/route";

type ClassDay = "Monday" | "Thursday" | "Saturday";

const CLASS_DAYS: ClassDay[] = ["Monday", "Thursday", "Saturday"];

export function ClassDayRoster() {
  const [day, setDay] = useState<ClassDay>("Monday");

  const q = useQuery({
    queryKey: ["admin", "class-roster", day],
    queryFn: () => adminFetch<ClassRosterStudent[]>(`/api/admin/class-roster?day=${day}`),
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Class day roster</p>
        {q.data && (
          <span className="badge bg-surface-subtle text-ink-tertiary">{q.data.length} students</span>
        )}
      </div>
      <p className="text-[13px] text-ink-secondary mb-3">
        All active students scheduled for a given class day.
      </p>

      {/* Day selector */}
      <div className="flex gap-2 mb-4">
        {CLASS_DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              day === d
                ? "bg-brand text-white"
                : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {q.isPending && <Skeleton rows={5} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      {q.data && q.data.length === 0 && (
        <p className="text-[13px] text-ink-tertiary py-4 text-center">
          No active students scheduled for {day}.
        </p>
      )}

      {q.data && q.data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-subtle">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                  Student
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide w-16">
                  Grade
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide w-24">
                  Math level
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide w-28">
                  Reading level
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-surface-subtle last:border-0 ${
                    i % 2 === 0 ? "" : "bg-surface-subtle/40"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-ink">{s.name}</span>
                    {s.subjects.length > 0 && (
                      <span className="ml-2 text-[11px] text-ink-tertiary">
                        {s.subjects.join(" + ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">
                    {s.grade ? `Gr. ${s.grade}` : <span className="text-ink-tertiary">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {s.mathLevel ? (
                      <span className="font-mono text-[12px] text-ink">{s.mathLevel}</span>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {s.readingLevel ? (
                      <span className="font-mono text-[12px] text-ink">{s.readingLevel}</span>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
