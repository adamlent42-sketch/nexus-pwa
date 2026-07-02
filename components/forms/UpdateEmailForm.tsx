"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { StudentSelect } from "@/components/ui/StudentSelect";
import { useCreateUpdateEmail } from "@/lib/mutations";
import { useToast } from "@/lib/toast";
import { UpdateEmailCreate } from "@/lib/schemas";
import {
  EMAIL_TYPES_BY_BUCKET,
  BUCKET_FIELD_LABELS,
  lifecycleBucket,
  type LifecycleBucket
} from "@/lib/options";

interface Student { id: string; name: string; grade: string | null; status: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  presetStudent?: Student | null;
}

// Auto-prefill payload from the email-context endpoint.
interface EmailContext {
  studentName: string | null;
  grade: string | null;
  lifecycle: string | null;
  mathLevel: string | null;
  readingLevel: string | null;
  lastPo: {
    id: string;
    date: string | null;
    outcome: string | null;
    staffNotes: string | null;
    recommendedMath: string | null;
    recommendedReading: string | null;
  } | null;
  recentAchievements: {
    id: string;
    title: string | null;
    date: string | null;
    eventType: string | null;
    subject: string | null;
    level: string | null;
  }[];
}

// Build the prefill text for the first guidance field, based on the student's
// lifecycle bucket. For Did-Not-Enroll, we use the PO Recap staff notes. For
// Win-back, we summarize past achievements + current levels.
function buildPrefill(bucket: LifecycleBucket, ctx: EmailContext): string {
  if (bucket === "didNotEnroll" && ctx.lastPo?.staffNotes) {
    const parts: string[] = [];
    parts.push(`PO date: ${ctx.lastPo.date ?? "—"}`);
    if (ctx.lastPo.recommendedMath) parts.push(`Recommended Math: ${ctx.lastPo.recommendedMath}`);
    if (ctx.lastPo.recommendedReading) parts.push(`Recommended Reading: ${ctx.lastPo.recommendedReading}`);
    parts.push("");
    parts.push("Staff notes from PO:");
    parts.push(ctx.lastPo.staffNotes);
    return parts.join("\n");
  }
  if (bucket === "winBack") {
    const parts: string[] = [];
    if (ctx.mathLevel) parts.push(`Last Math level: ${ctx.mathLevel}`);
    if (ctx.readingLevel) parts.push(`Last Reading level: ${ctx.readingLevel}`);
    if (ctx.recentAchievements.length > 0) {
      parts.push("");
      parts.push("Recent achievements:");
      for (const a of ctx.recentAchievements) {
        const bits = [a.date, a.subject, a.level, a.eventType].filter(Boolean).join(" · ");
        parts.push(`  • ${a.title ?? bits}${bits && a.title ? ` (${bits})` : ""}`);
      }
    }
    return parts.join("\n");
  }
  return "";
}

