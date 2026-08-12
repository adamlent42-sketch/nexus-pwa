"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ArrowRight, CheckCircle2, Maximize2, MessageSquare } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LogConversationModal } from "@/components/forms/LogConversationModal";
import { ClassDayRoster } from "@/components/admin/ClassDayRoster";
import type { MonthStat } from "@/app/api/admin/monthly-stats/route";
import type { EnrollmentReportStat } from "@/app/api/admin/enrollment-report/route";

interface Item { key: string; label: string; count: number; tone: "red" | "yellow" | "green"; href: string; hint?: string }
interface AttentionData { items: Item[]; redCount: number; yellowCount: number; allClear: boolean }

const DOT: Record<string, string> = { red: "bg-status-danger-fg", yellow: "bg-status-warn-fg", green: "bg-status-success-fg" };
const COUNT_BADGE: Record<string, string> = {
  red: "bg-status-danger-bg text-status-danger-fg",
  yellow: "bg-status-warn-bg text-status-warn-fg",
  green: "bg-surface-subtle text-ink-tertiary"
};

// ─── Mini SVG Bar Chart ──────────────────────────────────────────────────────

interface BarSeries { label: string; color: string; values: number[] }

function BarChart({ months, series, showValues, chartHeight }: { months: string[]; series: BarSeries[]; showValues?: boolean; chartHeight?: number }) {
  const W = 480;
  const H = chartHeight ?? 120;
  const PAD = { top: showValues ? 20 : 8, right: 8, bottom: 28, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = months.length;
  const groupW = innerW / n;
  const barW = Math.max(3, Math.min(10, (groupW * 0.7) / series.length));

  const allVals = series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allVals);

  const gridMax = Math.ceil(maxVal / 5) * 5 || 5;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * gridMax));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "inherit" }}>
      {gridLines.map((v) => {
        const y = PAD.top + innerH - (v / gridMax) * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="currentColor" fillOpacity="0.4">{v}</text>
          </g>
        );
      })}
      {months.map((label, gi) => {
        const cx = PAD.left + (gi + 0.5) * groupW;
        const totalBarW = series.length * barW + (series.length - 1) * 2;
        return (
          <g key={label}>
            {(n <= 8 || gi % 2 === 0) && (
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="7.5" fill="currentColor" fillOpacity="0.5">
                {label}
              </text>
            )}
            {series.map((s, si) => {
              const bx = cx - totalBarW / 2 + si * (barW + 2);
              const bh = Math.max(1, (s.values[gi] / gridMax) * innerH);
              const by = PAD.top + innerH - bh;
              return (
                <g key={si}>
                  <rect x={bx} y={by} width={barW} height={bh} fill={s.color} rx="1" opacity="0.85">
                    <title>{s.label}: {s.values[gi]}</title>
                  </rect>
                  {showValues && s.values[gi] > 0 && (
                    <text x={bx + barW / 2} y={by - 3} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity="0.75">
                      {s.values[gi]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function ConversionLine({ months, values }: { months: string[]; values: (number | null)[] }) {
  const W = 480;
  const H = 60;
  const PAD = { top: 8, right: 8, bottom: 20, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = months.length;
  const maxPct = 100;

  const pts = values.map((v, i) => {
    const x = PAD.left + (i + 0.5) * (innerW / n);
    const y = v != null ? PAD.top + innerH - (v / maxPct) * innerH : null;
    return { x, y, v };
  });

  const pathParts: string[] = [];
  let inLine = false;
  for (const p of pts) {
    if (p.y == null) { inLine = false; continue; }
    if (!inLine) { pathParts.push(`M ${p.x} ${p.y}`); inLine = true; }
    else pathParts.push(`L ${p.x} ${p.y}`);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "inherit" }}>
      {[0, 50, 100].map((v) => {
        const y = PAD.top + innerH - (v / maxPct) * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="currentColor" fillOpacity="0.4">{v}%</text>
          </g>
        );
      })}
      {pathParts.length > 0 && (
        <path d={pathParts.join(" ")} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {pts.map((p, i) => p.y != null && (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#3B82F6">
          <title>Conversion: {p.v}%</title>
        </circle>
      ))}
      {months.map((label, i) => (
        (n <= 8 || i % 2 === 0) && (
          <text key={label} x={PAD.left + (i + 0.5) * (innerW / n)} y={H - 4} textAnchor="middle" fontSize="7.5" fill="currentColor" fillOpacity="0.5">
            {label}
          </text>
        )
      ))}
    </svg>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminHome() {
  const attention = useQuery({
    queryKey: ["admin", "attention"],
    queryFn: () => adminFetch<AttentionData>("/api/admin/attention")
  });
  const stats = useQuery({
    queryKey: ["admin", "monthly-stats"],
    queryFn: () => adminFetch<MonthStat[]>("/api/admin/monthly-stats")
  });
  const enrollment = useQuery({
    queryKey: ["admin", "enrollment-report"],
    queryFn: () => adminFetch<EnrollmentReportStat[]>("/api/admin/enrollment-report")
  });

  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [logConvOpen, setLogConvOpen] = useState(false);

  const d = attention.data;
  const order = { red: 0, yellow: 1, green: 2 } as const;
  const active = (d?.items ?? []).filter((i) => i.count > 0).sort((a, b) => order[a.tone] - order[b.tone]);
  const clear = (d?.items ?? []).filter((i) => i.count === 0);

  const months = stats.data?.map((s) => s.label) ?? [];
  const posScheduled = stats.data?.map((s) => s.posScheduled) ?? [];
  const posAttended = stats.data?.map((s) => s.posAttended) ?? [];
  const enrollments = stats.data?.map((s) => s.enrollments) ?? [];
  const conversion = stats.data?.map((s) => s.conversionPct) ?? [];

  const reportBMonths = enrollment.data?.map((s) => s.label) ?? [];
  const reportBMath = enrollment.data?.map((s) => s.math) ?? [];
  const reportBReading = enrollment.data?.map((s) => s.reading) ?? [];
  const reportBTotal = enrollment.data?.map((s) => s.total) ?? [];

  return (
    <div className="space-y-6">

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setLogConvOpen(true)}
          className="btn inline-flex items-center gap-2 text-[13px]"
        >
          <MessageSquare className="w-4 h-4" />
          Log a conversation
        </button>
      </div>

      <LogConversationModal open={logConvOpen} onClose={() => setLogConvOpen(false)} />

      {/* ── Charts row: POs trend + Report B side by side ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* Monthly Trend Chart */}
        <section>
          <p className="text-[14px] font-medium mb-1">Monthly trends</p>
          {stats.isPending && <Skeleton rows={3} />}
          {stats.isError && <ErrorState message={stats.error.message} onRetry={() => stats.refetch()} />}
          {stats.data && (
            <div className={chartFullscreen ? "fixed inset-0 z-50 bg-surface overflow-auto p-6" : "card card-body space-y-4"}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-medium text-ink-secondary">POs &amp; Enrollments</p>
                  <div className="flex items-center gap-3">
                    <Legend items={[
                      { color: "#6366F1", label: "POs scheduled" },
                      { color: "#22C55E", label: "POs attended" },
                      { color: "#F59E0B", label: "New enrollments" }
                    ]} />
                    <button
                      onClick={() => setChartFullscreen((v) => !v)}
                      className="btn inline-flex items-center gap-1 text-[11px]"
                    >
                      <Maximize2 className="w-3 h-3" />
                      {chartFullscreen ? "Exit" : "Expand"}
                    </button>
                  </div>
                </div>
                <BarChart
                  months={months}
                  series={[
                    { label: "POs scheduled", color: "#6366F1", values: posScheduled },
                    { label: "POs attended", color: "#22C55E", values: posAttended },
                    { label: "New enrollments", color: "#F59E0B", values: enrollments }
                  ]}
                />
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-secondary mb-2">Attended &rarr; enrollment conversion %</p>
                <ConversionLine months={months} values={conversion} />
              </div>
            </div>
          )}
        </section>

        {/* Report B — Active Enrollment */}
        <section>
          <p className="text-[14px] font-medium mb-1">Report B — active enrollment</p>
          {enrollment.isPending && <Skeleton rows={2} />}
          {enrollment.isError && (
            <div className="card card-body py-3 space-y-1">
              <p className="text-[12px] text-status-warn-fg font-medium">Enrollment data unavailable</p>
              <p className="text-[11px] text-ink-tertiary">
                Ensure your Airtable PAT has access to the enrollment base, then{" "}
                <button className="underline" onClick={() => enrollment.refetch()}>retry</button>.
              </p>
            </div>
          )}
          {enrollment.data && (
            <div className="card card-body space-y-1">
              <p className="text-[12px] text-ink-secondary mb-1">
                Total active students — latest: <span className="font-semibold text-ink">{reportBTotal.at(-1) ?? "—"}</span>
                <span className="text-ink-tertiary"> ({reportBMonths.at(-1) ?? ""})</span>
              </p>
              <BarChart
                months={reportBMonths}
                series={[{ label: "Total enrollment", color: "#6366F1", values: reportBTotal }]}
                showValues
                chartHeight={160}
              />
            </div>
          )}
        </section>

      </div>{/* end charts grid */}

      {/* ── Class Day Roster ── */}
      <ClassDayRoster />

      {/* ── Attention List ── */}
      <div className="max-w-2xl">
        <section>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="w-5 h-5 text-brand" />
            <p className="text-[16px] font-medium">What needs you</p>
            {d?.redCount != null && d.redCount > 0 && (
              <span className="badge bg-status-danger-bg text-status-danger-fg ml-1">{d.redCount} urgent</span>
            )}
          </div>
          <p className="text-[13px] text-ink-secondary mb-4">Everything across the center waiting on you. Click any item to jump to it.</p>

          {attention.isPending && <Skeleton rows={4} />}
          {attention.isError && <ErrorState message={(attention.error as Error).message} onRetry={() => attention.refetch()} />}

          {d && active.length === 0 ? (
            <div className="card card-body flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-status-success-fg" />
              <div>
                <p className="text-[14px] font-medium">All clear</p>
                <p className="text-[12px] text-ink-secondary">Nothing needs your attention right now.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((i) => (
                <Link key={i.key} href={i.href as Route}
                  className="card card-body flex items-center gap-3 hover:border-brand transition-colors">
                  <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${DOT[i.tone]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-tight">{i.label}</p>
                    {i.hint && <p className="text-[12px] text-ink-secondary mt-0.5">{i.hint}</p>}
                  </div>
                  <span className={`badge ${COUNT_BADGE[i.tone]}`}>{i.count}</span>
                  <ArrowRight className="w-4 h-4 text-ink-tertiary shrink-0" />
                </Link>
              ))}
            </div>
          )}

          {d && clear.length > 0 && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold text-ink-secondary mb-2">All caught up</p>
              <div className="flex flex-wrap gap-2">
                {clear.map((i) => (
                  <Link key={i.key} href={i.href as Route} className="badge bg-surface-subtle text-ink-tertiary inline-flex items-center gap-1 hover:text-ink">
                    <CheckCircle2 className="w-3 h-3 text-status-success-fg" /> {i.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
