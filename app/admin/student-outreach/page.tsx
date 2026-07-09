"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail, MessageSquare, UserCog, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Megaphone, Info
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput, TextArea, Field } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/lib/toast";
import { useForms } from "@/components/forms/FormsProvider";
import { todayInET, relativeTime } from "@/lib/time";
import { formatDate } from "@/lib/utils";

type LaneKey = "retention" | "pipeline" | "recovery" | "reactivation";
type OutreachState = "overdue" | "due-soon" | "on-track" | "no-contact";

interface OutreachStudent {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  lifecycle: string;
  lane: LaneKey;
  laneLabel: string;
  lastContactDate: string | null;
  lastContactType: string | null;
  daysSinceLastContact: number | null;
  reachOutEvery: number | null;
  state: OutreachState;
  overdueBy: number | null;
  commQueueStatus: string | null;
  snoozeUntil: string | null;
  snoozed: boolean;
  pendingUpdateRequest: boolean;
}

interface LaneSummary {
  key: LaneKey;
  label: string;
  blurb: string;
  total: number;
  onTrack: number;
  overdue: number;
  dueSoon: number;
  noContact: number;
  percentOnCadence: number | null;
}

interface OutreachData {
  lanes: LaneSummary[];
  overall: { total: number; onTrack: number; overdue: number; percentOnCadence: number | null };
  students: OutreachStudent[];
  worklist: OutreachStudent[];
}

const LANE_ACCENT: Record<LaneKey, string> = {
  retention: "bg-tint-pos-bg text-tint-pos-fg",
  pipeline: "bg-tint-notes-bg text-tint-notes-fg",
  recovery: "bg-tint-purple-bg text-tint-purple-fg",
  reactivation: "bg-tint-alerts-bg text-tint-alerts-fg"
};

function healthText(pct: number | null): string {
  if (pct === null) return "text-ink-tertiary";
  if (pct >= 90) return "text-status-success-fg";
  if (pct >= 70) return "text-status-warn-fg";
  return "text-status-danger-fg";
}
function healthBar(pct: number | null): string {
  if (pct === null) return "bg-ink-tertiary";
  if (pct >= 90) return "bg-status-success-fg";
  if (pct >= 70) return "bg-status-warn-fg";
  return "bg-status-danger-fg";
}

function StateBadge({ s }: { s: OutreachStudent }) {
  if (s.state === "overdue")
    return <span className="badge bg-status-danger-bg text-status-danger-fg font-normal">Overdue{s.overdueBy && s.overdueBy > 0 ? ` +${s.overdueBy}d` : ""}</span>;
  if (s.state === "due-soon")
    return <span className="badge bg-status-warn-bg text-status-warn-fg font-normal">Due soon</span>;
  if (s.state === "no-contact")
    return <span className="badge bg-surface-muted text-ink-secondary font-normal">No contact yet</span>;
  return <span className="badge bg-status-success-bg text-status-success-fg font-normal">On track</span>;
}

