"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PenLine, Send, X } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/lib/toast";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { AchievementTestForm } from "@/components/forms/AchievementTestForm";
import { UpdateEmailForm } from "@/components/forms/UpdateEmailForm";
import { formatDate } from "@/lib/utils";

interface Picked { id: string; name: string; grade: string | null; status: string | null }
type Mode = "queue" | "launch";
type Special = "parentReply" | "closure" | null;
interface TypeDef {
  key: string; label: string; mode: Mode; launch?: "at" | "update"; special?: Special;
  needsStudent?: boolean; needsNotes?: boolean; notesLabel?: string; notesPlaceholder?: string; blurb: string;
}

const TYPES: TypeDef[] = [
  { key: "Update Email", label: "Update email (to a parent)", mode: "launch", launch: "update",
    blurb: "Opens your full Update Email form — every field you already use." },
  { key: "Achievement Test", label: "Achievement Test email", mode: "launch", launch: "at",
    blurb: "Opens your full Achievement Test form (level, score, time, notes)." },
  { key: "Confirm Class Days", label: "Confirm class days", mode: "queue", needsStudent: true,
    notesLabel: "Anything to add (optional)", blurb: "Gentle 'does this schedule still work for you?' note." },
  { key: "First Class Follow-up", label: "First-class follow-up", mode: "queue", needsStudent: true,
    notesLabel: "Anything to add (optional)", notesPlaceholder: "e.g. Did great, jumped right in", blurb: "Warm note after the child's first class." },
  { key: "First Weeks Check-in", label: "First-weeks check-in (retention)", mode: "queue", needsStudent: true,
    notesLabel: "Anything to add (optional)", blurb: "Engagement / retention note a week or two in." },
  { key: "Parent Reply", label: "Reply to a parent", mode: "queue", needsStudent: true, special: "parentReply",
    blurb: "Drafts a reply in your voice to a parent's email." },
  { key: "Staff Broadcast", label: "Staff broadcast", mode: "queue", needsNotes: true,
    notesLabel: "What's the update to all staff?", notesPlaceholder: "e.g. Reminder: new sign-in procedure starts Monday", blurb: "One email to all staff." },
  { key: "Closure Notice", label: "Closure notice to families", mode: "queue", special: "closure",
    blurb: "Notice to families about a closed day (or days)." }
];

const SCOPES = ["All Active", "Active + Pending Start", "Scheduled That Day"];

const STATUS_TONE: Record<string, string> = {
  Pending: "bg-status-warn-bg text-status-warn-fg",
  Drafting: "bg-status-info-bg text-status-info-fg",
  Drafted: "bg-status-success-bg text-status-success-fg",
  Failed: "bg-status-danger-bg text-status-danger-fg",
  Skipped: "bg-surface-subtle text-ink-tertiary"
};
interface ReqRow { id: string; title: string; type: string; status: string; draftedAt: string | null; error: string | null }

