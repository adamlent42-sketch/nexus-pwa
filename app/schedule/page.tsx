"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { StaffSelect } from "@/components/ui/StaffSelect";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useCreateTimeOff } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { TimeOffCreate } from "@/lib/schemas";
import { TIME_OFF_TYPES } from "@/lib/options";
import { todayInET } from "@/lib/time";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Shift {
  id: string;
  dayOfWeek: string;
  role: string[];
  startTime: string | null;
  endTime: string | null;
}
interface TimeOffItem {
  id: string;
  type: string;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
}
interface Closure {
  date: string;
  reason: string | null;
  notes: string | null;
}
interface ScheduleData {
  staffName: string;
  staffEmail: string | null;
  shifts: Shift[];
  timeOff: TimeOffItem[];
  closures: Closure[];
}

const CHANGE_TYPES = ["Add a day", "Remove a day", "Change my time", "Other"] as const;
type ChangeType = typeof CHANGE_TYPES[number];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(status: string) {
  if (status === "Approved") return "text-status-success-fg bg-status-success-bg";
  if (status === "Denied") return "text-status-danger-fg bg-status-danger-bg";
  return "text-status-warning-fg bg-status-warning-bg";
}

// ── Expandable section wrapper ─────────────────────────────────────────────────
function ExpandSection({
  label,
  open,
  onToggle,
  children,
  done,
  doneMessage
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  done?: boolean;
  doneMessage?: string;
}) {
  if (done) {
    return (
      <div className="card card-body text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-status-success-fg mx-auto mb-2" />
        <p className="text-[15px] font-medium mb-1">Done!</p>
        <p className="text-[13px] text-ink-secondary">{doneMessage}</p>
      </div>
    );
  }
  return (
    <div className="card">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={onToggle}
      >
        <span className="text-[13px] font-medium">{label}</span>
        <ChevronDown className={`w-4 h-4 text-ink-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-line pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [staffId, setStaffId] = useState<string | null>(null);

  // Schedule change state
  const [showChange, setShowChange] = useState(false);
  const [requestType, setRequestType] = useState<ChangeType>("Add a day");
  const [changeDetails, setChangeDetails] = useState("");
  const [changeDone, setChangeDone] = useState(false);
  const [changePending, setChangePending] = useState(false);

  // Time off state
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [timeOffType, setTimeOffType] = useState<string>("Planned Absence");
  const [startDate, setStartDate] = useState(todayInET());
  const [endDate, setEndDate] = useState("");
  const [timeOffNotes, setTimeOffNotes] = useState("");
  const [timeOffDone, setTimeOffDone] = useState(false);

  const timeOffMutation = useCreateTimeOff();
  const toast = useToast();

  const q = useQuery<ScheduleData>({
    queryKey: ["schedule", staffId],
    queryFn: async () => {
      const r = await fetch(`/api/schedule?staffId=${staffId}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data;
    },
    enabled: !!staffId,
    staleTime: 2 * 60_000
  });

  const handleStaffChange = (id: string | null) => {
    setStaffId(id);
    setShowChange(false);
    setShowTimeOff(false);
    setChangeDone(false);
    setTimeOffDone(false);
    setChangeDetails("");
    setTimeOffNotes("");
    setStartDate(todayInET());
    setEndDate("");
  };

  const submitChangeRequest = async () => {
    if (!staffId || !changeDetails.trim()) {
      toast.push("Please describe what you'd like to change", "error");
      return;
    }
    setChangePending(true);
    try {
      const r = await fetch("/api/schedule/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, requestType, details: changeDetails.trim() })
      });
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      setChangeDone(true);
      setShowChange(false);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to send request", "error");
    } finally {
      setChangePending(false);
    }
  };

  const submitTimeOff = async () => {
    const payload = {
      staffId: staffId ?? "",
      type: (timeOffType ?? "Planned Absence") as "Planned Absence" | "Sick" | "Other",
      startDate,
      endDate: endDate || null,
      notes: timeOffNotes.trim() || undefined
    };
    const parsed = TimeOffCreate.safeParse(payload);
    if (!parsed.success) {
      toast.push(parsed.error.issues.map((i) => i.message).join("; "), "error");
      return;
    }
    try {
      await timeOffMutation.mutateAsync(parsed.data);
      setTimeOffDone(true);
      setShowTimeOff(false);
      // Refresh the schedule data so the new request shows up
      q.refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to submit", "error");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
        <div className="w-10 h-10 rounded bg-brand text-white flex items-center justify-center font-display font-bold">
          K
        </div>
        <div>
          <p className="text-[18px] font-medium leading-tight">My schedule</p>
          <p className="text-[13px] text-ink-secondary mt-0.5">Kumon Wappingers Falls</p>
        </div>
      </div>

      {/* Staff picker */}
      <div className="card card-body mb-4">
        <Field label="Who are you?" required>
          <StaffSelect value={staffId} onChange={handleStaffChange} placeholder="Pick your name…" />
        </Field>
      </div>

      {staffId && q.isPending && (
        <p className="text-[13px] text-ink-secondary text-center py-8">Loading your schedule…</p>
      )}

      {q.isError && (
        <div className="card card-body flex items-start gap-3 text-status-danger-fg">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-[13px]">{q.error instanceof Error ? q.error.message : "Failed to load schedule"}</p>
        </div>
      )}

      {q.data && (
        <div className="space-y-4">
          {/* Weekly shifts */}
          <div className="card">
            <div className="px-4 pt-4 pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-ink-secondary" />
                <p className="text-[13px] font-medium">Your weekly schedule</p>
              </div>
            </div>
            <div className="divide-y divide-line">
              {q.data.shifts.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink-secondary">No recurring shifts on file.</p>
              ) : (
                q.data.shifts.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] font-medium">{s.dayOfWeek}</span>
                    <div className="text-right">
                      {s.startTime && s.endTime && (
                        <p className="text-[13px] text-ink-secondary">{s.startTime} – {s.endTime}</p>
                      )}
                      {s.role.length > 0 && (
                        <p className="text-[11px] text-ink-tertiary mt-0.5">{s.role.join(" · ")}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Time off history */}
          <div className="card">
            <div className="px-4 pt-4 pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ink-secondary" />
                <p className="text-[13px] font-medium">Upcoming time off</p>
              </div>
            </div>
            <div className="divide-y divide-line">
              {q.data.timeOff.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink-secondary">No upcoming time off on file.</p>
              ) : (
                q.data.timeOff.map((t) => (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium">
                          {formatDate(t.startDate)}
                          {t.endDate && t.endDate !== t.startDate && ` – ${formatDate(t.endDate)}`}
                        </p>
                        <p className="text-[12px] text-ink-secondary mt-0.5">{t.type}</p>
                        {t.notes && <p className="text-[12px] text-ink-tertiary mt-0.5">{t.notes}</p>}
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Center closures */}
          {q.data.closures.length > 0 && (
            <div className="card">
              <div className="px-4 pt-4 pb-2 border-b border-line">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-ink-secondary" />
                  <p className="text-[13px] font-medium">Upcoming center closures</p>
                </div>
              </div>
              <div className="divide-y divide-line">
                {q.data.closures.map((c) => (
                  <div key={c.date} className="px-4 py-3">
                    <p className="text-[13px] font-medium">{formatDate(c.date)}</p>
                    {(c.reason || c.notes) && (
                      <p className="text-[12px] text-ink-secondary mt-0.5">{c.reason ?? c.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request time off */}
          <ExpandSection
            label="Request time off"
            open={showTimeOff}
            onToggle={() => { setShowTimeOff((v) => !v); setShowChange(false); }}
            done={timeOffDone}
            doneMessage="Submitted — Adam will review and follow up with you."
          >
            <Field label="Type" required>
              <ChipGroup value={timeOffType} onChange={(v) => setTimeOffType(v ?? "Planned Absence")} options={TIME_OFF_TYPES} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" required>
                <TextInput type="date" value={startDate} min={todayInET()} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End date" hint="blank = single day">
                <TextInput type="date" value={endDate} min={startDate || todayInET()} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes" hint="optional">
              <TextArea
                value={timeOffNotes}
                onChange={(e) => setTimeOffNotes(e.target.value)}
                placeholder="Context helps Adam approve faster — let us know what's up."
              />
            </Field>
            <div className="flex justify-end">
              <button
                onClick={submitTimeOff}
                disabled={timeOffMutation.isPending}
                className="btn btn-primary"
              >
                {timeOffMutation.isPending ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </ExpandSection>

          {/* Request a schedule change */}
          <ExpandSection
            label="Request a schedule change"
            open={showChange}
            onToggle={() => { setShowChange((v) => !v); setShowTimeOff(false); }}
            done={changeDone}
            doneMessage="Request sent — Adam will follow up with you directly."
          >
            <Field label="What do you need?">
              <div className="flex flex-wrap gap-2 mt-1">
                {CHANGE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setRequestType(t)}
                    className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                      requestType === t
                        ? "bg-brand text-white border-brand"
                        : "bg-surface border-line text-ink-secondary hover:border-ink-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Details" required>
              <TextArea
                value={changeDetails}
                onChange={(e) => setChangeDetails(e.target.value)}
                placeholder={
                  requestType === "Add a day" ? "e.g. I'd like to add Wednesdays starting next month" :
                  requestType === "Remove a day" ? "e.g. I need to drop Saturdays after August" :
                  requestType === "Change my time" ? "e.g. Can my Monday end time move to 6:30?" :
                  "Describe what you'd like to change…"
                }
              />
            </Field>
            <div className="flex justify-end">
              <button
                onClick={submitChangeRequest}
                disabled={changePending || !changeDetails.trim()}
                className="btn btn-primary"
              >
                {changePending ? "Sending…" : "Send request"}
              </button>
            </div>
          </ExpandSection>
        </div>
      )}

      <p className="text-[11px] text-ink-tertiary text-center mt-6">
        Internal use · Kumon Wappingers Falls
      </p>
    </div>
  );
}
