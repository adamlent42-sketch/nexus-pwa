import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import type { FieldSet } from "airtable";
import { computeLifecycle } from "@/lib/po-lifecycle";
import { enqueuePoFollowup, enqueueOutboxJob } from "@/lib/outbox";

export const dynamic = "force-dynamic";

interface Body {
  outcome?: string | null;
  eEnrollmentCompleted?: boolean;
  plannedStartDate?: string | null;
  plannedClassTime?: string | null;
  plannedSchedule?: string[];
  mathLevel?: string | null;
  readingLevel?: string | null;
  subjects?: string[];
  leadSource?: string | null;
  staffNotes?: string | null;
  thirtyDayVision?: string | null;
  gpsPriorities?: string[];
  approve?: boolean;
  // Post-PO enrollment onboarding checkboxes (Enrollment Onboarding page).
  invoiceSent?: boolean;
  recurringInvoiceSetUp?: boolean;
  plasticFolderMade?: boolean;
  booksPulled?: boolean;
  firstInvoicePaid?: boolean;
  enrolledInKsis?: boolean;
  lifecycleOverride?: string | null;
}

// Lifecycle computation is shared with the staff recap route — see lib/po-lifecycle.ts.

// Updates the Lifecycle Stage on every student linked to a PO. Batches by 10
// (Airtable's per-request limit). Returns how many students were updated.
async function pushStudentLifecycle(poId: string, stage: string): Promise<number> {
  const po = await airtable()(TABLE.POs).find(poId);
  const studentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
  if (studentIds.length === 0) return 0;
  const updates = studentIds.map((sid) => ({
    id: sid,
    fields: { "Lifecycle Stage": stage } as Partial<FieldSet>
  }));
  for (let i = 0; i < updates.length; i += 10) {
    await airtable()(TABLE.Students).update(updates.slice(i, i + 10), { typecast: true });
  }
  return studentIds.length;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const { id } = params;
    const body = (await req.json()) as Body;

    const fields: Partial<FieldSet> = {};
    if (body.outcome !== undefined) fields["Outcome"] = body.outcome ?? "";
    if (body.eEnrollmentCompleted !== undefined) fields["eEnrollment Form Completed"] = body.eEnrollmentCompleted;
    if (body.plannedStartDate !== undefined) fields["Planned Start Date"] = body.plannedStartDate ?? "";
    if (body.plannedClassTime !== undefined) fields["Planned Class Time"] = body.plannedClassTime ?? "";
    if (body.plannedSchedule !== undefined) fields["Planned Schedule"] = body.plannedSchedule;
    if (body.mathLevel !== undefined) fields["Recommended Math Starting Level"] = body.mathLevel ?? "";
    if (body.readingLevel !== undefined) fields["Recommended Reading Starting Level"] = body.readingLevel ?? "";
    if (body.subjects !== undefined) fields["Subject Interest"] = body.subjects;
    if (body.leadSource !== undefined) fields["Lead Source"] = body.leadSource ?? "";
    if (body.staffNotes !== undefined) fields["Staff Notes "] = body.staffNotes ?? "";
    if (body.thirtyDayVision !== undefined) fields["30 Day Vision"] = body.thirtyDayVision ?? "";
    if (body.gpsPriorities !== undefined) fields["GPS Priorities"] = body.gpsPriorities;
    if (body.invoiceSent !== undefined) fields["Invoice Sent"] = body.invoiceSent;
    if (body.recurringInvoiceSetUp !== undefined) fields["Recurring Invoice Set Up"] = body.recurringInvoiceSetUp;
    if (body.plasticFolderMade !== undefined) fields["Plastic Folder Made"] = body.plasticFolderMade;
    if (body.booksPulled !== undefined) fields["Books Pulled"] = body.booksPulled;
    if (body.firstInvoicePaid !== undefined) fields["First Invoice Paid"] = body.firstInvoicePaid;
    if (body.enrolledInKsis !== undefined) fields["Enrolled in KSIS"] = body.enrolledInKsis;
    if (body.approve) fields["Recap Status"] = "Reviewed";

    await airtable()(TABLE.POs).update([{ id, fields }], { typecast: true });

    // Ticking "Enrolled in KSIS" is the true end of onboarding — the student is
    // now a running student, so advance their lifecycle to Active-Engaged. This
    // also clears them out of every "still enrolling" view going forward.
    let lifecycleActivated = 0;
    if (body.enrolledInKsis === true) {
      lifecycleActivated = await pushStudentLifecycle(id, "Active-Engaged");
    }

    // On approve: push lifecycle to each linked student based on Status + Outcome.
    let lifecyclePushed: string | null = null;
    let studentsPushed = 0;
    if (body.approve) {
      const po = await airtable()(TABLE.POs).find(id);
      const status = (po.get("Status") as string | null) ?? null;
      // Use the outcome from the body if just saved, otherwise fall back to what's
      // stored. This prevents a race where the Airtable read returns a stale value.
      const outcome = body.outcome !== undefined ? (body.outcome ?? null) : ((po.get("Outcome") as string | null) ?? null);
      const plannedStartDate = body.plannedStartDate !== undefined
        ? (body.plannedStartDate ?? null)
        : ((po.get("Planned Start Date") as string | null) ?? null);
      const stage = body.lifecycleOverride ?? computeLifecycle(status, outcome, plannedStartDate);
      if (stage) {
        studentsPushed = await pushStudentLifecycle(id, stage);
        if (studentsPushed > 0) lifecyclePushed = stage;
      }

      // Enqueue post-PO follow-up email — true fire-and-forget.
      // Wrapped in its own try/catch so a queue failure never blocks the approve response.
      const approveStudentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
      enqueuePoFollowup({
        poId: id,
        studentIds: approveStudentIds,
        studentName: (po.get("Student Display") as string | null) ?? "(student)",
        grade: (po.get("Grade") as string | null) ?? null,
        status: status ?? "",
        outcome,
        eEnrollmentCompleted: body.eEnrollmentCompleted ?? Boolean(po.get("eEnrollment Form Completed")),
        plannedStartDate: body.plannedStartDate !== undefined ? (body.plannedStartDate ?? null) : ((po.get("Planned Start Date") as string | null) ?? null),
        plannedSchedule: body.plannedSchedule ?? ((po.get("Planned Schedule") as string[] | undefined) ?? []),
        plannedClassTime: body.plannedClassTime !== undefined ? (body.plannedClassTime ?? null) : ((po.get("Planned Class Time") as string | null) ?? null),
        subjects: body.subjects ?? ((po.get("Subject Interest") as string[] | undefined) ?? []),
        mathLevel: body.mathLevel !== undefined ? (body.mathLevel ?? null) : ((po.get("Recommended Math Starting Level") as string | null) ?? null),
        readingLevel: body.readingLevel !== undefined ? (body.readingLevel ?? null) : ((po.get("Recommended Reading Starting Level") as string | null) ?? null),
        thirtyDayVision: body.thirtyDayVision !== undefined ? (body.thirtyDayVision ?? null) : ((po.get("30 Day Vision") as string | null) ?? null),
        gpsPriorities: body.gpsPriorities ?? ((po.get("GPS Priorities") as string[] | undefined) ?? []),
        staffNotes: body.staffNotes !== undefined ? (body.staffNotes ?? null) : ((po.get("Staff Notes ") as string | null) ?? null),
        triggerSource: "admin-po-recap-approve",
      }).catch((emailErr) => {
        console.error("[po-recap approve] email enqueue failed (approve already saved):", emailErr);
      });
    }

    return NextResponse.json({
      ok: true,
      data: { id, approved: !!body.approve, lifecyclePushed, studentsPushed, lifecycleActivated }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const { id } = params;

    const po = await airtable()(TABLE.POs).find(id);
    const studentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
    const status = (po.get("Status") as string | null) ?? "";
    const outcome = (po.get("Outcome") as string | null) ?? null;

    const NO_SHOW_STATUSES = new Set(["No-Show", "Family Cancelled", "Instructor Cancelled"]);

    let queuedId: string | null = null;

    if (status === "Attended") {
      // Full attended follow-up path — branch-aware email
      queuedId = await enqueuePoFollowup({
        poId: id,
        studentIds,
        studentName: (po.get("Student Display") as string | null) ?? "(student)",
        grade: (po.get("Grade") as string | null) ?? null,
        status,
        outcome,
        eEnrollmentCompleted: Boolean(po.get("eEnrollment Form Completed")),
        plannedStartDate: (po.get("Planned Start Date") as string | null) ?? null,
        plannedSchedule: ((po.get("Planned Schedule") as string[] | undefined) ?? []),
        plannedClassTime: (po.get("Planned Class Time") as string | null) ?? null,
        subjects: ((po.get("Subject Interest") as string[] | undefined) ?? []),
        mathLevel: (po.get("Recommended Math Starting Level") as string | null) ?? null,
        readingLevel: (po.get("Recommended Reading Starting Level") as string | null) ?? null,
        thirtyDayVision: (po.get("30 Day Vision") as string | null) ?? null,
        gpsPriorities: ((po.get("GPS Priorities") as string[] | undefined) ?? []),
        staffNotes: (po.get("Staff Notes ") as string | null) ?? null,
        triggerSource: "admin-po-recap-manual-followup",
      });
    } else if (NO_SHOW_STATUSES.has(status)) {
      // No-show / cancelled — queue a reschedule outreach via the standard outbox.
      // IMPORTANT: use the SAME job type + dedupe key as the automatic detectors
      // (kumon-po-no-show-detector → `noshow:<po>`, family-cancelled → `cancelled:<po>`)
      // so this manual "send now" button collapses with whatever the detector
      // already queued instead of producing a second, duplicate reschedule email.
      const isCancelled = status === "Family Cancelled";
      const jobType = isCancelled ? "Family-Cancelled Winback" : "No-Show Reschedule";
      const dedupeKey = isCancelled ? `cancelled:${id}` : `noshow:${id}`;
      const studentName = (po.get("Student Display") as string | null) ?? "(student)";
      queuedId = await enqueueOutboxJob({
        jobType,
        job: `${jobType} — ${studentName} (manual)`,
        triggerSource: "admin-po-recap-manual-followup",
        dedupeKey,
        contextNotes: JSON.stringify({
          studentName,
          grade: (po.get("Grade") as string | null) ?? null,
          status,
          subjects: ((po.get("Subject Interest") as string[] | undefined) ?? []),
          staffNotes: (po.get("Staff Notes ") as string | null) ?? null,
          _workerHint: `The family ${isCancelled ? "cancelled" : "did not show up for"} their PO. Write a warm, non-pushy note offering to reschedule.`,
        }, null, 2),
        studentIds,
        poId: id,
      });
    }

    const message = queuedId
      ? "Email queued — check Gmail drafts shortly."
      : "Already queued or not eligible (a pending draft may already exist).";

    return NextResponse.json({ ok: true, data: { queued: queuedId !== null, message } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    // Airtable errors are objects with .message, .statusCode, .error — not always instanceof Error
    const msg = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