export function UpdateEmailForm({ open, onClose, presetStudent }: Props) {
  const [isQuickNote, setIsQuickNote] = useState(false);
  const [student, setStudent] = useState<Student | null>(presetStudent ?? null);
  const [emailType, setEmailType] = useState<string | null>(null);
  const [quickNoteBody, setQuickNoteBody] = useState("");
  const [notableInClass, setNotableInClass] = useState("");
  const [familyContext, setFamilyContext] = useState("");
  const [concerns, setConcerns] = useState("");
  const [anythingElse, setAnythingElse] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Track which fields the user has touched so we don't clobber edits with
  // a late context fetch.
  const [field1Touched, setField1Touched] = useState(false);

  const mutation = useCreateUpdateEmail();
  const toast = useToast();

  // Lifecycle bucket drives types + labels. presetStudent.status carries the
  // lifecycle when opened from outreach tabs; if a student is picked manually,
  // we don't know the lifecycle yet (default to active).
  const bucket: LifecycleBucket = useMemo(
    () => lifecycleBucket(student?.status ?? presetStudent?.status ?? null),
    [student?.status, presetStudent?.status]
  );
  const labels = BUCKET_FIELD_LABELS[bucket];
  const typeOptions = EMAIL_TYPES_BY_BUCKET[bucket];

  // Pull email context (PO recap, past achievements) for prefill. Only fires
  // when we have a student and need lifecycle-specific prefill data.
  const ctxQuery = useQuery({
    queryKey: ["email-context", student?.id, bucket],
    queryFn: async () => {
      const r = await fetch(`/api/students/${student!.id}/email-context`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      return body.data as EmailContext;
    },
    enabled: !!student && open && (bucket === "didNotEnroll" || bucket === "winBack")
  });

  // When context arrives and field 1 hasn't been touched, prefill it.
  useEffect(() => {
    if (!ctxQuery.data) return;
    if (field1Touched) return;
    const prefill = buildPrefill(bucket, ctxQuery.data);
    if (prefill && !notableInClass) {
      setNotableInClass(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxQuery.data, bucket, field1Touched]);

  // Reset email type when bucket changes — the previous selection may not be
  // valid for the new bucket.
  useEffect(() => {
    if (emailType && !typeOptions.includes(emailType)) {
      setEmailType(null);
    }
  }, [bucket, emailType, typeOptions]);

  useEffect(() => {
    if (open) {
      setStudent(presetStudent ?? null);
    }
  }, [open, presetStudent]);

  useEffect(() => {
    if (!open) {
      setIsQuickNote(false);
      setStudent(null);
      setEmailType(null);
      setQuickNoteBody("");
      setNotableInClass("");
      setFamilyContext("");
      setConcerns("");
      setAnythingElse("");
      setError(null);
      setField1Touched(false);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!student) { setError("Pick a student"); return; }
    if (isQuickNote && !quickNoteBody.trim()) { setError("Quick note text is required"); return; }
    if (!isQuickNote && !emailType) { setError("Pick an email type"); return; }

    const payload = {
      studentId: student.id,
      submittedBy: "—",
      isQuickNote,
      emailType: isQuickNote ? undefined : emailType ?? undefined,
      quickNoteBody: isQuickNote ? quickNoteBody.trim() : undefined,
      notableInClass: isQuickNote ? undefined : notableInClass.trim() || undefined,
      familyContext: isQuickNote ? undefined : familyContext.trim() || undefined,
      concerns: isQuickNote ? undefined : concerns.trim() || undefined,
      anythingElse: isQuickNote ? undefined : anythingElse.trim() || undefined
    };
    const parsed = UpdateEmailCreate.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.push("Update email queued for drafting.", "success");
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to queue", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update email request"
      icon={<Mail className="w-4 h-4" />}
      tintClassName="bg-tint-notes-bg text-tint-notes-fg"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? "Queuing…" : "Queue draft"}
          </button>
        </>
      }
    >
      <div className="bg-tint-alerts-bg text-tint-alerts-fg rounded p-3 mb-4 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 cursor-pointer text-[13px] font-medium">
          <input type="checkbox" checked={isQuickNote} onChange={(e) => setIsQuickNote(e.target.checked)} />
          Quick note only <span className="font-normal">— collapses to a 1–2 sentence wrap</span>
        </label>
      </div>

      <Field label="Student" required>
        <StudentSelect value={student} onChange={setStudent} autoFocus={!presetStudent} />
      </Field>

      {!isQuickNote && student && (
        <div className="text-[12px] text-ink-secondary mb-3 px-3 py-2 rounded bg-surface-subtle border border-line">
          <span className="font-medium">{labels.intro}</span>
          {ctxQuery.isFetching && <span className="ml-2 text-ink-tertiary">· loading context…</span>}
        </div>
      )}

      {isQuickNote ? (
        <Field label="Quick note text" required hint="1–2 sentences, sent as-is with a minimal frame">
          <TextArea
            value={quickNoteBody}
            onChange={(e) => setQuickNoteBody(e.target.value)}
            placeholder="e.g. Layla finished her D-level multiplication set in under 6 minutes today — she's been working really hard on her pacing."
          />
        </Field>
      ) : (
        <>
          <Field label="Email type" required>
            <ChipGroup value={emailType} onChange={setEmailType} options={typeOptions} />
          </Field>
          <Field label={labels.field1.label} hint={labels.field1.hint}>
            <TextArea
              value={notableInClass}
              onChange={(e) => { setNotableInClass(e.target.value); setField1Touched(true); }}
            />
          </Field>
          <Field label={labels.field2.label} hint={labels.field2.hint}>
            <TextArea value={familyContext} onChange={(e) => setFamilyContext(e.target.value)} />
          </Field>
          <Field label={labels.field3.label} hint={labels.field3.hint}>
            <TextArea value={concerns} onChange={(e) => setConcerns(e.target.value)} />
          </Field>
          <Field label={labels.field4.label} hint={labels.field4.hint}>
            <TextArea value={anythingElse} onChange={(e) => setAnythingElse(e.target.value)} />
          </Field>
        </>
      )}

      {error && <p className="text-[12px] text-status-danger-fg mt-1 mb-2">{error}</p>}
      <p className="text-[11px] text-ink-tertiary mt-2">
        Drafts run overnight at 10:41 PM ET. Tomorrow morning the Gmail draft will be in Adam's inbox for review.
      </p>
    </Modal>
  );
}
