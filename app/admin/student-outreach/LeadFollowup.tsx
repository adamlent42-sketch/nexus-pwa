"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, ChevronDown, ChevronRight, Mail, MessageSquare, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useForms } from "@/components/forms/FormsProvider";
import { useCreateUpdateEmail } from "@/lib/mutations";
import { EMAIL_TYPES_BY_BUCKET, lifecycleBucket } from "@/lib/options";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { todayInET, relativeTime } from "@/lib/time";

interface LeadStudent {
  id: string;
  name: string;
  grade: string | null;
  lifecycle: string;
  lastContactDate: string | null;
  lastContactType: string | null;
  daysSinceLastContact: number | null;
  reachOutEvery: number;
  onTrack: boolean | null;
  pendingUpdateRequest: boolean;
}

interface LifecycleSummary {
  lifecycle: string;
  cadenceDays: number;
  inProgram: boolean;
  total: number;
  onTrack: number;
  offTrack: number;
  noContact: number;
  percentOnTrack: number | null;
  students: LeadStudent[];
}

interface LeadOutreachData {
  summaries: LifecycleSummary[];
  overall: { total: number; onTrack: number; percentOnTrack: number | null };
}

function healthClass(pct: number | null): string {
  if (pct === null) return "bg-surface-muted text-ink-secondary";
  if (pct >= 90) return "bg-status-success-bg text-status-success-fg";
  if (pct >= 70) return "bg-status-warn-bg text-status-warn-fg";
  return "bg-status-danger-bg text-status-danger-fg";
}

function progressBarClass(pct: number | null): string {
  if (pct === null) return "bg-ink-tertiary";
  if (pct >= 90) return "bg-status-success-fg";
  if (pct >= 70) return "bg-status-warn-fg";
  return "bg-status-danger-fg";
}

