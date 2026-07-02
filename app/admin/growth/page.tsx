"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, RefreshCw, Flag, AlertTriangle } from "lucide-react";
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
  channels: ChannelRow[];
  generatedAt: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  const valColor = tone === "pos" ? "text-status-success-fg" : tone === "neg" ? "text-status-danger-fg" : "";
  return (
    <div className="rounded-lg bg-surface-subtle p-4">
      <p className="text-[13px] text-ink-secondary">{label}</p>
      <p className={`text-[24px] font-semibold leading-tight mt-0.5 ${valColor}`}>{value}</p>
      {sub && <p className="text-[12px] text-ink-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

export default function GrowthScoreboard() {
  const q = useQuery({
    queryKey: ["admin", "growth"],
    queryFn: () => adminFetch<GrowthData>("/api/admin/growth")
  });

  if (q.isPending) return <Skeleton rows={8} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const d = q.data;

  const netTone = d.netEnrollments > 0 ? "pos" : d.netEnrollments < 0 ? "neg" : undefined;
  const netStr = `${d.netEnrollments > 0 ? "+" : ""}${d.netEnrollments}`;
  const pace = d.monthsToTarget === null
    ? "Net flat/negative"
    : `~${d.monthsToTarget} mo`;
  const heldCount = d.funnel[0]?.count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand" />
          <div>
            <p className="text-[16px] font-medium leading-tight">Road to 225</p>
            <p className="text-[12px] text-ink-secondary mt-0.5">
              Active enrollments vs the 225 goal, this month&apos;s net flow and conversion funnel, and where bookings come from. One enrollment = one subject; a dual-subject kid counts twice.
            </p>
          </div>
        </div>
        <button onClick={() => q.refetch()} className="btn" disabled={q.isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> {q.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Active enrollments" value={`${d.enrollments}`} sub={`${d.studentCount} students · ${d.dualCount} doing both`} />
        <Metric label="Gap to 225" value={`${d.gap}`} sub={`${d.pctToTarget}% of the way there`} />
        <Metric label={`Net this month (${d.monthLabel})`} value={netStr} sub={`${d.startedEnrollments} started · ${d.discontinuedEnrollments} left`} tone={netTone} />
        <Metric label="Pace to 225" value={pace} sub={d.monthsToTarget === null ? "grow net to project a date" : "at current monthly net"} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[13px] text-ink-secondary mb-1.5">
          <span>{d.enrollments} of {d.target} enrollments · {usd(d.mrr)} of {usd(d.targetMrr)} modeled MRR</span>
          <span className="font-medium text-ink">{d.pctToTarget}%</span>
        </div>
        <div className="h-3.5 w-full rounded overflow-hidden bg-surface-subtle border border-line">
          <div className="h-full bg-brand" style={{ width: `${d.pctToTarget}%` }} />
        </div>
        {d.billedMonthly !== null && (
          <p className="text-[12px] text-ink-tertiary mt-1.5">
            Invoice Ninja: {usd(d.billedMonthly)}/mo in active recurring billings
            {d.mrr > 0 && <> · {Math.round((d.billedMonthly / d.mrr) * 100)}% of modeled</>}
          </p>
        )}
      </div>

      {/* Funnel */}
      <div className="card card-body">
        <p className="text-[15px] font-medium">This month&apos;s funnel — {d.monthLabel}</p>
        <p className="text-[12px] text-ink-secondary mb-3">Conversion on POs that have actually been held. Future-dated POs are still upcoming and aren&apos;t counted here.</p>
        {heldCount === 0 ? (
          <p className="text-[13px] text-ink-tertiary">
            {d.upcomingPos > 0
              ? `No POs held yet this month — ${d.upcomingPos} still scheduled ahead.`
              : "No POs dated this month yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {d.funnel.map((s) => (
              <div key={s.key}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-ink-secondary">
                    {s.label}
                    {s.pctOfPrev !== null && <span className="text-ink-tertiary"> · {s.pctOfPrev}% of previous</span>}
                  </span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <div className="h-[22px] rounded overflow-hidden bg-surface-subtle">
                  <div className="h-full bg-brand" style={{ width: `${Math.round((s.count / heldCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {d.upcomingPos > 0 && heldCount > 0 && (
          <p className="text-[12px] text-ink-tertiary mt-2">+{d.upcomingPos} PO{d.upcomingPos === 1 ? "" : "s"} booked for later this month — not yet held, so not in the conversion above.</p>
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
        <p className="text-[12px] text-ink-secondary mb-3">Last 90 days, by booking source. Attach marketing spend per source to turn this into true cost-per-start.</p>
        {d.channels.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No POs in the last 90 days.</p>
        ) : (
          <div className="space-y-2.5">
            {d.channels.map((c) => (
              <div key={c.source}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-ink-secondary">{c.source}</span>
                  <span className="font-medium">{c.booked} booked{c.attendRate !== null && <span className="text-ink-tertiary font-normal"> · {c.attendRate}% attended</span>}</span>
                </div>
                <div className="h-[18px] rounded overflow-hidden bg-surface-subtle">
                  <div className="h-full bg-brand" style={{ width: `${Math.round((c.booked / d.channels[0].booked) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-start gap-2 rounded-md bg-tint-notes-bg p-2.5">
          <Flag className="w-4 h-4 text-tint-notes-fg shrink-0 mt-0.5" />
          <span className="text-[13px] text-tint-notes-fg">Add a &quot;how did you hear about us&quot; field on new POs and your monthly ad spend to unlock cost-per-enrollment by source.</span>
        </div>
      </div>

      <p className="text-[11px] text-ink-tertiary">Updated {new Date(d.generatedAt).toLocaleString("en-US")}</p>
    </div>
  );
}