export default function ComposePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [typeKey, setTypeKey] = useState(TYPES[0].key);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [notes, setNotes] = useState("");
  // Parent reply
  const [parentEmail, setParentEmail] = useState("");
  const [replyNotes, setReplyNotes] = useState("");
  // Closure
  const [scope, setScope] = useState<string>("All Active");
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");
  // Launch modals
  const [atOpen, setAtOpen] = useState(false);
  const [updOpen, setUpdOpen] = useState(false);

  const def = TYPES.find((t) => t.key === typeKey)!;

  const reset = () => { setPicked(null); setNotes(""); setParentEmail(""); setReplyNotes(""); setScope("All Active"); setDates([]); setDateInput(""); };

  const recent = useQuery({ queryKey: ["admin", "compose"], queryFn: () => adminFetch<ReqRow[]>("/api/admin/compose") });

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { type: typeKey };
      if (def.needsStudent) { body.studentId = picked?.id; body.studentName = picked?.name; }
      if (def.special === "parentReply") {
        body.notes = `--- Parent wrote ---\n${parentEmail.trim()}\n\n--- What I want to say back ---\n${replyNotes.trim()}`;
      } else if (def.special === "closure") {
        body.recipientScope = scope;
        body.closureDates = dates.join(",");
        body.notes = notes;
      } else {
        body.notes = notes;
      }
      return adminFetch<{ id: string }>("/api/admin/compose", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.push("Queued — your draft will be in Gmail within ~15 minutes.", "success");
      reset();
      qc.invalidateQueries({ queryKey: ["admin", "compose"] });
    },
    onError: (e) => toast.push(e instanceof Error ? e.message : "Failed to queue", "error")
  });

  const addDate = () => { if (dateInput && !dates.includes(dateInput)) { setDates([...dates, dateInput].sort()); setDateInput(""); } };

  const canSubmit =
    def.mode === "queue" &&
    (!def.needsStudent || !!picked) &&
    (def.special !== "parentReply" || (parentEmail.trim() && replyNotes.trim())) &&
    (def.special !== "closure" || dates.length > 0) &&
    (!def.needsNotes || notes.trim().length > 0);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="w-5 h-5 text-brand" />
        <p className="text-[16px] font-medium">Compose an email</p>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">
        Pick a type, fill in the details, and the engine drafts it into your Gmail drafts for you to review and send.
      </p>

      <div className="card card-body space-y-4">
        <Field label="Email type">
          <select value={typeKey} onChange={(e) => { setTypeKey(e.target.value); reset(); }}
            className="w-full border border-line rounded-md px-3 py-2 text-[14px] bg-surface">
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <p className="text-[12px] text-ink-tertiary mt-1">{def.blurb}</p>
        </Field>

        {/* Launch types — open the existing rich forms */}
        {def.mode === "launch" && (
          <div>
            <button onClick={() => (def.launch === "at" ? setAtOpen(true) : setUpdOpen(true))} className="btn btn-primary">
              <PenLine className="w-3.5 h-3.5" /> Open the {def.launch === "at" ? "Achievement Test" : "Update Email"} form
            </button>
            <p className="text-[11px] text-ink-tertiary mt-2">These use your existing form and drafting flow (drafts overnight).</p>
          </div>
        )}

        {/* Queue types */}
        {def.mode === "queue" && (
          <>
            {def.needsStudent && (
              <Field label="Student"><StudentSelect value={picked} onChange={setPicked} /></Field>
            )}

            {def.special === "parentReply" && (
              <>
                <Field label="Paste the parent's email" hint="required">
                  <TextArea value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} rows={5} placeholder="Paste exactly what the parent wrote…" />
                </Field>
                <Field label="What you want to say back" hint="required">
                  <TextArea value={replyNotes} onChange={(e) => setReplyNotes(e.target.value)} rows={3} placeholder="Your notes — the engine writes it up in your voice." />
                </Field>
              </>
            )}

            {def.special === "closure" && (
              <>
                <Field label="Who gets it">
                  <ChipGroup value={scope} onChange={(v) => setScope(v || "All Active")} options={SCOPES} />
                  <p className="text-[11px] text-ink-tertiary mt-1">
                    {scope === "Scheduled That Day" ? "Only families with a class on the closed day(s)." : scope === "Active + Pending Start" ? "All active families plus committed pending-start families." : "All active families."}
                  </p>
                </Field>
                <Field label="Closed day(s)" hint="add each closed day — a single day, several days, or a whole week">
                  <div className="flex items-center gap-2">
                    <TextInput type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-[170px]" />
                    <button onClick={addDate} disabled={!dateInput} className="btn">Add day</button>
                  </div>
                  {dates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dates.map((d) => (
                        <span key={d} className="badge bg-surface-subtle text-ink-secondary inline-flex items-center gap-1">
                          {formatDate(d, "short")}
                          <button onClick={() => setDates(dates.filter((x) => x !== d))} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              </>
            )}

            {def.special !== "parentReply" && (
              <Field label={def.notesLabel ?? "Notes"} hint={def.needsNotes ? "required" : "optional"}>
                <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={def.notesPlaceholder} rows={3} />
              </Field>
            )}

            <div className="flex justify-end">
              <button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending} className="btn btn-primary">
                <Send className="w-3.5 h-3.5" /> {submit.isPending ? "Queuing…" : "Queue draft"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Recent requests */}
      <div className="mt-6">
        <p className="text-[13px] font-medium mb-2">Recent</p>
        {recent.isPending ? (
          <p className="text-[12px] text-ink-tertiary">Loading…</p>
        ) : recent.data && recent.data.length > 0 ? (
          <div className="space-y-1.5">
            {recent.data.map((r) => (
              <div key={r.id} className="card card-body flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">{r.title}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    {r.status === "Drafted" && r.draftedAt ? `drafted ${formatDate(r.draftedAt, "short")} — check Gmail` : r.error ? r.error : "waiting for the drafter"}
                  </p>
                </div>
                <span className={`badge shrink-0 ${STATUS_TONE[r.status] ?? "bg-surface-subtle text-ink-tertiary"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ink-tertiary">No requests yet.</p>
        )}
      </div>

      <AchievementTestForm open={atOpen} onClose={() => setAtOpen(false)} />
      <UpdateEmailForm open={updOpen} onClose={() => setUpdOpen(false)} />
    </div>
  );
}
