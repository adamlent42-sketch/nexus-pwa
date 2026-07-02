"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTodaysPOs,
  useActiveAlerts,
  useTodaysStaff,
  useNewStudents
} from "@/lib/queries";
import { todayInET } from "@/lib/time";

export function StatCards() {
  const pos = useTodaysPOs();
  const alerts = useActiveAlerts();
  const staff = useTodaysStaff();
  const students = useNewStudents();

  const today = todayInET();
  // The PO queue includes backlog + today + upcoming. Count each bucket
  // separately so the headline matches what the label promises.
  const posToday = pos.data?.filter((p) => (p.date ?? today) === today).length ?? 0;
  const posUpcoming = pos.data?.filter((p) => (p.date ?? today) > today).length ?? 0;
  const posOverdue = pos.data?.filter((p) => p.isOverdueRecap).length ?? 0;
  const posSub = pos.data
    ? [posOverdue > 0 && `${posOverdue} to recap`, posUpcoming > 0 && `${posUpcoming} upcoming`]
        .filter(Boolean).join(" · ") || "all set"
    : "—";

  const staffIn = staff.data?.filter((s) => !s.isOut).length ?? 0;
  const staffOut = staff.data?.filter((s) => s.isOut).length ?? 0;

  const alertsCount = alerts.data?.length;

  const todayCount = students.data?.startingToday.length ?? 0;
  const watchCount =
    (students.data?.plannedThisWeek.length ?? 0) +
    (students.data?.firstMonthWatch.length ?? 0);
  const studentsTotal = students.data ? todayCount + watchCount : undefined;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <Stat
        label="POs today"
        value={pos.data ? posToday : undefined}
        sub={posSub}
        subTone={posOverdue > 0 ? "danger" : "muted"}
        loading={pos.isPending}
        onClick={() => document.getElementById("todays-pos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        title="Jump to today's POs"
      />
      <Stat
        label="Staff today"
        value={staff.data ? staffIn : undefined}
        sub={staff.data ? (staffOut > 0 ? `${staffOut} out` : "all in") : "—"}
        subTone="muted"
        loading={staff.isPending}
        onClick={() => document.getElementById("todays-staff")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        title="Jump to today's staff"
      />
      <Stat
        label="Active alerts"
        value={alertsCount}
        sub={alertsCount === 0 ? "all clear" : `${alertsCount} open`}
        subTone="muted"
        loading={alerts.isPending}
        onClick={() => document.getElementById("active-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        title="Jump to active alerts"
      />
      <Stat
        label="New students"
        value={studentsTotal}
        sub={studentsTotal != null ? `${todayCount} today · ${watchCount} watch` : "—"}
        subTone="muted"
        loading={students.isPending}
        onClick={() => document.getElementById("recently-started")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        title="Jump to new students"
      />
    </div>
  );
}

interface StatProps {
  label: string;
  value: number | undefined;
  sub: string;
  subTone: "danger" | "muted";
  loading: boolean;
  onClick?: () => void;
  title?: string;
}

function Stat({ label, value, sub, subTone, loading, onClick, title }: StatProps) {
  const inner = (
    <>
      <div>
        <p className="text-[13px] text-ink-secondary mb-1.5">{label}</p>
        <p className="text-[28px] font-display font-bold leading-none">
          {loading ? "…" : value ?? "—"}
        </p>
        <p
          className={cn(
            "text-[12px] mt-2",
            subTone === "danger" ? "text-status-danger-fg" : "text-ink-secondary"
          )}
        >
          {sub}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-ink-tertiary mt-0.5" />
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="stat-card flex items-start justify-between text-left w-full hover:border-brand transition-colors" title={title}>
        {inner}
      </button>
    );
  }
  return <div className="stat-card flex items-start justify-between">{inner}</div>;
}
