"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

interface ClassStaff { name: string; roles: string[]; isLead: boolean; available: boolean; reason: string | null }
interface Demand { students: number; handsOn: number; independent: number }
interface CoverageClass { date: string; weekday: string; staff: ClassStaff[]; leads: number; helpers: number; demand: Demand }
interface CoverageResp { today: string; classes: CoverageClass[] }

// Peak-concurrency model. Only a fraction of the day's roster is in the room at the
// busy point (overlap). Of those, early learners need a sitter (~1:sitRatio); the rest
// need a grader/lead (~1:gradeRatio). Sitting and grading are different people, so they
// add up. Buffer = the extra bodies for rushes/outages.
type Settings = { overlap: number; sitRatio: number; gradeRatio: number; buffer: number; minLeads: number };
const DEFAULTS: Settings = { overlap: 40, sitRatio: 1.5, gradeRatio: 8, buffer: 2, minLeads: 1 };

function md(iso: string) { const [, m, d] = iso.split("-"); return `${parseInt(m, 10)}/${parseInt(d, 10)}`; }
function model(d: Demand, s: Settings) {
  const f = s.overlap / 100;
  const peak = Math.round(d.students * f);
  const sitters = Math.ceil((d.handsOn * f) / Math.max(0.5, s.sitRatio));
  const graders = Math.ceil((d.independent * f) / Math.max(1, s.gradeRatio));
  return { peak, sitters, graders, need: sitters + graders + s.buffer };
}

export function CoverageView() {
  const [count, setCount] = useState(16);
  const [s, setS] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try { const saved = localStorage.getItem("coverageModel"); if (saved) setS({ ...DEFAULTS, ...JSON.parse(saved) }); } catch { /* ignore */ }
  }, []);
  function set(key: keyof Settings, val: number) {
    setS((cur) => { const next = { ...cur, [key]: Math.max(0, val) }; try { localStorage.setItem("coverageModel", JSON.stringify(next)); } catch { /* ignore */ } return next; });
  }

  const q = useQuery({ queryKey: ["admin", "coverage", count], queryFn: () => adminFetch<CoverageResp>(`/api/admin/coverage?count=${count}`) });

  const numCls = "w-12 border border-line rounded px-1 py-0.5 text-center";

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="text-[13px] text-ink-secondary">Next</span>
        {[12, 16, 24].map((n) => (
          <button key={n} onClick={() => setCount(n)} className={`btn ${count === n ? "btn-primary" : ""}`}>{n}</button>
        ))}
        <span className="text-[12px] text-ink-tertiary">class sessions · staff drop off on the dates they&apos;re actually out.</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[11px] text-ink-secondary">
        <span className="text-ink-tertiary">Rush model:</span>
        <span className="flex items-center gap-1">peak in room <input type="number" min={5} max={100} value={s.overlap} onChange={(e) => set("overlap", parseInt(e.target.value || "0", 10))} className={numCls} />% of roster</span>
        <span className="flex items-center gap-1">EL kids per assistant <input type="number" min={1} step={0.5} value={s.sitRatio} onChange={(e) => set("sitRatio", parseFloat(e.target.value || "1"))} className={numCls} /></span>
        <span className="flex items-center gap-1">kids per grader <input type="number" min={1} value={s.gradeRatio} onChange={(e) => set("gradeRatio", parseInt(e.target.value || "1", 10))} className={numCls} /></span>
        <span className="flex items-center gap-1">buffer +<input type="number" min={0} value={s.buffer} onChange={(e) => set("buffer", parseInt(e.target.value || "0", 10))} className={numCls} /></span>
      </div>

      {q.isPending && <Skeleton rows={4} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      {q.data && (
        <>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 items-stretch" style={{ minWidth: "min-content" }}>
              {q.data.classes.map((c) => {
                const avail = c.leads + c.helpers;
                const m = model(c.demand, s);
                const leadShort = c.leads < Math.max(s.minLeads, m.graders);
                const short = avail < m.need || leadShort;
                return (
                  <div key={c.date} className="w-[150px] shrink-0 rounded-lg border border-line overflow-hidden flex flex-col">
                    <div className={`px-2 py-1.5 text-center ${short ? "bg-status-danger-bg" : "bg-status-success-bg"}`}>
                      <div className={`text-[13px] font-medium ${short ? "text-status-danger-fg" : "text-status-success-fg"}`}>{c.weekday.slice(0, 3)} {md(c.date)}</div>
                      <div className={`text-[12px] font-semibold ${short ? "text-status-danger-fg" : "text-status-success-fg"}`}>{avail} / {m.need} staff</div>
                      <div className={`text-[10px] ${short ? "text-status-danger-fg" : "text-status-success-fg"}`}>
                        ~{m.peak} at peak · {m.sitters} EL + {m.graders} grade{leadShort ? " · leads short" : ""}
                      </div>
                    </div>
                    <div className="p-1 flex flex-col gap-1 flex-1">
                      {c.staff.length === 0 && <span className="text-[11px] text-ink-tertiary text-center py-2">none</span>}
                      {c.staff.map((p, i) => (
                        <div
                          key={p.name + i}
                          className={`rounded px-1.5 py-1 text-[11px] leading-tight ${!p.available ? "bg-surface-muted text-ink-tertiary line-through" : p.isLead ? "bg-tint-purple-bg text-tint-purple-fg font-medium" : "bg-surface-muted text-ink-secondary"}`}
                          title={`${p.roles.join("/")}${p.reason ? " — " + p.reason : ""}`}
                        >
                          {p.isLead ? "★ " : ""}{p.name.split(" ")[0]} {p.name.split(" ").slice(1).join(" ").charAt(0)}
                          {p.reason ? <span className="block text-[9px] opacity-80">{p.reason}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-ink-tertiary mt-2">Peak in room = {s.overlap}% of the day&apos;s roster. Need = EL assistants (hands-on sessions ÷ {s.sitRatio}) + graders (independent sessions ÷ {s.gradeRatio}, done by leads) + {s.buffer} buffer. ★ = lead. Greyed = out/departed that date.</p>
        </>
      )}
    </div>
  );
}
