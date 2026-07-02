"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, Plus, Trash2, Megaphone, Copy, Check, Package, ChevronDown, ChevronRight } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/lib/toast";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, TextArea } from "@/components/ui/Field";
import { CLOSURE_REASONS } from "@/lib/options";

interface Closure {
  id: string;
  date: string;
  reason: string | null;
  notes: string | null;
  announced: boolean;
}

interface Suggestion {
  date: string;
  reason: string;
  label: string;
  groupKey: string;
}

interface PrepStudent {
  id: string;
  name: string;
  grade: string | null;
  schedule: string[];
}

interface PrepPlan {
  prepDate: string;
  pickupDay: string;
  weeksOfWork: number;
  closures: { date: string; reason: string | null }[];
  students: PrepStudent[];
}

const CLASS_DOW = new Set([1, 2, 4, 6]);

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(y: number, m0: number, d: number) { return `${y}-${pad(m0 + 1)}-${pad(d)}`; }
function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(d: string): string {
  return parseYmd(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatShort(d: string): string {
  return parseYmd(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ClosuresAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const closures = useQuery({
    queryKey: ["admin", "closures"],
    queryFn: () => adminFetch<Closure[]>("/api/admin/closures")
  });
  const suggestions = useQuery({
    queryKey: ["admin", "closures-suggestions"],
    queryFn: () => adminFetch<Suggestion[]>("/api/admin/closures/suggestions")
  });
  const prepPlans = useQuery({
    queryKey: ["admin", "closures-prep-plan"],
    queryFn: () => adminFetch<PrepPlan[]>("/api/admin/closures/prep-plan")
  });

  // Show every month from this month through December of (current year + 2),
  // so today (Jun 2026) covers Jun 2026 → Dec 2028. Rolls forward each year.
  const months = useMemo(() => {
    const out: { y: number; m: number }[] = [];
    const start = new Date();
    start.setDate(1);
    const endYear = start.getFullYear() + 2;
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < endYear || (y === endYear && m <= 11)) {
      out.push({ y, m });
      m++;
      if (m === 12) { m = 0; y++; }
    }
    return out;
  }, []);

  const closuresByDate = useMemo(() => {
    const map = new Map<string, Closure>();
    for (const c of closures.data ?? []) map.set(c.date, c);
    return map;
  }, [closures.data]);

  const openSuggestions = useMemo(() => {
    return (suggestions.data ?? []).filter((s) => !closuresByDate.has(s.date));
  }, [suggestions.data, closuresByDate]);

  const groupedSuggestions = useMemo(() => {
    const map = new Map<string, { reason: string; dates: Suggestion[] }>();
    for (const s of openSuggestions) {
      const cur = map.get(s.groupKey);
      if (cur) cur.dates.push(s);
      else map.set(s.groupKey, { reason: s.reason, dates: [s] });
    }
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, reason: v.reason, dates: v.dates }));
  }, [openSuggestions]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "closures"] });
    qc.invalidateQueries({ queryKey: ["admin", "closures-prep-plan"] });
  };

  const addClosures = useMutation({
    mutationFn: async ({ dates, reason, notes }: { dates: string[]; reason: string; notes?: string }) =>
      adminFetch<{ created: number; skipped: number }>("/api/admin/closures", {
        method: "POST",
        body: JSON.stringify({ dates, reason, notes: notes ?? null })
      }),
    onSuccess: invalidateAll
  });

  const removeClosure = useMutation({
    mutationFn: async (id: string) =>
      adminFetch<{ id: string }>(`/api/admin/closures/${id}`, { method: "DELETE" }),
    onSuccess: invalidateAll
  });

  const setAnnounced = useMutation({
    mutationFn: async ({ id, announced }: { id: string; announced: boolean }) =>
      adminFetch<{ id: string }>(`/api/admin/closures/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ announced })
      }),
    onSuccess: invalidateAll
  });

  const [picker, setPicker] = useState<{ date: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const addOne = async (date: string, reason: string) => {
    try {
      await addClosures.mutateAsync({ dates: [date], reason });
      toast.push("Closure added.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const addBreak = async (reason: string, dates: string[]) => {
    try {
      const r = await addClosures.mutateAsync({ dates, reason });
      toast.push(`Added ${r.created} day${r.created === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const onDayClick = async (date: string) => {
    const existing = closuresByDate.get(date);
    if (existing) {
      if (!window.confirm(`Remove the ${existing.reason ?? "closure"} on ${formatDisplay(date)}?`)) return;
      try {
        await removeClosure.mutateAsync(existing.id);
        toast.push("Closure removed.", "success");
      } catch (e) {
        toast.push(e instanceof Error ? e.message : "Failed", "error");
      }
      return;
    }
    setPicker({ date });
  };

  const closuresByYear = useMemo(() => {
    const map = new Map<string, Closure[]>();
    for (const c of closures.data ?? []) {
      const y = c.date.slice(0, 4);
      const arr = map.get(y) ?? [];
      arr.push(c);
      map.set(y, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [closures.data]);

  const copyText = () => {
    const lines: string[] = [];
    for (const [year, rows] of closuresByYear) {
      lines.push(`Closures — ${year}`);
      for (const r of rows) {
        lines.push(`  • ${formatDisplay(r.date)} — ${r.reason ?? "Closed"}${r.notes ? ` (${r.notes})` : ""}`);
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (closures.isPending || suggestions.isPending) return <Skeleton rows={4} />;
  if (closures.isError) return <ErrorState message={closures.error.message} onRetry={() => closures.refetch()} />;
  if (suggestions.isError) return <ErrorState message={suggestions.error.message} onRetry={() => suggestions.refetch()} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <p className="text-[13px] text-ink-secondary mb-3">
          Class days are <span className="text-ink">bold</span>. Click a class day to mark it closed; click a closed day to remove.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {months.map(({ y, m }) => (
            <MonthCard
              key={`${y}-${m}`}
              year={y}
              month0={m}
              closuresByDate={closuresByDate}
              onDayClick={onDayClick}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <section>
          <p className="text-[12px] uppercase tracking-wide text-ink-tertiary mb-2">Suggestions</p>
          {groupedSuggestions.length === 0 ? (
            <p className="text-[12px] text-ink-tertiary">All suggested holidays through {new Date().getFullYear() + 2} are already on your list.</p>
          ) : (
            <div className="space-y-1.5">
              {groupedSuggestions.map((g) => (
                <div key={g.key} className="card card-body flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-tight">{g.reason}</p>
                    <p className="meta mt-0.5">
                      {g.dates.length === 1
                        ? formatDisplay(g.dates[0].date)
                        : `${g.dates.length} days — ${formatDisplay(g.dates[0].date)} → ${formatDisplay(g.dates[g.dates.length - 1].date)}`}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary shrink-0"
                    onClick={() => g.dates.length === 1 ? addOne(g.dates[0].date, g.reason) : addBreak(g.reason, g.dates.map((d) => d.date))}
                    disabled={addClosures.isPending}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <PrepPlanSection plans={prepPlans.data ?? []} loading={prepPlans.isPending} />

        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] uppercase tracking-wide text-ink-tertiary">Scheduled ({closures.data?.length ?? 0})</p>
            {(closures.data?.length ?? 0) > 0 && (
              <button onClick={copyText} className="btn">
                {copied ? <Check className="w-3.5 h-3.5 text-status-success-fg" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy list"}
              </button>
            )}
          </div>
          {(closures.data?.length ?? 0) === 0 ? (
            <p className="text-[12px] text-ink-tertiary">Nothing scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {closuresByYear.map(([year, rows]) => (
                <div key={year}>
                  <p className="text-[11px] font-medium text-ink-secondary mb-1">{year}</p>
                  <div className="space-y-1">
                    {rows.map((c) => (
                      <div key={c.id} className="card card-body flex items-center gap-2 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium leading-tight">{formatDisplay(c.date)}</p>
                          <p className="meta mt-0.5">{c.reason ?? "Closed"}{c.notes ? ` · ${c.notes}` : ""}</p>
                        </div>
                        <button
                          className={`btn ${c.announced ? "text-status-success-fg" : "text-ink-tertiary"}`}
                          title={c.announced ? "Announced to families" : "Not yet announced"}
                          onClick={() => setAnnounced.mutate({ id: c.id, announced: !c.announced })}
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="btn"
                          title="Remove"
                          onClick={async () => {
                            if (!window.confirm(`Remove ${c.reason ?? "closure"} on ${formatDisplay(c.date)}?`)) return;
                            try {
                              await removeClosure.mutateAsync(c.id);
                              toast.push("Closure removed.", "success");
                            } catch (e) {
                              toast.push(e instanceof Error ? e.message : "Failed", "error");
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-status-danger-fg" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ReasonPicker
        open={!!picker}
        date={picker?.date ?? ""}
        onClose={() => setPicker(null)}
        onSubmit={async (reason, notes) => {
          if (!picker) return;
          try {
            await addClosures.mutateAsync({ dates: [picker.date], reason, notes });
            toast.push("Closure added.", "success");
            setPicker(null);
          } catch (e) {
            toast.push(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
        submitting={addClosures.isPending}
      />
    </div>
  );
}

function PrepPlanSection({ plans, loading }: { plans: PrepPlan[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading && plans.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] uppercase tracking-wide text-ink-tertiary">Prep day plan</p>
      </div>
      {plans.length === 0 ? (
        <p className="text-[12px] text-ink-tertiary">
          No upcoming closures fall on a pickup day (Tue/Thu/Sat). Add a closure on one of those days to see a prep plan.
        </p>
      ) : (
        <div className="space-y-1.5">
          {plans.map((p) => {
            const id = `${p.prepDate}-${p.pickupDay}`;
            const expanded = expandedId === id;
            const closureList = p.closures.map((c) => formatShort(c.date)).join(", ");
            return (
              <div key={id} className="card card-body">
                <button
                  className="w-full text-left flex items-start gap-2"
                  onClick={() => setExpandedId(expanded ? null : id)}
                >
                  <Package className="w-4 h-4 mt-0.5 text-tint-purple-fg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-tight">
                      {formatDisplay(p.prepDate)} — give {p.weeksOfWork} weeks of work
                    </p>
                    <p className="meta mt-0.5">
                      {p.pickupDay} pickup · {p.students.length} student{p.students.length === 1 ? "" : "s"} · covers {closureList}
                    </p>
                  </div>
                  {expanded ? <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary mt-1 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary mt-1 shrink-0" />}
                </button>
                {expanded && <PrepPlanDetail plan={p} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PrepPlanDetail({ plan }: { plan: PrepPlan }) {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    const closureDescr = plan.closures.length === 1
      ? `the center will be closed on ${formatDisplay(plan.closures[0].date)}${plan.closures[0].reason ? ` (${plan.closures[0].reason})` : ""}`
      : `the center will be closed on the following dates: ${plan.closures.map((c) => formatDisplay(c.date)).join(", ")}`;
    const lines = [
      `Hi families,`,
      ``,
      `A quick heads-up: ${closureDescr}.`,
      ``,
      `For ${plan.pickupDay} pickup families: when you come in on ${formatDisplay(plan.prepDate)}, we will send you home with ${plan.weeksOfWork} weeks of worksheets instead of the usual one — that covers your child through the closure(s) so they can keep their daily practice going.`,
      ``,
      `Thanks for understanding!`
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-[11px] font-medium text-ink-secondary mb-1">Affected students ({plan.students.length})</p>
      <div className="max-h-40 overflow-y-auto text-[12px] mb-3">
        {plan.students.length === 0 ? (
          <p className="text-ink-tertiary">No active students with {plan.pickupDay} pickup.</p>
        ) : (
          <ul className="space-y-0.5">
            {plan.students.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span>{s.name}</span>
                {s.grade && <span className="text-ink-tertiary text-[11px]">Gr {s.grade}</span>}
                {s.schedule.length > 0 && (
                  <span className="text-ink-tertiary text-[11px]">
                    {s.schedule.map((d) => d.slice(0, 3)).join("/")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={copyEmail} className="btn">
        {copied ? <Check className="w-3.5 h-3.5 text-status-success-fg" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy email blurb"}
      </button>
    </div>
  );
}

function MonthCard({ year, month0, closuresByDate, onDayClick }: {
  year: number;
  month0: number;
  closuresByDate: Map<string, Closure>;
  onDayClick: (date: string) => void;
}) {
  const firstDow = new Date(year, month0, 1).getDay();
  const lastDate = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const todayYmd = (() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  })();

  return (
    <div className="card card-body">
      <p className="text-[13px] font-medium mb-2">
        {new Date(year, month0, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-ink-tertiary mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const date = ymd(year, month0, d);
          const dow = new Date(year, month0, d).getDay();
          const isClass = CLASS_DOW.has(dow);
          const closure = closuresByDate.get(date);
          const isToday = date === todayYmd;
          let cls = "h-7 text-[11px] rounded flex items-center justify-center transition-colors ";
          if (closure) cls += "bg-status-danger-bg text-status-danger-fg font-semibold hover:bg-status-danger-bg/80 cursor-pointer";
          else if (isClass) cls += "font-semibold text-ink hover:bg-surface-muted cursor-pointer";
          else cls += "text-ink-tertiary";
          if (isToday) cls += " ring-1 ring-brand";
          return (
            <button
              key={i}
              className={cls}
              disabled={!isClass && !closure}
              onClick={() => onDayClick(date)}
              title={closure ? `${closure.reason ?? "Closed"} — click to remove` : isClass ? "Click to mark closed" : "Non-class day"}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReasonPicker({ open, date, onClose, onSubmit, submitting }: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSubmit: (reason: string, notes?: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState<string>("Other");
  const [notes, setNotes] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={date ? `Close ${formatDisplay(date)}` : "Close day"}
      icon={<CalendarX className="w-4 h-4" />}
      tintClassName="bg-status-danger-bg text-status-danger-fg"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={() => onSubmit(reason, notes || undefined)} disabled={submitting} className="btn btn-primary">
            {submitting ? "Saving…" : "Mark closed"}
          </button>
        </>
      }
    >
      <Field label="Reason" required>
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {CLOSURE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Notes" hint="optional context (e.g. half-day, weather)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
