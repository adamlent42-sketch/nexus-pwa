"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Search, ChevronDown, ChevronUp, Archive, Send, Calendar, X, CheckCircle, XCircle, Clock } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/lib/toast";
import { suggestBranch } from "@/lib/email-branches";
import { PO_OUTCOMES, WEEKDAYS } from "@/lib/options";
import { formatDate } from "@/lib/utils";
import { PerStudentDetails } from "@/components/admin/PerStudentDetails";

const NO_SHOW_STATUSES = new Set(["No-Show", "Family Cancelled", "Instructor Cancelled"]);

interface PORecap {
  id: string;
  date: string | null;
  time: string;
  student: string;
  recapStatus: string | null;
  grade: string | null;
  status: string | null;
  outcome: string | null;
  subjects: string[];
  phone: string | null;
  source: string | null;
  plannedStartDate: string | null;
  plannedClassTime: string | null;
  plannedSchedule: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  leadSource: string | null;
  staffNotes: string | null;
  bookingNotes: string | null;
  eEnrollmentCompleted: boolean;
  targetLifecycle: string | null;
  thirtyDayVision: string | null;
  gpsPriorities: string[];
  familyId: string | null;
  lastContactDate: string | null;
}

function daysSince(dateStr: string | null, today: string): number | null {
  if (!dateStr) return null;
  const a = new Date(today);
  const b = new Date(dateStr);
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function LastContactBadge({ lastContactDate, today }: { lastContactDate: string | null; today: string }) {
  const days = daysSince(lastContactDate, today);
  if (days === null) {
    return (
      <div className="flex items-center gap-1 text-status-warn-fg">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-medium">Never contacted</span>
      </div>
    );
  }
  if (days === 0) {
    return (
      <div className="flex items-center gap-1 text-status-success-fg">
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-medium">Contacted today</span>
      </div>
    );
  }
  if (days === 1) {
    return (
      <div className="flex items-center gap-1 text-ink-secondary">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px]">Yesterday</span>
      </div>
    );
  }
  if (days <= 5) {
    return (
      <div className="flex items-center gap-1 text-ink-secondary">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px]">{days}d ago</span>
      </div>
    );
  }
  // > 5 days — warn
  return (
    <div className="flex items-center gap-1 text-status-warn-fg">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[11px] font-medium">{days}d ago — reach out</span>
    </div>
  );
}

function poTone(po: PORecap, today: string): "grey" | "red" | "yellow" | "green" {
  if (po.date && po.date > today) return "grey";
  if (NO_SHOW_STATUSES.has(po.status ?? "")) return "red";
  if (po.recapStatus) return "green";
  return "yellow";
}

const STATUS_BADGE: Record<string, string> = {
  "No-Show":              "bg-status-danger-bg text-status-danger-fg",
  "Family Cancelled":     "bg-status-danger-bg text-status-danger-fg",
  "Instructor Cancelled": "bg-status-warn-bg text-status-warn-fg",
  "Attended":             "bg-status-success-bg text-status-success-fg",
};

