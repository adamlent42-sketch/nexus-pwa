// Outbox helpers — enqueue jobs into the Email Outbox table so the
// kumon-email-worker picks them up and drafts the Gmail message.
//
// The OUTBOX table ID is shared with the admin/outbox route but not exported
// from lib/airtable.ts (it's not a first-class TABLE enum member yet).
// Keep it here until it is promoted.

import { airtable } from "@/lib/airtable";
import { suggestBranch } from "@/lib/email-branches";
import type { FieldSet } from "airtable";

const OUTBOX_TABLE = "tblHWXG0SDfUNQc7L";

// ---------------------------------------------------------------------------
// Generic enqueue
// ---------------------------------------------------------------------------

interface EnqueueParams {
  jobType: string;
  job: string;            // short human-readable description shown in health view
  triggerSource: string;  // which route/task enqueued this
  dedupeKey: string;      // prevents the same email from being queued twice
  contextNotes?: string;  // rich JSON context for the worker drafter
  studentIds?: string[];  // linked Students record IDs
  poId?: string;          // linked PO record ID
}

/**
 * Enqueues a job into the Email Outbox.
 * Returns the new record ID, or null if a live duplicate was found (already
 * Pending / Drafting / Drafted — re-enqueue is silently skipped).
 */
export async function enqueueOutboxJob(params: EnqueueParams): Promise<string | null> {
  // Dedupe check — don't double-queue the same email
  const existing = await airtable()(OUTBOX_TABLE)
    .select({
      filterByFormula: `AND(
        {Dedupe Key} = '${params.dedupeKey.replace(/'/g, "\\'")}',
        OR({Status} = 'Pending', {Status} = 'Drafting', {Status} = 'Drafted')
      )`,
      fields: ["Dedupe Key"],
      maxRecords: 1
    })
    .firstPage();
  if (existing.length > 0) return null; // already live, skip

  const fields: Partial<FieldSet> = {
    Job: params.job,
    "Job Type": params.jobType,
    Status: "Pending",
    "Trigger Source": params.triggerSource,
    "Dedupe Key": params.dedupeKey,
  };
  if (params.contextNotes) fields["Context Notes"] = params.contextNotes;
  if (params.studentIds?.length) fields["Students"] = params.studentIds;
  if (params.poId) fields["PO"] = [params.poId];

  const created = await airtable()(OUTBOX_TABLE).create(
    [{ fields }] as { fields: Partial<FieldSet> }[],
    { typecast: true }
  );
  return created[0]?.id ?? null;
  // NOTE: Errors are intentionally NOT caught here — let callers decide whether
  // to propagate (POST) or fire-and-forget (PATCH approve).
}

// ---------------------------------------------------------------------------
// Post-PO follow-up
// ---------------------------------------------------------------------------

export interface PoFollowupInput {
  poId: string;
  studentIds: string[];
  studentName: string;
  grade: string | null;
  status: string;
  outcome: string | null;
  eEnrollmentCompleted: boolean;
  plannedStartDate: string | null;
  plannedSchedule: string[];
  plannedClassTime: string | null;
  subjects: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  thirtyDayVision: string | null;
  gpsPriorities: string[];
  staffNotes: string | null;
  triggerSource: string; // e.g. "po-recap-route" | "admin-po-recap-approve"
}

/**
 * Enqueues a "Post-PO Follow-up" Outbox job after a PO recap is finalized.
 *
 * Eligibility:
 *   - Status must be "Attended"
 *   - Outcome must be "Plan to Enroll", "Enrolled", or "Undecided"
 *   - "Not Interested" → no email
 *
 * The branch (from suggestBranch) drives what the worker writes:
 *   warm-welcome            → all details confirmed; celebratory welcome
 *   welcome-schedule-tbd   → start date set, days TBD; confirm next step
 *   welcome-need-enrollment → plan to enroll but nothing locked yet;
 *                             summarise levels + GPS + call to action
 *   low-pressure-undecided → full recap summary, no pressure, open door
 *
 * Missing-steps list is passed explicitly so the worker can tailor the CTA
 * without having to re-derive it from individual fields.
 */