export default function OutreachCommandCenter() {
  const forms = useForms();
  const qc = useQueryClient();
  const [laneFilter, setLaneFilter] = useState<LaneKey | "all">("all");
  const [search, setSearch] = useState("");
  const [showOnTrack, setShowOnTrack] = useState(false);
  const [logTarget, setLogTarget] = useState<OutreachStudent | null>(null);

  const q = useQuery({
    queryKey: ["admin", "outreach"],
    queryFn: () => adminFetch<OutreachData>("/api/admin/outreach")
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const base = showOnTrack ? q.data.students.filter((s) => !s.snoozed) : q.data.worklist;
    let list = laneFilter === "all" ? base : base.filter((s) => s.lane === laneFilter);
    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(t));
    }
    return list;
  }, [q.data, laneFilter, search, showOnTrack]);

  if (q.isPending) return <Skeleton rows={8} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;

  const { lanes, overall } = q.data;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand" />
          <div>
            <p className="text-[16px] font-medium leading-tight">Outreach command center</p>
            <p className="text-[12px] text-ink-secondary mt-0.5">
              Everyone who needs communication — retention, pipeline, recovery, reactivation — in one prioritized list. Drive each lane toward 100% on-cadence.
            </p>
          </div>
        </div>
        <button onClick={() => q.refetch()} className="btn" disabled={q.isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> {q.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-subtle px-3.5 py-3 text-[12px] text-ink-secondary">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-tertiary" />
        <span>
          <span className="font-medium text-ink">How drafts work:</span>{" "}
          Click <span className="font-medium text-ink">Draft email</span> → row turns grey (&ldquo;Draft queued&rdquo;) → draft appears in Gmail at{" "}
          <span className="font-medium text-ink">10:41 PM ET</span> nightly.{" "}
          Don&apos;t want to wait? Hit <span className="font-medium text-ink">Sync now</span> below to draft immediately.
        </span>
      </div>

      <SyncNowBar />

      {/* Scoreboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {lanes.map((l) => {
          const active = laneFilter === l.key;
          return (
            <button
              key={l.key}
              onClick={() => setLaneFilter(active ? "all" : l.key)}
              className={`card card-body text-left transition-colors ${active ? "border-brand ring-1 ring-brand/30" : "hover:border-brand"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`badge ${LANE_ACCENT[l.key]}`}>{l.label}</span>
                <span className={`text-[20px] font-semibold ${healthText(l.percentOnCadence)}`}>
                  {l.percentOnCadence === null ? "—" : `${l.percentOnCadence}%`}
                </span>
              </div>
              <p className="text-[11px] text-ink-tertiary mt-1">{l.blurb}</p>
              <div className="flex h-2 w-full rounded overflow-hidden border border-line bg-surface-subtle mt-2">
                {l.percentOnCadence !== null && (
                  <div className={`${healthBar(l.percentOnCadence)} h-full`} style={{ width: `${l.percentOnCadence}%` }} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-secondary">
                <span>{l.total} total</span>
                {l.overdue > 0 && <span className="text-status-danger-fg font-medium">· {l.overdue} overdue</span>}
                {l.noContact > 0 && <span className="text-ink-tertiary">· {l.noContact} no contact</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setLaneFilter("all")}
            className={`badge ${laneFilter === "all" ? "bg-brand text-white" : "bg-surface-muted text-ink-secondary"}`}
          >
            All lanes
          </button>
          {lanes.map((l) => (
            <button
              key={l.key}
              onClick={() => setLaneFilter(laneFilter === l.key ? "all" : l.key)}
              className={`badge ${laneFilter === l.key ? "bg-brand text-white" : LANE_ACCENT[l.key]}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={showOnTrack} onChange={(e) => setShowOnTrack(e.target.checked)} />
            Show on-track too
          </label>
          <div className="w-[220px]">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium">{showOnTrack ? "All tracked students" : "Needs contact"}</span>
        <span className="text-ink-tertiary">{rows.length} shown</span>
        {!showOnTrack && overall.overdue > 0 && (
          <span className="badge bg-status-danger-bg text-status-danger-fg">{overall.overdue} overdue</span>
        )}
        <span className="text-ink-tertiary ml-auto">Overall on-cadence: <span className={`font-medium ${healthText(overall.percentOnCadence)}`}>{overall.percentOnCadence === null ? "—" : `${overall.percentOnCadence}%`}</span></span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="w-5 h-5 text-status-success-fg" />} message={showOnTrack ? "No students match." : "Nobody's overdue — every lane is on cadence. 🎉"} />
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <WorkRow
              key={s.id}
              s={s}
              onUpdate={() => forms.openStudentUpdate({ id: s.id, name: s.name, grade: s.grade, status: s.lifecycle })}
              onLog={() => setLogTarget(s)}
              onDraft={() => forms.openUpdateEmail({ id: s.id, name: s.name, grade: s.grade, status: s.lifecycle })}
            />
          ))}
        </div>
      )}

      <LogConversationDialog student={logTarget} onClose={() => setLogTarget(null)} />
    </div>
  );
}

function WorkRow({ s, onUpdate, onLog, onDraft }: { s: OutreachStudent; onUpdate: () => void; onLog: () => void; onDraft: () => void }) {
  const meta: string[] = [];
  if (s.subjects.length) meta.push(s.subjects.join(" + "));
  if (s.mathLevel) meta.push(`M ${s.mathLevel}`);
  if (s.readingLevel) meta.push(`R ${s.readingLevel}`);
  const isPending = s.pendingUpdateRequest;

  return (
    <div className={`card card-body flex items-center justify-between gap-3 ${isPending ? "opacity-60 bg-surface-subtle" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium leading-tight flex items-center gap-2 flex-wrap">
          {s.name}
          {s.grade && <span className="text-[12px] text-ink-secondary font-normal">Gr {s.grade}</span>}
          <span className={`badge ${LANE_ACCENT[s.lane]} font-normal`}>{s.laneLabel}</span>
          <span className="text-[11px] text-ink-tertiary font-normal">{s.lifecycle}</span>
          <StateBadge s={s} />
          {isPending && <span className="badge bg-surface-muted text-ink-secondary font-normal">Draft queued</span>}
        </p>
        {meta.length > 0 && <p className="meta mt-1">{meta.join(" · ")}</p>}
        <p className="text-[12px] text-ink-tertiary mt-1">
          {s.lastContactDate
            ? <>Last contact {formatDate(s.lastContactDate, "short")}{s.lastContactType && ` (${s.lastContactType})`}{s.daysSinceLastContact !== null && ` · ${s.daysSinceLastContact}d ago`}</>
            : <>No contact on record yet.</>}
          {s.reachOutEvery ? <span className="ml-2">· cadence {s.reachOutEvery}d</span> : null}
          {s.snoozeUntil && <span className="ml-2 text-ink-secondary">· snoozed until {formatDate(s.snoozeUntil, "short")}</span>}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
        <button onClick={onUpdate} className="btn" title="Update schedule, pickup day, pause/stop/restart, lifecycle">
          <UserCog className="w-3.5 h-3.5" /> Update
        </button>
        <button onClick={onLog} disabled={isPending} className="btn" title={isPending ? "Draft already queued" : "Log an in-person or phone conversation — resets the clock"}>
          <MessageSquare className="w-3.5 h-3.5" /> Log
        </button>
        <button onClick={onDraft} disabled={isPending} className={isPending ? "btn" : s.state === "overdue" ? "btn btn-primary" : "btn"}
          title={isPending ? "Draft is queued — drafts overnight at 10:41 PM ET" : "Open the Update Email form pre-filled with this student"}>
          <Mail className="w-3.5 h-3.5" /> {isPending ? "Queued…" : "Draft email"}
        </button>
      </div>
    </div>
  );
}

interface SyncRequestView {
  id: string;
  status: "Requested" | "Running" | "Done" | "Error" | string;
  action: string;
  requestedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
}

function SyncNowBar() {
  const qc = useQueryClient();
  const toast = useToast();
  const prevStatus = useState<{ v: string | null }>(() => ({ v: null }))[0];

  const statusQ = useQuery({
    queryKey: ["admin", "sync-now"],
    queryFn: () => adminFetch<SyncRequestView | null>("/api/admin/sync-now"),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "Requested" || s === "Running" ? 8000 : false;
    }
  });

  useEffect(() => {
    const s = statusQ.data?.status ?? null;
    if (prevStatus.v && prevStatus.v !== s && (s === "Done" || s === "Error")) {
      qc.invalidateQueries({ queryKey: ["admin", "outreach"] });
      if (s === "Done") toast.push("Sync finished — list refreshed.", "success");
      if (s === "Error") toast.push("Sync hit an error — see the status line.", "error");
    }
    prevStatus.v = s;
  }, [statusQ.data?.status, qc, toast, prevStatus]);

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch<SyncRequestView & { alreadyQueued: boolean }>("/api/admin/sync-now", {
        method: "POST",
        body: JSON.stringify({ action: "Full Sync", source: "Outreach command center" })
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "sync-now"] });
      toast.push(data.alreadyQueued ? "A sync is already queued — hang tight." : "Sync queued — running shortly.", "success");
    },
    onError: (e) => toast.push(e instanceof Error ? e.message : "Failed to queue sync", "error")
  });

  const cur = statusQ.data;
  const running = cur?.status === "Requested" || cur?.status === "Running";
  const busy = running || mutation.isPending;

  return (
    <div className="card card-body">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Sync now</p>
          <p className="text-[12px] text-ink-secondary mt-0.5">
            Drafts queued emails, scans Sent mail for ones you already sent, and refreshes each student&apos;s last-contact so they clear from these lists — without waiting for the overnight run.
          </p>
          <div className="mt-2 text-[12px]">
            {statusQ.isPending ? (
              <span className="text-ink-tertiary">Checking sync status…</span>
            ) : running ? (
              <span className="inline-flex items-center gap-1.5 text-status-warn-fg">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {cur?.status === "Requested" ? "Queued — waiting for the sync task…" : "Running drafts + sent check…"}
              </span>
            ) : cur?.status === "Done" ? (
              <span className="inline-flex items-start gap-1.5 text-status-success-fg">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="text-ink-secondary">
                  Last sync {relativeTime(cur.completedAt ?? cur.requestedAt)}
                  {cur.resultSummary ? <> · <span className="text-ink-tertiary">{cur.resultSummary}</span></> : null}
                </span>
              </span>
            ) : cur?.status === "Error" ? (
              <span className="inline-flex items-start gap-1.5 text-status-danger-fg">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{cur.resultSummary ?? "Last sync errored."}</span>
              </span>
            ) : (
              <span className="text-ink-tertiary">No sync run yet.</span>
            )}
          </div>
        </div>
        <button onClick={() => mutation.mutate()} disabled={busy} className="btn btn-primary shrink-0" title="Queue an on-demand draft + sent-mail sync">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {running ? "Syncing…" : mutation.isPending ? "Queuing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}

function LogConversationDialog({ student, onClose }: { student: OutreachStudent | null; onClose: () => void }) {
  const today = todayInET();
  const [type, setType] = useState<string | null>("In Person");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const open = !!student;

  useEffect(() => {
    if (open) { setType("In Person"); setDate(today); setNotes(""); setError(null); }
  }, [open, student?.id, today]);

  const mutation = useMutation({
    mutationFn: (payload: { studentId: string; type: string; date: string; notes?: string }) =>
      adminFetch<{ id: string; date: string; type: string }>("/api/admin/log-conversation", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "outreach"] });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "outreach"] }), 2500);
    }
  });

  const submit = async () => {
    setError(null);
    if (!student) return;
    if (!type) { setError("Pick a conversation type"); return; }
    if (!date) { setError("Pick a date"); return; }
    try {
      await mutation.mutateAsync({ studentId: student.id, type, date, notes: notes.trim() || undefined });
      toast.push(`Conversation logged for ${student.name}. Refreshing…`, "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to log", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? `Log conversation — ${student.name}` : "Log conversation"}
      icon={<MessageSquare className="w-4 h-4" />}
      tintClassName="bg-tint-purple-bg text-tint-purple-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending || !student} className="btn btn-primary">
            {mutation.isPending ? "Logging…" : "Log conversation"}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-ink-se