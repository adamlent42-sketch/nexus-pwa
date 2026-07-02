import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { PORecapSubmit } from "@/lib/schemas";
import { computeLifecycle, shouldAutoFinalize } from "@/lib/po-lifecycle";
import { enqueuePoFollowup } from "@/lib/outbox";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const json = await req.json();
    const parsed = PORecapSubmit.safeParse({ ...json, poId: id });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const d = parsed.data;
    // Auto-finalize (skip the owner review queue) when EITHER the outcome is
    // deterministic (no-show / family-cancelled) OR Adam himself did the recap —
    // his own recaps don't need self-approval; staff recaps still queue for review.
    const submitterIsAdam = /\badam\b/i.test(d.submittedBy ?? "");
    const autoFinalize = shouldAutoFinalize(d.status) || submitterIsAdam;

    const fields: Partial<FieldSet> = {
      Status: d.status,
      "Staff Notes ": d.staffNotes,
      "Recap Status": autoFinalize ? "Reviewed" : "Submitted - Pending Owner Review"
    };
    if (d.outcome) fields["Outcome"] = d.outcome;
    if (d.eEnrollmentCompleted !== undefined) fields["eEnrollment Form Completed"] = d.eEnrollmentCompleted;
    if (d.plannedStartDate) fields["Planned Start Date"] = d.plannedStartDate;
    if (d.plannedClassTime) fields["Planned Class Time"] = d.plannedClassTime;
    if (d.plannedSchedule && d.plannedSchedule.length) fields["Planned Schedule"] = d.plannedSchedule;
    if (d.recommendedMathLevel) fields["Recommended Math Starting Level"] = d.recommendedMathLevel;
    if (d.recommendedReadingLevel) fields["Recommended Reading Starting Level"] = d.recommendedReadingLevel;
    if (d.subjectInterest && d.subjectInterest.length) fields["Subject Interest"] = d.subjectInterest;
    if (d.leadSource) fields["Lead Source"] = d.leadSource;
    if (d.thirtyDayVision) fields["30 Day Vision"] = d.thirtyDayVision;
    if (d.gpsPriorities && d.gpsPriorities.length) fields["GPS Priorities"] = d.gpsPriorities;

    await airtable()(TABLE.POs).update([{ id, fields }], { typecast: true });

    // Sync recap data down to the linked students so the onboarding checklist is
    // populated straight from the recap. First Class Date is what the 7-day welcome
    // targets; subjects / class days / starting levels fill the checklist's
    // "From the PO recap" block (previously these lived only on the PO).
    const studentSync: Partial<FieldSet> = {};
    if (d.plannedStartDate) studentSync["First Class Date"] = d.plannedStartDate;
    if (d.subjectInterest && d.subjectInterest.length) studentSync["Subjects"] = d.subjectInterest;
    if (d.plannedSchedule && d.plannedSchedule.length) studentSync["Schedule"] = d.plannedSchedule;
    if (d.recommendedReadingLevel) studentSync["Reading Level"] = d.recommendedReadingLevel;
    if (d.recommendedMathLevel) studentSync["Math Level"] = d.recommendedMathLevel;
    if (d.thirtyDayVision) studentSync["30 Day Vision"] = d.thirtyDayVision;
    if (d.gpsPriorities && d.gpsPriorities.length) studentSync["GPS Priorities"] = d.gpsPriorities;
    if (Object.keys(studentSync).length > 0) {
      const po = await airtable()(TABLE.POs).find(id);
      const syncStudentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
      if (syncStudentIds.length > 0) {
        const syncUpdates = syncStudentIds.map((sid) => ({ id: sid, fields: studentSync }));
        for (let i = 0; i < syncUpdates.length; i += 10) {
          await airtable()(TABLE.Students).update(syncUpdates.slice(i, i + 10), { typecast: true });
        }
      }
    }

    // If auto-finalizing, also push the student lifecycle
    let lifecyclePushed: string | null = null;
    let studentsPushed = 0;
    if (autoFinalize) {
      const stage = computeLifecycle(d.status, d.outcome ?? null);
      if (stage) {
        const po = await airtable()(TABLE.POs).find(id);
        const studentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
        if (studentIds.length > 0) {
          const updates = studentIds.map((sid) => ({
            id: sid,
            fields: { "Lifecycle Stage": stage } as Partial<FieldSet>
          }));
          for (let i = 0; i < updates.length; i += 10) {
            await airtable()(TABLE.Students).update(updates.slice(i, i + 10), { typecast: true });
          }
          lifecyclePushed = stage;
          studentsPushed = studentIds.length;
        }
      }

      // Enqueue post-PO follow-up email for attended outcomes.
      // Fire-and-forget — a queue failure never blocks the recap save.
      if (d.status === "Attended" && d.outcome) {
        const po = await airtable()(TABLE.POs).find(id);
        const followupStudentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
        await enqueuePoFollowup({
          poId: id,
          studentIds: followupStudentIds,
          studentName: (po.get("Student Display") as string | null) ?? "(student)",
          grade: (po.get("Grade") as string | null) ?? null,
          status: d.status,
          outcome: d.outcome,
          eEnrollmentCompleted: d.eEnrollmentCompleted ?? false,
          plannedStartDate: d.plannedStartDate ?? null,
          plannedSchedule: d.plannedSchedule ?? [],
          plannedClassTime: d.plannedClassTime ?? null,
          subjects: d.subjectInterest ?? [],
          mathLevel: d.recommendedMathLevel ?? null,
          readingLevel: d.recommendedReadingLevel ?? null,
          thirtyDayVision: d.thirtyDayVision ?? null,
          gpsPriorities: d.gpsPriorities ?? [],
          staffNotes: d.staffNotes,
          triggerSource: "po-recap-route",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: { id, autoFinalized: autoFinalize, lifecyclePushed, studentsPushed }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