export async function enqueuePoFollowup(params: PoFollowupInput): Promise<string | null> {
  if (params.status !== "Attended") return null;
  if (!params.outcome) return null;
  if (params.outcome === "Not Interested") return null;

  const branch = suggestBranch({
    status: params.status,
    outcome: params.outcome,
    plannedStartDate: params.plannedStartDate,
    plannedSchedule: params.plannedSchedule,
    eEnrollmentCompleted: params.eEnrollmentCompleted,
  });

  // What the family still needs to do — drives the CTA in the email
  const missingSteps: string[] = [];
  if (!params.eEnrollmentCompleted) missingSteps.push("complete the eEnrollment form");
  if (params.plannedSchedule.length === 0) missingSteps.push("choose scheduled class days");
  if (!params.plannedStartDate) missingSteps.push("set a start date");

  // Rich context object — the worker reads this verbatim to draft the email.
  // Include every data point from the recap so the worker can write a detailed,
  // personalised message without a second Airtable lookup.
  const context = {
    branch: branch.branch,
    branchLabel: branch.label,
    branchReasoning: branch.reasoning,
    studentName: params.studentName,
    grade: params.grade,
    outcome: params.outcome,
    eEnrollmentCompleted: params.eEnrollmentCompleted,
    plannedStartDate: params.plannedStartDate,
    plannedSchedule: params.plannedSchedule,
    plannedClassTime: params.plannedClassTime,
    subjects: params.subjects,
    mathLevel: params.mathLevel,
    readingLevel: params.readingLevel,
    thirtyDayVision: params.thirtyDayVision,
    gpsPriorities: params.gpsPriorities,
    staffNotes: params.staffNotes,
    missingSteps,
    // Worker instructions (embedded here so they travel with the job row):
    _workerHint: buildWorkerHint(branch.branch, missingSteps, params),
  };

  return enqueueOutboxJob({
    jobType: "Post-PO Follow-up",
    job: `Post-PO follow-up — ${params.studentName} (${branch.label})`,
    triggerSource: params.triggerSource,
    dedupeKey: `po-followup:${params.poId}`,
    contextNotes: JSON.stringify(context, null, 2),
    studentIds: params.studentIds,
    poId: params.poId,
  });
}

// ---------------------------------------------------------------------------
// Worker hint — embedded prompt guidance so the email drafter knows exactly
// what to write for each branch without referencing external docs.
// ---------------------------------------------------------------------------

function buildWorkerHint(
  branch: string,
  missingSteps: string[],
  p: PoFollowupInput
): string {
  const levelLine = [
    p.mathLevel ? `Math starting at ${p.mathLevel}` : null,
    p.readingLevel ? `Reading starting at ${p.readingLevel}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const scheduleLine =
    p.plannedSchedule.length > 0
      ? `${p.plannedSchedule.join(" & ")}${p.plannedClassTime ? ` at ${p.plannedClassTime}` : ""}`
      : null;

  switch (branch) {
    case "warm-welcome":
      return [
        `This family is fully enrolled. Write a warm, celebratory welcome email.`,
        `Confirm their start date (${p.plannedStartDate}), class days (${scheduleLine}), and levels (${levelLine || "TBD"}).`,
        p.thirtyDayVision ? `Weave in the 30-day vision: "${p.thirtyDayVision}".` : "",
        p.gpsPriorities.length
          ? `Mention you'll be focusing on: ${p.gpsPriorities.join(", ")}.`
          : "",
        `Keep it personal, excited, and brief. End with what to expect on the first day.`,
      ]
        .filter(Boolean)
        .join(" ");

    case "welcome-schedule-tbd":
      return [
        `This family has a start date (${p.plannedStartDate}) but hasn't picked their class days yet.`,
        `Write a warm welcome that confirms the start date and levels (${levelLine || "TBD"}).`,
        `Prompt them to choose their days from the available slots.`,
        missingSteps.includes("complete the eEnrollment form")
          ? `Also remind them to complete the eEnrollment form if they haven't yet.`
          : "",
        `Tone: excited and welcoming, but with a clear next step.`,
      ]
        .filter(Boolean)
        .join(" ");

    case "welcome-need-enrollment":
      return [
        `This family said they plan to enroll but hasn't locked in the details yet.`,
        `Write an email that: (1) recaps the plan from the orientation — levels (${levelLine || "TBD"}), subjects (${p.subjects.join(" + ") || "TBD"}), any 30-day vision notes — so they feel the momentum.`,
        `(2) Clearly lists the next steps they need to complete: ${missingSteps.join("; ")}.`,
        p.staffNotes ? `Staff notes to draw from (internal, do NOT quote directly): "${p.staffNotes}"` : "",
        `Tone: enthusiastic, personal, and action-oriented. Strike while the iron is hot.`,
      ]
        .filter(Boolean)
        .join(" ");

    case "low-pressure-undecided":
      return [
        `This family attended but is still deciding. Write a low-pressure follow-up.`,
        `Summarise what was discussed at the orientation — subjects (${p.subjects.join(" + ") || "TBD"}), recommended levels (${levelLine || "TBD"}).`,
        p.thirtyDayVision ? `Reference the plan: "${p.thirtyDayVision}".` : "",
        `Affirm you're ready when they are. Don't push — leave the door open warmly.`,
        `End with a simple CTA: "Just reply or call when you're ready, and we'll get you set up."`,
      ]
        .filter(Boolean)
        .join(" ");

    default:
      return `Write a personalised post-orientation follow-up based on the context above.`;
  }
}
