"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, RefreshCw, Flag, AlertTriangle, ArrowUpRight, ArrowDownRight, CalendarClock, UserX } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface FunnelStage { key: string; label: string; count: number; pctOfPrev: number | null }
interface ChannelRow { source: string; booked: number; attended: number; attendRate: number | null }
interface GrowthData {
  target: number;
  enrollments: number;
  gap: number;
  pctToTarget: number;
  studentCount: number;
  dualCount: number;
  mrr: number;
  targetMrr: number;
  billedMonthly: number | null;
  pendingStartStudents: number;
  pendingStartEnrollments: number;
  onBreakStudents: number;
  onBreakEnrollments: number;
  startedEnrollments: number;
  discontinuedEnrollments: number;
  netEnrollments: number;
  startedStudents: number;
  discontinuedStudents: number;
  monthsToTarget: number | null;
  monthLabel: string;
  funnel: FunnelStage[];
  funnelLeak: string | null;
  upcomingPos: number;
  noShowPos: number;
  channels: ChannelRow[];
  generatedAt: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function MomentumCard({
  icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub?: string;
  tone: "pos" | "neg" | "neutral" | "warn";
}) {
  const colors = {
    pos: "bg-status-success-bg border-status-success-fg/20 text-status-success-fg",
    neg: "bg-status-danger-bg border-status-danger-fg/20 text-status-danger-fg",
    neutral: "bg-surface-subtle border-line text-ink-secondary",
    warn: "bg-tint-notes-bg border-tint-notes-fg/20 text-tint-notes-fg",
  };
  const valColors = {
    pos: "text-status-success-fg",
    neg: "text-status-danger-fg",
    neutral: "text-ink",
    warn: "text-tint-notes-fg",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={colors[tone]}>{icon}</span>
        <p className="text-[12px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      </div>
      <p className={`text-[28px] font-semibold leading-none ${valColors[tone]}`}>{value}</p>
      {sub && <p className="text-[12px] mt-1.5 opacity-70">{sub}</p>}
    </div>
  );
}

export default function GrowthScoreboard() {
  const q = useQuery({
    queryKey: ["admin", "growth"],
    queryFn: () => adminFetch<GrowthData>("/api/admin/growth")
  });

  if (q.isPending) return <Skeleton rows={10} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const d = q.data;

  const netTone = d.netEnrollments > 0 ? "pos" : d.netEnrollments < 0 ? "neg" : undefined;
  const netStr = `${d.netEnrollments > 0 ? "+" : ""}${d.netEnrollments}`;
  const pace = d.monthsToTarget === null ? "Net flat / negative" : `~${d.monthsToTarget} mo`;
  const heldCount = d.funnel[0]?.count ?? 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand" />
          <div>
            <p className="text-[16px] font-medium leading-tight">Road to 225</p>
            <p className="text-[12px] text-ink-secondary mt-0.5">
              One enrollment = one subject. A student doing Math + Reading counts as 2.
            </p>
          </div>
        </div>
        <button onClick={() => q.refetch()} className="btn" disabled={q.isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          {q.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Hero: enrollment count + progress bar */}
      <div className="card card-body">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
          <div>
            <p className="text-[13px] text-ink-secondary mb-0.5">Active enrollments</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[48px] font-bold leading-none text-ink">{d.enrollments}</span>
              <span className="text-[20px] text-ink-tertiary font-medium">/ {d.target}</span>
            </div>
            <p className="text-[13px] text-ink-secondary mt-1">
              {d.studentCount} students · {d.dualCount} doing both subjects · {d.gap} to go
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-ink-secondary mb-0.5">Modeled MRR</p>
            <p className="text-[28px] font-semibold text-ink leading-none">{usd(d.mrr)}</p>
            <p className="text-[12px] text-ink-tertiary mt-1">target {usd(d.targetMrr)}</p>
          </div>
        </div>

        <div className="h-4 w-full rounded-full overflow-hidden bg-surface-subtle border border-line">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${d.pctToTarget}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[12px] text-ink-tertiary">{d.pctToTarget}% to goal</span>
          {d.billedMonthly !== null && (
            <span className="text-[12px] text-ink-tertiary">
              IN billing: {usd(d.billedMonthly)}/mo
              {d.mrr > 0 && <> ({Math.round((d.billedMonthly / d.mrr) * 100)}% of modeled)</>}
            </span>
          )}
        </div>
      </div>

      {/* Momentum indicators */}
      <div>
        <p className="text-[13px] font-medium text-ink-secondary uppercase tracking-wide mb-2">Momentum</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MomentumCard
            icon={<ArrowUpRight className="w-4 h-4" />}
            tone="pos"
            label="Confirmed starts"
            value={`+${d.pendingStartEnrollments}`}
            sub={`${d.pendingStartStudents} student${d.pendingStartStudents !== 1 ? "s" : ""} · start date locked`}
          />
          <MomentumCard
            icon={<ArrowDownRight className="w-4 h-4" />}
            tone={d.onBreakStudents > 0 ? "neg" : "neutral"}
            label="On planned break"
            value={d.onBreakStudents > 0 ? `−${d.onBreakEnrollments}` : "0"}
            sub={
              d.onBreakStudents > 0
                ? `${d.onBreakStudents} student${d.onBreakStudents !== 1 ? "s" : ""} paused`
                : "No one on break"
            }
          />
          <MomentumCard
            icon={<CalendarClock className="w-4 h-4" />}
            tone="neutral"
            label="Upcoming POs"
            value={`${d.upcomingPos}`}
            sub="scheduled, not yet held"
          />
          <MomentumCard
            icon={<UserX className="w-4 h-4" />}
            tone={d.noShowPos > 0 ? "warn" : "neutral"}
            label="No-show leads (90d)"
            value={`${d.noShowPos}`}
            sub="booked but didn't attend"
          />
        </div>
      </div>

      {/* Net flow this month */}
      <div className="card card-body">
        <p className="text-[15px] font-medium mb-3">Net flow — {d.monthLabel}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-surface-subtle p-3">
            <p className="text-[12px] text-ink-secondary">Started</p>
            <p className="text-[22px] font-semibold text-status-success-fg">+{d.startedEnrollments}</p>
            <p className="text-[11px] text-ink-tertiary">{d.startedStudents} student{d.startedStudents !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle p-3">
            <p className="text-[12px] text-ink-secondary">Discontinued</p>
            <p className="text-[22px] font-semibold text-status-danger-fg">−{d.discontinuedEnrollments}</p>
            <p className="text-[11px] text-ink-tertiary">{d.discontinuedStudents} student{d.discontinuedStudents !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle p-3">
            <p className="text-[12px] text-ink-secondary">Net this month</p>
            <p className={`text-[22px] font-semibold ${netTone === "pos" ? "text-status-success-fg" : netTone === "neg" ? "text-status-danger-fg" : "text-ink"}`}>
              {netStr}
            </p>
            <p className="text-[11px] text-ink-tertiary">enrollments</p>
          </div>
          <div className="rounded-lg bg-surface-subtle p-3">
            <p className="text-[12px] text-ink-secondary">Pace to 225</p>
            <p className="text-[22px] font-semibold text-ink">{pace}</p>
            <p className="text-[11px] text-ink-tertiary">at current net</p>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="card card-body">
        <p className="text-[15px] font-medium">This month&apos;s PO funnel — {d.monthLabel}</p>
        <p className="text-[12px] text-ink-secondary mb-3">
          Conversion on POs that have actually been held.
          {d.upcomingPos > 0 && ` ${d.upcomingPos} more PO${d.upcomingPos !== 1 ? "s" : ""} scheduled ahead — not counted yet.`}
        </p>
        {heldCount === 0 ? (
          <p className="text-[13px] text-ink-tertiary">
            {d.upcomingPos > 0
              ? `No POs held yet this month — ${d.upcomingPos} still coming.`
              : "No POs this month yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {d.funnel.map((s) => (
              <div key={s.key}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-ink-secondary">
                    {s.label}
                    {s.pctOfPrev !== null && (
                      <span className="text-ink-tertiary"> · {s.pctOfPrev}% of previous</span>
                    )}
                  </span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <div className="h-[22px] rounded overflow-hidden bg-surface-subtle">
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${Math.round((s.count / heldCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {d.funnelLeak && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-status-danger-bg p-2.5">
            <AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0 mt-0.5" />
            <span className="text-[13px] text-status-danger-fg">{d.funnelLeak}</span>
          </div>
        )}
      </div>

      {/* Channels */}
      <div className="card card-body">
        <p className="text-[15px] font-medium">Where bookings came from</p>
        <p className="text-[12px] text-ink-secondary mb-3">Last 90 days, by booking source.</p>
        {d.channels.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No POs in the last 90 days.</p>
        ) : (
          <div className="space-y-2.5">
            {d.channels.map((c) => (
              <div key={c.source}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-ink-secondary">{c.source}</span>
                  <span className="font-medium">
                    {c.booked} booked
                    {c.attendRate !== null && (
                      <span className="text-ink-tertiary font-normal"> · {c.attendRate}% attended</span>
                    )}
                  </span>
                </div>
                <div className="h-[18px] rounded overflow-hidden bg-surface-subtle">
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${Math.round((c.booked / d.channels[0].booked) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-start gap-2 rounded-md bg-tint-notes-bg p-2.5">
          <Flag className="w-4 h-4 text-tint-notes-fg shrink-0 mt-0.5" />
          <span className="text-[13px] text-tint-notes-fg">
            Add a &quot;how did you hear about us&quot; field on new POs and your monthly ad spend to unlock cost-per-enrollment by source.
          </span>
        </div>
      </div>

      <p className="text-[11px] text-ink-tertiary">Updated {new Date(d.generatedAt).toLocaleString("en-US")}</p>
    </div>
  );
}