export function LeadFollowupTab() {
  const q = useQuery({
    queryKey: ["admin", "lead-outreach"],
    queryFn: () => adminFetch<LeadOutreachData>("/api/admin/lead-outreach")
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);

  const toggle = (k: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  if (q.isPending) return <Skeleton rows={6} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;

  const { summaries, overall } = q.data;

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-ink-secondary">
        Every non-active lifecycle stage with its cadence target. Each row shows what % of students in that stage have been contacted within the cadence window. Drive towards ~100% per stage.
      </p>

      <SyncNowBar />

      <div className="card card-body">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[14px] font-medium">Overall lead follow-up health</p>
            <p className="text-[12px] text-ink-secondary mt-0.5">
              {overall.total} tracked student{overall.total === 1 ? "" : "s"} across all lead lifecycles
            </p>
          </div>
          <span className={`text-[22px] font-semibold px-3 py-1 rounded ${healthClass(overall.percentOnTrack)}`}>
            {overall.percentOnTrack === null ? "—" : `${overall.percentOnTrack}%`}
          </span>
        </div>
        <div className="flex h-3 w-full rounded overflow-hidden border border-line bg-surface-subtle">
          {overall.percentOnTrack !== null && (
            <div
              className={`${progressBarClass(overall.percentOnTrack)} h-full`}
              style={{ width: `${overall.percentOnTrack}%` }}
            />
          )}
        </div>
        <p className="text-[11px] text-ink-tertiary mt-2">
          {overall.onTrack} of {overall.total} students contacted within their cadence
        </p>
      </div>

      <div className="space-y-2">
        {summaries.map((s) => (
          <LifecycleCard
            key={s.lifecycle}
            summary={s}
            expanded={expanded.has(s.lifecycle)}
            onToggle={() => toggle(s.lifecycle)}
            onLog={(student) => setLogTarget({ id: student.id, name: student.name })}
          />
        ))}
      </div>

      <LogConversationDialog student={logTarget} onClose={() => setLogTarget(null)} />
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

  // When a run finishes, refresh the lead list (Last Contact Dates may have moved).
  useEffect(() => {
    const s = statusQ.data?.status ?? null;
    if (prevStatus.v && prevStatus.v !== s && (s === "Done" || s === "Error")) {
      qc.invalidateQueries({ queryKey: ["admin", "lead-outreach"] });
      if (s === "Done") toast.push("Sync finished — list refreshed.", "success");
      if (s === "Error") toast.push("Sync hit an error — see the status line.", "error");
    }
    prevStatus.v = s;
  }, [statusQ.data?.status, qc, toast, prevStatus]);

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch<SyncRequestView & { alreadyQueued: boolean }>("/api/admin/sync-now", {
        method: "POST",
        body: JSON.stringify({ action: "Full Sync", source: "Lead Follow-up page" })
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "sync-now"] });
      toast.push(
        data.alreadyQueued ? "A sync is already queued — hang tight." : "Sync queued — running shortly.",
        "success"
      );
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
            Drafts the emails you&apos;ve queued, scans your Sent mail for ones you already sent, and updates each
            student&apos;s last-contact so they clear from these lists — without waiting for the overnight run.
          </p>
          <div className="mt-2 text-[12px]">
            {statusQ.isPending ? (
              <span className="text-ink-tertiary">Checking sync status…</span>
            ) : running ? (
              <span className="inline-flex items-center gap-1.5 text-status-warn-fg">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {cur?.status === "Requested" ? "Queued — waiting for the sync task to pick it up…" : "Running drafts + sent check…"}
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
        <button
          onClick={() => mutation.mutate()}
          disabled={busy}
          className="btn btn-primary shrink-0"
          title="Queue an on-demand draft + sent-mail sync"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {running ? "Syncing…" : mutation.isPending ? "Queuing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}

function LifecycleCard({
  summary, expanded, onToggle, onLog
}: { summary: LifecycleSummary; expanded: boolean; onToggle: () => void; onLog: (student: LeadStudent) => void }) {
  const forms = useForms();
  const { lifecycle, cadenceDays, inProgram, total, onTrack, offTrack, noContact, percentOnTrack, students } = summary;

  // Multi-select for batch drafting. Eligible = in the outreach program and not
  // already queued. Every student in one card shares a lifecycle, so a single
  // email-type choice applies to the whole selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const eligible = students.filter((s) => inProgram && !s.pendingUpdateRequest);
  const allSelected = eligible.length > 0 && eligible.every((s) => selected.has(s.id));
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const clearSel = () => setSelected(new Set());
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(eligible.map((s) => s.id)));
  const selectedStudents = students.filter((s) => selected.has(s.id)).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full card-body flex items-center gap-3 text-left hover:bg-surface-muted"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-ink-tertiary" /> : <ChevronRight className="w-4 h-4 text-ink-tertiary" />}
        <Target className="w-4 h-4 text-ink-secondary" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium leading-tight flex items-center gap-2 flex-wrap">
            {lifecycle}
            <span className="badge bg-surface-muted text-ink-secondary font-normal">
              {inProgram ? `${cadenceDays}d cadence` : "not tracked"}
            </span>
            <span className="text-[12px] text-ink-tertiary font-normal">{total} student{total === 1 ? "" : "s"}</span>
          </p>
          {inProgram && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded overflow-hidden border border-line bg-surface-subtle">
                {percentOnTrack !== null && (
                  <div
                    className={`${progressBarClass(percentOnTrack)} h-full`}
                    style={{ width: `${percentOnTrack}%` }}
                  />
                )}
              </div>
              <span className="text-[12px] text-ink-secondary">
                {onTrack}/{onTrack + offTrack} on track
                {noContact > 0 && <span className="text-ink-tertiary"> · {noContact} no contact</span>}
              </span>
            </div>
          )}
        </div>
        <span className={`text-[16px] font-semibold px-2.5 py-0.5 rounded ${healthClass(percentOnTrack)}`}>
          {percentOnTrack === null ? (inProgram ? "—" : "n/a") : `${percentOnTrack}%`}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-line">
          {students.length === 0 ? (
            <p className="text-[12px] text-ink-tertiary py-3">No students in this lifecycle.</p>
          ) : (
            <>
              {eligible.length > 0 && (
                <div className="flex items-center justify-between gap-2 mt-2">
                  <label className="inline-flex items-center gap-2 text-[12px] text-ink-secondary cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    Select all ({eligible.length})
                  </label>
                  {selected.size > 0 && (
                    <div className="flex items-center gap-2">
                      <button onClick={clearSel} className="text-[12px] text-ink-tertiary hover:text-ink">Clear</button>
                      <button onClick={() => setBatchOpen(true)} className="btn btn-primary">
                        <Mail className="w-3.5 h-3.5" /> Draft email ({selected.size})
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5 mt-2">
                {students.map((s) => (
                  <LeadRow
                    key={s.id}
                    student={s}
                    inProgram={inProgram}
                    selectable={inProgram && !s.pendingUpdateRequest}
                    selected={selected.has(s.id)}
                    onSelectChange={() => toggleSel(s.id)}
                    onDraft={() => forms.openUpdateEmail({ id: s.id, name: s.name, grade: s.grade, status: s.lifecycle })}
                    onLog={() => onLog(s)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <BatchDraftDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        lifecycle={lifecycle}
        students={selectedStudents}
        onQueued={clearSel}
      />
    </div>
  );
}

function LeadRow({
  student, inProgram, selectable, selected, onSelectChange, onDraft, onLog
}: {
  student: LeadStudent;
  inProgram: boolean;
  selectable: boolean;
  selected: boolean;
  onSelectChange: () => void;
  onDraft: () => void;
  onLog: () => void;
}) {
  const { name, grade, lastContactDate, lastContactType, daysSinceLastContact, reachOutEvery, onTrack, pendingUpdateRequest } = student;
  const overdueBy = daysSinceLastContact !== null && reachOutEvery > 0
    ? daysSinceLastContact - reachOutEvery
    : null;
  const statusBadge = !inProgram
    ? null
    : onTrack === true
    ? <span className="badge bg-status-success-bg text-status-success-fg font-normal">On track</span>
    : onTrack === false
    ? <span className="badge bg-status-danger-bg text-status-danger-fg font-normal">Overdue {overdueBy! > 0 ? `+${overdueBy}d` : ""}</span>
    : <span className="badge bg-surface-muted text-ink-tertiary font-normal">No contact yet</span>;

  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded ${pendingUpdateRequest ? "bg-surface-subtle opacity-60" : "hover:bg-surface-subtle"}`}>
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelectChange}
          className="shrink-0"
          aria-label={`Select ${name}`}
        />
      ) : (
        <span className="w-[13px] shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight flex items-center gap-2 flex-wrap">
          {name}
          {grade && <span className="text-[11px] text-ink-tertiary font-normal">Gr {grade}</span>}
          {statusBadge}
          {pendingUpdateRequest && <span className="badge bg-surface-muted text-ink-secondary font-normal">Draft queued</span>}
        </p>
        <p className="text-[11px] text-ink-tertiary mt-0.5">
          {lastContactDate
            ? <>Last contact {formatDate(lastContactDate, "short")}{lastContactType && ` (${lastContactType})`}{daysSinceLastContact !== null && ` · ${daysSinceLastContact}d ago`}</>
            : <>No contact on record</>
          }
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          onClick={onLog}
          disabled={pendingUpdateRequest}
          className="btn"
          title={pendingUpdateRequest ? "Draft already queued" : "Log an in-person or phone conversation — resets the clock"}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Log
        </button>
        <button
          onClick={onDraft}
          disabled={pendingUpdateRequest || !inProgram}
          className="btn"
          title={pendingUpdateRequest ? "Draft already queued — drafts overnight at 10:41 PM ET" : !inProgram ? "Lifecycle not in outreach program" : "Draft a personalized email"}
        >
          <Mail className="w-3.5 h-3.5" /> {pendingUpdateRequest ? "Draft queued…" : "Draft email"}
        </button>
      </div>
    </div>
  );
}

// Batch-queue the same email type for several selected students at once.
function BatchDraftDialog({
  open, onClose, lifecycle, students, onQueued
}: {
  open: boolean;
  onClose: () => void;
  lifecycle: string;
  students: { id: string; name: string }[];
  onQueued: () => void;
}) {
  const bucket = lifecycleBucket(lifecycle);
  const typeOptions = EMAIL_TYPES_BY_BUCKET[bucket];
  const [emailType, setEmailType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateUpdateEmail();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setEmailType(typeOptions[0] ?? null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = students.length;

  const submit = async () => {
    setError(null);
    if (!emailType) { setError("Pick an email type"); return; }
    if (count === 0) { onClose(); return; }
    try {
      for (const s of students) {
        await mutation.mutateAsync({
          studentId: s.id,
          submittedBy: "—",
          isQuickNote: false,
          emailType
        });
      }
      toast.push(`Queued ${count} draft${count === 1 ? "" : "s"} — ${emailType}. They draft overnight (10:41 PM ET).`, "success");
      onQueued();
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to queue some drafts", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Draft email — ${count} student${count === 1 ? "" : "s"}`}
      icon={<Mail className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Queuing…" : `Queue ${count} draft${count === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-ink-secondary mb-3">
        Queues the same email type for every selected student in <span className="font-medium">{lifecycle}</span>. Each drafts overnight using that student&apos;s own context (PO recap, levels, history). For a tailored, per-student note, use the single &ldquo;Draft email&rdquo; button instead.
      </p>
      <Field label="Email type" required>
        <ChipGroup value={emailType} onChange={setEmailType} options={typeOptions} />
      </Field>
      <div className="mt-3 text-[12px] text-ink-tertiary">
        <span className="font-medium text-ink-secondary">Selected:</span>{" "}
        {students.map((s) => s.name).join(", ")}
      </div>
      {error && <p className="text-[12px] text-status-danger-fg mt-2 mb-1">{error}</p>}
    </Modal>
  );
}

function LogConversationDialog({ student, onClose }: { student: { id: string; name: string } | null; onClose: () => void }) {
  const today = todayInET();
  const [type, setType] = useState<string | null>("In Person");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const open = !!student;

  useEffect(() => {
    if (open) {
      setType("In Person");
      setDate(today);
      setNotes("");
      setError(null);
    }
  }, [open, student?.id, today]);

  const mutation = useMutation({
    mutationFn: (payload: { studentId: string; type: string; date: string; notes?: string }) =>
      adminFetch<{ id: string; date: string; type: string }>("/api/admin/log-conversation", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lead-outreach"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-outreach"] });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "lead-outreach"] }), 2500);
    }
  });

  const submit = async () => {
    setError(null);
    if (!student) return;
    if (!type) { setError("Pick a conversation type"); return; }
    if (!date) { setError("Pick a date"); return; }
    try {
      await mutation.mutateAsync({ studentId: student.id, type, date, notes: notes.trim() || undefined });
      toast.push(`Conversation logged for ${student.name}.`, "success");
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
      <p className="text-[13px] text-ink-secondary mb-4">
        Records a Communications row for this student so the outreach clock resets. No email is sent.
      </p>
      <Field label="Type" required>
        <ChipGroup value={type} onChange={setType} options={["In Person", "Phone Call"]} />
      </Field>
      <Field label="Date" required hint="defaults to today; can't be in the future">
        <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Notes" hint="optional — what you talked about, takeaways">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
    </Modal>
  );
}
