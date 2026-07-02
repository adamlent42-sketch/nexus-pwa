"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, MessageSquare, Mail } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Field";
import { useToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

type CheckinState = {
  state: "locked" | "due" | "overdue" | "done" | "moot";
  dueDate: string | null;
  doneDate: string | null;
  method: string | null;
};
interface Row {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  firstClassDate: string | null;
  firstClassAttended: string | null;
  enrollDate: string | null;
  startedDate: string | null;
  eEnrolled: boolean;
  week1?: CheckinState;
  week4?: CheckinState;
}
interface OnboardingData { planned: Row[]; pastDue: Row[]; firstMonthWatch: Row[]; }

async function fetchOnboarding(): Promise<OnboardingData> {
  const res = await fetch("/api/students/onboarding");
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "Failed to load");
  return body.data as OnboardingData;
}

const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun"
};
function days(s: Row): string {
  if (!s.schedule.length) return "";
  return s.schedule.map((d) => DAY_ABBR[d] ?? d).join(" · ");
}
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// One check-in chip: locked (countdown) · due (clickable) · overdue (red, clickable) · done (green).
function CheckButton({ label, st, onClick }: { label: string; st?: CheckinState; onClick: () => void }) {
  if (!st) return null;
  if (st.state === "done") {
    return (
      <span
        title={st.doneDate ? `${label} done ${formatDate(st.doneDate, "short")}${st.method ? ` · ${st.method}` : ""}` : `${label} done`}
        className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-status-success-bg text-status-success-fg">
        <Check className="w-3 h-3" /> {label}
      </span>
    );
  }
  if (st.state === "locked") {
    const d = daysUntil(st.dueDate);
    return (
      <span
        title={st.dueDate ? `Unlocks ${formatDate(st.dueDate, "short")}` : "Not yet"}
        className="inline-flex items-center text-[11px] px-2 py-1 rounded-md bg-surface-subtle text-ink-tertiary border border-line">
        {label}{d != null && d > 0 ? ` · ${d}d` : ""}
      </span>
    );
  }
  if (st.state === "moot") {
    return (
      <span
        title={`${label} check-in skipped — 4-week already done`}
        className="inline-flex items-center text-[11px] px-2 py-1 rounded-md bg-surface-subtle text-ink-tertiary border border-line line-through">
        {label}
      </span>
    );
  }
  const overdue = st.state === "overdue";
  const cls = overdue
    ? "bg-status-danger-bg text-status-danger-fg border-status-danger-fg"
    : "bg-surface text-ink border-brand";
  return (
    <button
      onClick={onClick}
      title={overdue ? `${label} check-in overdue — due ${st.dueDate ? formatDate(st.dueDate, "short") : ""}` : `${label} check-in due`}
      className={`inline-flex items-center text-[11px] px-2 py-1 rounded-md border font-medium hover:opacity-80 ${cls}`}>
      {label}{overdue ? " !" : ""}
    </button>
  );
}

// Recently-started students (Active-Engaged within the last 45 days). Each gets a
// 1-week and 4-week parent check-in button — log a conversation or draft a
// touch-base update email — so every new family is reached early and on time.
export function RecentlyStarted() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["students", "onboarding"], queryFn: fetchOnboarding, staleTime: 15 * 60 * 1000, refetchOnWindowFocus: false });
  const rows = q.data?.firstMonthWatch ?? [];

  const [modal, setModal] = useState<{ id: string; name: string; which: "w1" | "w4" } | null>(null);
  const [note, setNote] = useState("");

  const checkin = useMutation({
    mutationFn: async (vars: { id: string; which: "w1" | "w4"; method: "conversation" | "email"; note?: string }) => {
      const r = await fetch(`/api/students/${vars.id}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ which: vars.which, method: vars.method, note: vars.note })
      });
      const b = await r.json();
      if (!b.ok) throw new Error(b.error || "Failed");
      return b.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", "onboarding"] });
      qc.invalidateQueries({ queryKey: ["admin", "attention"] });
    }
  });

  const close = () => { setModal(null); setNote(""); };
  const submit = async (method: "conversation" | "email") => {
    if (!modal) return;
    try {
      await checkin.mutateAsync({ id: modal.id, which: modal.which, method, note: note.trim() || undefined });
      toast.push(method === "conversation" ? "Conversation logged." : "Touch-base email queued for drafting.", "success");
      close();
    } catch (e) { toast.push(e instanceof Error ? e.message : "Failed", "error"); }
  };

  return (
    <PanelCard
      tint="staff"
      title="Recently started · last 45 days"
      icon={<Sparkles className="w-4 h-4" />}
      rightSlot={rows.length ? `${rows.length} new` : undefined}
    >
      {q.isPending && <Skeleton rows={3} />}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && rows.length === 0 && (
        <EmptyState icon={<Sparkles className="w-4 h-4" />} message="No new starts in the last 45 days." />
      )}
      {q.data && rows.length > 0 && (
        <div className="py-1">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-tight">{s.name}</p>
                <p className="text-[12px] text-ink-secondary mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {s.grade && <span>Gr {s.grade}</span>}
                  {s.subjects.length > 0 && <span>{s.subjects.join(" + ")}</span>}
                  {days(s) && <span>{days(s)}</span>}
                  {!s.eEnrolled && <span className="badge bg-surface-subtle text-ink-secondary border border-line">No eEnroll</span>}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <CheckButton label="1wk" st={s.week1} onClick={() => setModal({ id: s.id, name: s.name, which: "w1" })} />
                <CheckButton label="4wk" st={s.week4} onClick={() => setModal({ id: s.id, name: s.name, which: "w4" })} />
              </div>
              <span className="shrink-0 text-[12px] text-tint-staff-sub font-medium hidden sm:inline">
                {s.startedDate ? `started ${formatDate(s.startedDate, "short")}` : "started"}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={close}
        title={modal ? `${modal.which === "w1" ? "1-week" : "4-week"} check-in · ${modal.name}` : ""}
        icon={<Sparkles className="w-4 h-4" />}
        tintClassName="bg-tint-staff-bg text-tint-staff-fg"
        size="md"
        footer={
          <>
            <button onClick={close} className="btn">Cancel</button>
            <button onClick={() => submit("conversation")} disabled={checkin.isPending} className="btn">
              <MessageSquare className="w-3.5 h-3.5" /> Log conversation
            </button>
            <button onClick={() => submit("email")} disabled={checkin.isPending} className="btn btn-primary">
              <Mail className="w-3.5 h-3.5" /> Draft email
            </button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary mb-3">
          Reached the family in person or by phone? <span className="font-medium text-ink">Log conversation.</span>{" "}
          Want the system to draft a touch-base email (asks how it's going + shares routine tips)? <span className="font-medium text-ink">Draft email.</span>
        </p>
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes from the conversation, or anything to personalize the email (how they're settling in, a routine tip, what to watch for)…"
        />
        <p className="text-[11px] text-ink-tertiary mt-2">
          Emails draft overnight and land in Adam&apos;s Gmail for review. Either way, this marks the {modal?.which === "w1" ? "1-week" : "4-week"} check-in done.
        </p>
      </Modal>
    </PanelCard>
  );
}