export default function POAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const q = useQuery({
    queryKey: ["admin", "po-recaps"],
    queryFn: () => adminFetch<PORecap[]>("/api/admin/po-recaps")
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [followupSentIds, setFollowupSentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PORecap[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState<"review" | "history">("review");
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchTimer, setHistorySearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  const historyQuery = useQuery({
    queryKey: ["admin", "po-history", historySearchQuery],
    queryFn: () => adminFetch<PORecap[]>(
      `/api/admin/po-recaps/history${historySearchQuery.length >= 2 ? `?q=${encodeURIComponent(historySearchQuery)}` : ""}`
    ),
    enabled: activeTab === "history",
    staleTime: 30_000,
  });

  const [outcome, setOutcome] = useState<string | null>(null);
  const [eEnroll, setEEnroll] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [classTime, setClassTime] = useState("");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [mathLevel, setMathLevel] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [leadSource, setLeadSource] = useState("");
  const [thirtyDayVision, setThirtyDayVision] = useState("");
  const [gpsPriorities, setGpsPriorities] = useState<string[]>([]);
  const [staffNotes, setStaffNotes] = useState("");

  const allKnown = [...(q.data ?? []), ...(searchResults ?? []), ...(historyQuery.data ?? [])];
  const expanded = allKnown.find((p) => p.id === expandedId) ?? null;

  useEffect(() => {
    if (!expanded) return;
    setOutcome(expanded.outcome);
    setEEnroll(expanded.eEnrollmentCompleted);
    setStartDate(expanded.plannedStartDate ?? "");
    setClassTime(expanded.plannedClassTime ?? "");
    setSchedule(expanded.plannedSchedule);
    setMathLevel(expanded.mathLevel ?? "");
    setReadingLevel(expanded.readingLevel ?? "");
    setSubjects(expanded.subjects);
    setLeadSource(expanded.leadSource ?? "");
    setThirtyDayVision(expanded.thirtyDayVision ?? "");
    setGpsPriorities(expanded.gpsPriorities ?? []);
    setStaffNotes(expanded.staffNotes ?? "");
  }, [expanded]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await adminFetch<PORecap[]>(`/api/admin/po-recaps/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(res);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // History search debounce
  useEffect(() => {
    if (historySearchTimer) clearTimeout(historySearchTimer);
    const t = setTimeout(() => setHistorySearchQuery(historySearch), 350);
    setHistorySearchTimer(t);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch]);

  const followupMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch<{ queued: boolean; message: string }>(`/api/admin/po-recaps/${id}`, { method: "POST" }),
    onSuccess: (result) => { toast.push(result.message, "success"); },
    onError: (e) => toast.push(e instanceof Error ? e.message : "Failed", "error")
  });

  const mutation = useMutation({
    mutationFn: (body: { id: string } & Record<string, unknown>) => {
      const { id, ...rest } = body;
      return adminFetch<{ id: string; approved: boolean; lifecyclePushed: string | null; studentsPushed: number }>(
        `/api/admin/po-recaps/${id}`,
        { method: "PATCH", body: JSON.stringify(rest) }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "po-recaps"] });
      qc.invalidateQueries({ queryKey: ["students", "new"] });
    }
  });

  const quickArchive = async (po: PORecap, withOutcome?: string, lifecycleOverride?: string) => {
    try {
      const body: Record<string, unknown> = { id: po.id, approve: true };
      if (withOutcome !== undefined) body.outcome = withOutcome;
      if (lifecycleOverride !== undefined) body.lifecycleOverride = lifecycleOverride;
      const result = await mutation.mutateAsync(body as { id: string } & Record<string, unknown>);
      setArchivedIds((prev) => new Set(prev).add(po.id));
      if (expandedId === po.id) setExpandedId(null);
      const msg = withOutcome
        ? `${po.student} → ${withOutcome}. ${result.lifecyclePushed ? `Lifecycle → ${result.lifecyclePushed}.` : ""}`
        : result.lifecyclePushed ? `Archived · lifecycle → ${result.lifecyclePushed}` : "Archived.";
      toast.push(msg, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const save = async (approve: boolean) => {
    if (!expanded) return;
    try {
      const result = await mutation.mutateAsync({
        id: expanded.id,
        outcome, eEnrollmentCompleted: eEnroll,
        plannedStartDate: startDate || null,
        plannedClassTime: classTime || null,
        plannedSchedule: schedule,
        mathLevel: mathLevel || null,
        readingLevel: readingLevel || null,
        subjects, leadSource: leadSource || null,
        thirtyDayVision: thirtyDayVision || null,
        gpsPriorities, staffNotes,
        approve
      });
      if (approve) {
        toast.push(result.lifecyclePushed
          ? `Archived · ${result.studentsPushed} student(s) → ${result.lifecyclePushed}.`
          : "Archived.", "success");
        setArchivedIds((prev) => new Set(prev).add(expanded.id));
        setExpandedId(null);
      } else {
        toast.push("Saved.", "success");
      }
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const displayList = (searchResults ?? q.data ?? []).filter((p) => !archivedIds.has(p.id));

  const pastPOs = displayList
    .filter(po => poTone(po, today) !== "grey")
    .sort((a, b) => {
      // Sort: no-shows first, then by "urgency" (no contact > old contact > recent)
      const aIsNoShow = NO_SHOW_STATUSES.has(a.status ?? "") ? 0 : 1;
      const bIsNoShow = NO_SHOW_STATUSES.has(b.status ?? "") ? 0 : 1;
      if (aIsNoShow !== bIsNoShow) return aIsNoShow - bIsNoShow;
      // Within same group, sort by last contact (never first, then oldest)
      const aDays = daysSince(a.lastContactDate, today) ?? 999;
      const bDays = daysSince(b.lastContactDate, today) ?? 999;
      if (aDays !== bDays) return bDays - aDays; // most overdue first
      return (b.date ?? "").localeCompare(a.date ?? "");
    });

  const scheduledPOs = displayList
    .filter(po => poTone(po, today) === "grey")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const archivedList = (searchResults ?? q.data ?? []).filter((p) => archivedIds.has(p.id));

  const branch = expanded ? suggestBranch({
    status: expanded.status,
    outcome,
    plannedStartDate: startDate || null,
    plannedSchedule: schedule,
    eEnrollmentCompleted: eEnroll
  }) : null;

  const renderPORow = (po: PORecap, opts: { isReviewed?: boolean; isHistory?: boolean } = {}) => {
    const { isReviewed = false, isHistory = false } = opts;
    const tone = isReviewed ? "green" : poTone(po, today);
    const isExpanded = expandedId === po.id;
    const isNoShow = NO_SHOW_STATUSES.has(po.status ?? "");
    const emailSent = followupSentIds.has(po.id);
    const statusBadgeClass = po.status ? (STATUS_BADGE[po.status] ?? "bg-surface-subtle text-ink-secondary") : "";
    const isPending = mutation.isPending || followupMutation.isPending;

    return (
      <div key={po.id} className="border border-line rounded-lg overflow-hidden">

        {/* ── Row ── */}
        <div
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors ${isExpanded ? "bg-surface-muted" : "bg-surface"}`}
          onClick={() => setExpandedId(isExpanded ? null : po.id)}
        >
          {/* Tone dot */}
          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${
            tone === "red" ? "bg-status-danger-fg" :
            tone === "yellow" ? "bg-status-warn-fg" :
            tone === "green" ? "bg-status-success-fg" : "bg-ink-tertiary"
          }`} />

          {/* Student + status */}
          <div className="w-[220px] shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-semibold truncate">{po.student}</span>
              {po.grade && <span className="text-[12px] text-ink-tertiary">Gr {po.grade}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {po.status && (
                <span className={`badge text-[11px] font-semibold ${statusBadgeClass}`}>{po.status}</span>
              )}
              {isReviewed && <span className="badge bg-surface-subtle text-ink-tertiary text-[10px]">Reviewed</span>}
            </div>
          </div>

          {/* PO details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-ink-secondary">{po.date ? formatDate(po.date, "short") : "—"}</span>
              {po.time && <span className="text-[12px] text-ink-tertiary">{po.time}</span>}
              {po.subjects.length > 0 && (
                <span className="text-[12px] text-ink-secondary">{po.subjects.join(" + ")}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {po.outcome === "Enrolled" && <span className="badge bg-status-success-bg text-status-success-fg text-[11px]">Enrolled ✓</span>}
              {po.outcome === "Plan to Enroll" && <span className="badge bg-status-warn-bg text-status-warn-fg text-[11px]">Plan to Enroll</span>}
              {po.outcome === "Undecided" && <span className="badge bg-surface-subtle text-ink-secondary text-[11px]">Undecided</span>}
              {po.outcome === "Not Interested" && <span className="badge bg-surface-subtle text-ink-tertiary text-[11px]">Not Interested</span>}
              {po.eEnrollmentCompleted && <span className="badge bg-status-success-bg text-status-success-fg text-[11px]">eEnrollment ✓</span>}
              {po.plannedStartDate && <span className="badge bg-tint-blue-bg text-tint-blue-fg text-[11px]">Starts {formatDate(po.plannedStartDate, "short")}</span>}
              {po.phone && <span className="text-[11px] text-ink-tertiary hidden xl:inline">☎ {po.phone}</span>}
            </div>
          </div>

          {/* Last contact */}
          <div className="w-[160px] shrink-0 hidden md:block">
            <LastContactBadge lastContactDate={po.lastContactDate} today={today} />
          </div>

          {/* Quick action buttons */}
          <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isNoShow ? (
              // No-show: Email & Archive (primary) + Archive (no email)
              <>
                <button
                  disabled={isPending}
                  onClick={() => {
                    followupMutation.mutate(po.id, {
                      onSuccess: () => setFollowupSentIds((prev) => new Set(prev).add(po.id))
                    });
                    if (!isHistory) quickArchive(po);
                  }}
                  className="btn inline-flex items-center gap-1 text-[12px]"
                  title={isHistory ? "Queue re-schedule email" : "Send re-schedule email and archive"}
                >
                  <Send className="w-3 h-3" />
                  {isHistory ? "Email" : "Email & Archive"}
                </button>
                {!isHistory && (
                  <button
                    disabled={isPending}
                    onClick={() => quickArchive(po)}
                    className="btn p-1.5"
                    title="Archive without email"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              // Attended PO: outcome quick-set + follow-up + archive
              <>
                <button
                  disabled={isPending}
                  onClick={() => quickArchive(po, "Enrolled")}
                  className="btn inline-flex items-center gap-1 text-[12px]"
                  title="Enrolled with a future start date set — use when you've locked in a specific first day. Lifecycle → Pending Start."
                >
                  <CheckCircle className="w-3 h-3" />
                  Enrolled — start date set
                </button>
                <button
                  disabled={isPending}
                  onClick={() => quickArchive(po, "Enrolled", "Active-Engaged")}
                  className="btn inline-flex items-center gap-1 text-[12px]"
                  title="Enrolled AND already had their first class. Lifecycle → Active-Engaged."
                >
                  <CheckCircle className="w-3 h-3" />
                  Enrolled — active now
                </button>
                <button
                  disabled={isPending}
                  onClick={() => quickArchive(po, "Plan to Enroll")}
                  className="btn inline-flex items-center gap-1 text-[12px]"
                  title="Said yes but no start date set yet — system will send enrollment steps and follow up until date is locked in. Lifecycle → PO Attended – Plan to Enroll."
                >
                  <CheckCircle className="w-3 h-3" />
                  Plan to Enroll
                </button>
                <button
                  disabled={isPending}
                  onClick={() => quickArchive(po, "Undecided")}
                  className="btn inline-flex items-center gap-1 text-[12px]"
                  title="Interested but not ready to commit — system sends low-pressure follow-ups. Lifecycle → PO Attended – Undecided."
                >
                  <Clock className="w-3 h-3" />
                  Undecided
                </button>
                <button
                  disabled={isPending}
                  onClick={() => quickArchive(po, "Not Interested")}
                  className="btn inline-flex items-center gap-1 text-[12px] text-ink-tertiary"
                  title="Definite no — excluded from all future outreach campaigns."
                >
                  <XCircle className="w-3 h-3" />
                  Not Interested
                </button>
                <button
                  disabled={isPending || emailSent}
                  onClick={() => {
                    if (emailSent) return;
                    followupMutation.mutate(po.id, {
                      onSuccess: () => setFollowupSentIds((prev) => new Set(prev).add(po.id))
                    });
                  }}
                  className={`btn inline-flex items-center gap-1 text-[12px] ${emailSent ? "bg-status-success-bg text-status-success-fg border-status-success-fg opacity-80 cursor-default" : ""}`}
                  title={emailSent ? "Email queued — check Gmail drafts" : "Queue follow-up email (does not archive)"}
                >
                  <Send className="w-3 h-3" />
                  {emailSent ? "Queued ✓" : "Email"}
                </button>
                {!isHistory && (
                  <button
                    disabled={isPending}
                    onClick={() => quickArchive(po)}
                    className="btn p-1.5"
                    title="Archive without setting outcome"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}

              </>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-tertiary ml-1" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary ml-1" />}
          </div>
        </div>

        {/* ── Expanded detail panel ── */}
        {isExpanded && expanded && (
          <div className="border-t border-line p-4 space-y-4 bg-surface">
            {/* Context */}
            <div className="card">
              <div className="panel-head bg-tint-notes-bg text-tint-notes-fg">
                <span>{expanded.student} · {expanded.grade && `Gr ${expanded.grade}`}</span>
                <span className="text-[12px]">{expanded.date && formatDate(expanded.date, "long")} · {expanded.time}</span>
              </div>
              <div className="panel-body grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px]">
                <div>
                  <span className="text-ink-tertiary text-[11px] block">Status</span>
                  {expanded.status && (
                    <span className={`badge text-[12px] font-semibold ${STATUS_BADGE[expanded.status] ?? "bg-surface-subtle text-ink-secondary"}`}>{expanded.status}</span>
                  )}
                </div>
                <div><span className="text-ink-tertiary text-[11px] block">Phone</span>{expanded.phone ?? "—"}</div>
                <div><span className="text-ink-tertiary text-[11px] block">Booking</span>{expanded.source ?? "—"}</div>
                <div><span className="text-ink-tertiary text-[11px] block">Subjects</span>{expanded.subjects.join(" + ") || "—"}</div>
                <div>
                  <span className="text-ink-tertiary text-[11px] block">Last contact</span>
                  <LastContactBadge lastContactDate={expanded.lastContactDate} today={today} />
                </div>
              </div>
            </div>

            {/* Recap fields */}
            <div className="card card-body">
              <p className="text-[14px] font-medium mb-3">Recap &amp; follow-up plan</p>
              <Field label="Outcome">
                <ChipGroup value={outcome} onChange={setOutcome} options={PO_OUTCOMES} />
              </Field>
              <div className={`rounded p-2.5 mb-4 ${eEnroll ? "bg-status-success-bg text-status-success-fg" : "bg-surface-subtle text-ink-secondary border border-line"}`}>
                <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={eEnroll} onChange={(e) => setEEnroll(e.target.checked)} />
                  <span className="font-medium">eEnrollment form completed</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Planned start date">
                  <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Planned class time">
                  <TextInput value={classTime} onChange={(e) => setClassTime(e.target.value)} placeholder="e.g. 4:30 PM" />
                </Field>
              </div>
              <Field label="Planned schedule">
                <ChipGroup multi value={schedule} onChange={setSchedule} options={WEEKDAYS} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Recommended math level"><TextInput value={mathLevel} onChange={(e) => setMathLevel(e.target.value)} /></Field>
                <Field label="Recommended reading level"><TextInput value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Subject interest"><ChipGroup multi value={subjects} onChange={setSubjects} options={["Math", "Reading"]} /></Field>
                <Field label="Lead source">
                  <Select value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                    <option value="">—</option>
                    <option value="Google search">Google search</option>
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Web">Web</option>
                  </Select>
                </Field>
              </div>
              <div className="border border-line rounded-md p-3">
                <p className="text-[12px] font-medium text-ink-secondary mb-2">📍 30-Day Plan (Skills GPS)</p>
                <Field label="30-day vision">
                  <TextArea value={thirtyDayVision} onChange={(e) => setThirtyDayVision(e.target.value)} rows={3} placeholder="e.g. Student starts work promptly, reads directions before beginning…" />
                </Field>
                <Field label="GPS priorities">
                  <ChipGroup
                    multi value={gpsPriorities} onChange={setGpsPriorities}
                    options={[
                      "Studies with concentration","Reads instructions first","Pencil keeps moving",
                      "Eyes on paper","Starts promptly","Writes neatly","Attempts independently",
                      "Completes within SCT","Positive attitude","Consistent attendance & HW"
                    ]}
                  />
                </Field>
              </div>
              <Field label="Staff notes"><TextArea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} className="min-h-[100px]" /></Field>
              {expanded.bookingNotes && (
                <Field label="Booking / PO notes" hint="from original booking">
                  <div className="text-[13px] bg-surface-muted rounded p-2.5 leading-snug">{expanded.bookingNotes}</div>
                </Field>
              )}
            </div>

            {(outcome === "Plan to Enroll" || outcome === "Enrolled") && (
              <PerStudentDetails poId={expanded.id} />
            )}

            {/* Decision panel */}
            <div className="card">
              <div className="panel-head bg-tint-purple-bg text-tint-purple-fg">
                <span><Sparkles className="w-3.5 h-3.5 inline mr-1" />Decision</span>
              </div>
              <div className="panel-body space-y-3">
                {branch && branch.label !== "No email" && (
                  <div className="bg-tint-purple-bg text-tint-purple-fg rounded p-3">
                    <p className="text-[13px] font-medium mb-0.5">Suggested email: {branch.label}</p>
                    <p className="text-[12px]">{branch.reasoning}</p>
                  </div>
                )}
                {expanded.targetLifecycle && (
                  <p className="text-[12px] text-ink-secondary">
                    On archive → <span className="font-medium">{expanded.targetLifecycle}</span>
                  </p>
                )}
                <div className="flex gap-2 justify-end flex-wrap">
                  <button
                    disabled={followupMutation.isPending || followupSentIds.has(expanded.id)}
                    onClick={() => {
                      if (followupSentIds.has(expanded.id)) return;
                      followupMutation.mutate(expanded.id, {
                        onSuccess: () => setFollowupSentIds((prev) => new Set(prev).add(expanded.id))
                      });
                    }}
                    className={`btn inline-flex items-center gap-1.5 ${followupSentIds.has(expanded.id) ? "opacity-50" : ""}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {followupSentIds.has(expanded.id) ? "Email sent ✓" : "Send follow-up email"}
                  </button>
                  <button onClick={() => save(false)} disabled={mutation.isPending} className="btn">
                    {mutation.isPending ? "Saving…" : "Save, decide later"}
                  </button>
                  {!isReviewed && (
                    <button onClick={() => save(true)} disabled={mutation.isPending} className="btn btn-primary">
                      {mutation.isPending ? "Saving…" : "Archive"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Tabs ── */}
      <div className="flex border-b border-line gap-0">
        <button
          onClick={() => setActiveTab("review")}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            activeTab === "review"
              ? "border-tint-blue-fg text-tint-blue-fg"
              : "border-transparent text-ink-secondary hover:text-ink"
          }`}
        >
          Needs Review
          {q.data && (q.data.filter(p => p.date && p.date <= new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())).length) > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-status-warn-fg text-white text-[10px] font-bold">
              {q.data.filter(p => p.date && p.date <= new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-tint-blue-fg text-tint-blue-fg"
              : "border-transparent text-ink-secondary hover:text-ink"
          }`}
        >
          PO History
        </button>
      </div>

      {activeTab === "review" && <>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name…"
          className="w-full border border-line rounded-md pl-8 pr-3 py-2 text-[13px] bg-surface placeholder:text-ink-tertiary"
        />
        {searching && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-tertiary">Searching…</span>}
      </div>

      {/* ── Page Key ── */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-[13px] text-ink-secondary hover:text-ink transition-colors py-1">
          <span className="w-4 h-4 rounded-full border border-line inline-flex items-center justify-center text-[10px] font-bold shrink-0 group-open:bg-surface-subtle">?</span>
          <span className="font-medium">How to use this page</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary group-open:hidden" />
          <ChevronUp className="w-3.5 h-3.5 text-ink-tertiary hidden group-open:block" />
        </summary>

        <div className="mt-3 rounded-xl border border-line bg-surface-subtle overflow-hidden text-[12px]">
          {/* Status dots row */}
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">Status dots</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-status-danger-fg shrink-0" /><span className="text-ink-secondary">No-show / cancelled</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-status-warn-fg shrink-0" /><span className="text-ink-secondary">Attended — awaiting recap</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-status-success-fg shrink-0" /><span className="text-ink-secondary">Attended — recap submitted</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ink-tertiary shrink-0" /><span className="text-ink-secondary">Upcoming</span></span>
            </div>
          </div>

          {/* Attended buttons */}
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">Attended PO — action buttons</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line whitespace-nowrap">✓ Enrolled — start date set</span>
                <span className="text-ink-secondary leading-snug">Enrolled with a specific first day locked in. Lifecycle → <em>Pending Start</em>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-status-success-bg text-status-success-fg whitespace-nowrap">✓ Enrolled — active now</span>
                <span className="text-ink-secondary leading-snug">Enrolled <strong>and already attending</strong> — use when the student has already had their first class. Lifecycle → <em>Active-Engaged</em>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line whitespace-nowrap">✓ Plan to Enroll</span>
                <span className="text-ink-secondary leading-snug">Said yes but no start date yet. System sends enrollment steps and follows up until date is locked in. Lifecycle → <em>PO Attended – Plan to Enroll</em>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">Undecided</span>
                <span className="text-ink-secondary leading-snug">Interested but not ready to commit. System sends low-pressure follow-ups over the next 30 days.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-tertiary border border-line">Not Interested</span>
                <span className="text-ink-secondary leading-snug">Definite no. Archives and flags as <em>Not Interested</em> — excluded from all future campaigns.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">✉ Email</span>
                <span className="text-ink-secondary leading-snug">Queue a follow-up email. Does <strong>not</strong> archive — use when you&apos;re still mid-conversation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">▣ Archive</span>
                <span className="text-ink-secondary leading-snug">Archive without setting an outcome. Use for duplicates or edge cases.</span>
              </div>
            </div>
          </div>

          {/* Lifecycle flow */}
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">What the system does automatically after each outcome</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-ink-secondary leading-snug">
              <div><span className="font-medium">Plan to Enroll + start date</span> → <em>Pending Start</em> → welcome email 7 days before first class</div>
              <div><span className="font-medium">Plan to Enroll, no date yet</span> → <em>PO Attended – Plan to Enroll</em> → cadence engine follows up every few days until date is locked in</div>
              <div><span className="font-medium">Undecided</span> → <em>PO Attended – Undecided</em> → low-pressure follow-up sequence over 30 days</div>
              <div><span className="font-medium">Not Interested</span> → <em>No Interest</em> → excluded from all outreach</div>
              <div><span className="font-medium">No-show</span> → <em>PO No-Show</em> → reschedule offer (3 follow-ups, 45 days)</div>
              <div><span className="font-medium">Family Cancelled</span> → <em>PO Cancelled</em> → winback sequence (4 touches, 30 days)</div>
            </div>
            <p className="text-ink-tertiary mt-2">All follow-up emails are drafted in Gmail for Adam to review — nothing sends automatically.</p>
          </div>

          {/* No-show + Reviewed rows side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">No-show / cancelled buttons</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-status-danger-bg text-status-danger-fg border border-line">Email &amp; Archive</span>
                  <span className="text-ink-secondary leading-snug">Send a re-schedule offer and archive in one tap.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">▣ Archive</span>
                  <span className="text-ink-secondary leading-snug">Archive silently — you already reached them by phone.</span>
                </div>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">Reviewed section (bottom of page)</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">Follow-up</span>
                  <span className="text-ink-secondary leading-snug">Send another email to a family whose PO is already reviewed.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-ink-secondary border border-line">✕ Dismiss</span>
                  <span className="text-ink-secondary leading-snug">Hide from view until next page load. No changes in Airtable.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Column headers */}
      <div className="hidden md:flex items-center gap-3 px-4 text-[11px] font-medium text-ink-tertiary uppercase tracking-wide">
        <span className="w-2.5 shrink-0" />
        <span className="w-[220px] shrink-0">Student</span>
        <span className="flex-1">PO details</span>
        <span className="w-[160px] shrink-0">Last contact</span>
        <span className="shrink-0 w-[280px] text-right">Actions</span>
      </div>

      {/* ── Past POs — needs action ── */}
      <section>
        <p className="text-[15px] font-semibold mb-2">
          Past POs — needs action
          {pastPOs.length > 0 && <span className="ml-1.5 text-[13px] font-normal text-ink-tertiary">({pastPOs.length})</span>}
        </p>
        {pastPOs.length === 0 && !searching && (
          <EmptyState message="All caught up — no past POs need attention." />
        )}
        <div className="space-y-1.5">
          {pastPOs.map((po) => renderPORow(po))}
        </div>
      </section>

      {/* ── Upcoming ── */}
      {scheduledPOs.length > 0 && (
        <section>
          <p className="text-[15px] font-semibold mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-ink-tertiary" />
            Upcoming
            <span className="text-[13px] font-normal text-ink-tertiary">({scheduledPOs.length})</span>
          </p>
          <div className="space-y-1.5">
            {scheduledPOs.map((po) => (
              <div key={po.id} className="card card-body flex items-center gap-3 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-ink-tertiary shrink-0" />
                <div className="w-[220px] shrink-0">
                  <span className="text-[14px] font-semibold">{po.student}</span>
                  {po.grade && <span className="text-[12px] text-ink-tertiary ml-1.5">Gr {po.grade}</span>}
                </div>
                <div className="flex-1 text-[12px] text-ink-secondary">
                  {po.date ? formatDate(po.date, "short") : "—"}
                  {po.time && ` · ${po.time}`}
                  {po.subjects.length > 0 && <span className="ml-2">{po.subjects.join(" + ")}</span>}
                </div>
                {po.phone && <span className="text-[12px] text-ink-tertiary hidden lg:block">☎ {po.phone}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Archived this session ── */}
      {archivedList.length > 0 && (
        <section className="border-t border-line pt-4">
          <p className="text-[12px] text-ink-tertiary mb-1.5">Archived this session ({archivedList.length})</p>
          <div className="space-y-1 opacity-40">
            {archivedList.map((po) => (
              <div key={po.id} className="flex items-center gap-3 px-3 py-1.5 rounded text-[13px]">
                <span className="w-2 h-2 rounded-full bg-ink-tertiary shrink-0" />
                <span className="font-medium">{po.student}</span>
                <span className="text-ink-tertiary">{po.date ? formatDate(po.date, "short") : "—"}</span>
                <span className="ml-auto text-ink-tertiary">✓ Archived</span>
              </div>
            ))}
          </div>
        </section>
      )}

      </>}

      {/* ── History Tab ── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search by student name…"
              className="w-full border border-line rounded-md pl-8 pr-3 py-2 text-[13px] bg-surface placeholder:text-ink-tertiary"
            />
          </div>

          {historyQuery.isPending && <Skeleton rows={6} />}
          {historyQuery.isError && <ErrorState message={historyQuery.error.message} onRetry={() => historyQuery.refetch()} />}

          {historyQuery.data && (
            <>
              <div className="hidden md:flex items-center gap-3 px-4 text-[11px] font-medium text-ink-tertiary uppercase tracking-wide">
                <span className="w-2.5 shrink-0" />
                <span className="w-[220px] shrink-0">Student</span>
                <span className="w-[120px] shrink-0">Date</span>
                <span className="flex-1">Status / Outcome</span>
                <span className="w-4 shrink-0" />
              </div>
              <div className="space-y-1">
                {historyQuery.data.length === 0 && (
                  <EmptyState message={historySearch.length >= 2 ? `No POs found for "${historySearch}".` : "No past POs found."} />
                )}
                {historyQuery.data.map((po) => renderPORow(po, { isHistory: true }))}
              </div>
              {historySearch.length < 2 && historyQuery.data.length > 0 && (
                <p className="text-[11px] text-ink-tertiary text-center pt-1">
                  Showing most recent {historyQuery.data.length} POs · Search by name to go further back
                </p>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
