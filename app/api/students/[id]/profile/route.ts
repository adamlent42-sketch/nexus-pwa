import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { WEEKDAYS, PICKUP_DAYS, SUBJECTS, GRADES, PAPER_CONNECT, LIFECYCLE_STAGES } from "@/lib/options";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/profile — current values for the edit form to prefill.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await airtable()(TABLE.Students).find(params.id);
    const s = (f: string) => (r.get(f) as string | null) ?? null;

    // Fetch latest PO if any
    const poIds = ((r.get("POs") as string[] | undefined) ?? []) as string[];
    let po: Record<string, unknown> | null = null;
    if (poIds.length > 0) {
      const pos = await airtable()(TABLE.POs)
        .select({
          filterByFormula: `OR(${poIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: ["PO Date", "Status", "Outcome", "Planned Start Date"]
        })
        .all();
      const latest = pos
        .slice()
        .sort((a, b) => ((b.get("PO Date") as string | null) ?? "").localeCompare((a.get("PO Date") as string | null) ?? ""))[0];
      if (latest) {
        po = {
          id: latest.id,
          poDate: (latest.get("PO Date") as string | null) ?? null,
          status: (latest.get("Status") as string | null) ?? null,
          outcome: (latest.get("Outcome") as string | null) ?? null,
          plannedStartDate: (latest.get("Planned Start Date") as string | null) ?? null
        };
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        name: s("Student Name"),
        subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
        mathLevel: s("Math Level"),
        readingLevel: s("Reading Level"),
        grade: s("Grade"),
        school: s("School"),
        paperConnect: s("Paper/Kumon Connect"),
        dob: s("DOB"),
        enrollDate: s("Enroll Date"),
        firstClassDate: s("First Class Date"),
        firstClassAttended: s("First Class Attended Date"),
        endDate: s("End Date"),
        lifecycleStage: s("Lifecycle Stage"),
        eEnrollmentCompleted: Boolean(r.get("eEnrollment Completed")),
        schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
        workPickupDay: s("Work Pickup Day"),
        holdStart: s("Hold Start"),
        plannedReturn: s("Planned Return"),
        breakCheckin: s("Break Check-in Date"),
        holdNotes: s("Hold Notes"),
        invoiceAction: s("Invoice Action"),
        po
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/students/[id]/profile
// Direct, staff-level edits to a student record. Applies immediately, no approval.
// A field omitted from the body is left unchanged; a field sent as null/"" is cleared.
// NOTE: lifecycleStage here is a direct override — it does NOT trigger the KSIS /
// billing follow-ups that the Pause/Stop/Restart change-request flow fires. Use the
// change-request flow for normal enroll/discontinue transitions; use this to fix data.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const Body = z.object({
  schedule: z.array(z.enum(WEEKDAYS)).optional(),
  workPickupDay: z.enum(PICKUP_DAYS).nullable().optional(),
  subjects: z.array(z.enum(SUBJECTS)).optional(),
  mathLevel: z.string().max(40).nullable().optional(),
  readingLevel: z.string().max(40).nullable().optional(),
  grade: z.enum(GRADES).nullable().optional(),
  school: z.string().max(200).nullable().optional(),
  paperConnect: z.enum(PAPER_CONNECT).nullable().optional(),
  dob: dateStr,
  enrollDate: dateStr,
  firstClassDate: dateStr,
  firstClassAttended: dateStr,
  endDate: dateStr,
  lifecycleStage: z.enum(LIFECYCLE_STAGES).nullable().optional(),
  eEnrollmentCompleted: z.boolean().optional(),
  holdStart: dateStr,
  plannedReturn: dateStr,
  breakCheckin: dateStr,
  holdNotes: z.string().max(500).nullable().optional(),
  invoiceAction: z.string().nullable().optional(),
  breakAction: z.enum(["plan", "return"]).optional(),
  po: z.object({
    id: z.string(),
    status: z.string().optional(),
    outcome: z.string().optional(),
    plannedStartDate: dateStr
  }).optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const fields: Record<string, unknown> = {};

    if (d.schedule !== undefined) fields["Schedule"] = d.schedule;
    if (d.workPickupDay !== undefined) fields["Work Pickup Day"] = d.workPickupDay;
    if (d.subjects !== undefined) fields["Subjects"] = d.subjects;
    if (d.mathLevel !== undefined) fields["Math Level"] = d.mathLevel ?? "";
    if (d.readingLevel !== undefined) fields["Reading Level"] = d.readingLevel ?? "";
    if (d.grade !== undefined) fields["Grade"] = d.grade;
    if (d.school !== undefined) fields["School"] = d.school ?? "";
    if (d.paperConnect !== undefined) fields["Paper/Kumon Connect"] = d.paperConnect;
    if (d.dob !== undefined) fields["DOB"] = d.dob;
    if (d.enrollDate !== undefined) fields["Enroll Date"] = d.enrollDate;
    if (d.firstClassDate !== undefined) fields["First Class Date"] = d.firstClassDate;
    if (d.firstClassAttended !== undefined) fields["First Class Attended Date"] = d.firstClassAttended;
    if (d.endDate !== undefined) fields["End Date"] = d.endDate;
    if (d.lifecycleStage !== undefined) fields["Lifecycle Stage"] = d.lifecycleStage;
    if (d.eEnrollmentCompleted !== undefined) fields["eEnrollment Completed"] = d.eEnrollmentCompleted;
    if (d.holdStart !== undefined) fields["Hold Start"] = d.holdStart;
    if (d.plannedReturn !== undefined) fields["Planned Return"] = d.plannedReturn;
    if (d.breakCheckin !== undefined) fields["Break Check-in Date"] = d.breakCheckin;
    if (d.holdNotes !== undefined) fields["Hold Notes"] = d.holdNotes ?? "";
    if (d.invoiceAction !== undefined) fields["Invoice Action"] = d.invoiceAction ?? "";

    // Plan-a-break / return side effects — same logic as admin route.
    if (d.breakAction === "plan") {
      fields["Lifecycle Stage"] = "Planned Break";
      fields["Invoice Action"] = "Cancel recurring";
      fields["Break Reminder Sent"] = false;
      if (d.plannedReturn) fields["Snooze Until"] = d.plannedReturn;
    } else if (d.breakAction === "return") {
      fields["Lifecycle Stage"] = "Active-Engaged";
      fields["Invoice Action"] = "Reactivate";
      fields["Snooze Until"] = "";
    }

    if (Object.keys(fields).length > 0) {
      await airtable()(TABLE.Students).update(
        [{ id: params.id, fields: fields as Partial<FieldSet> }],
        { typecast: true }
      );
    }

    // Update PO fields if provided
    if (d.po?.id) {
      const pf: Partial<FieldSet> = {};
      if (d.po.status !== undefined) pf["Status"] = d.po.status;
      if (d.po.outcome !== undefined) pf["Outcome"] = d.po.outcome;
      if (d.po.plannedStartDate !== undefined) pf["Planned Start Date"] = d.po.plannedStartDate ?? ("" as unknown as string);
      if (Object.keys(pf).length > 0) {
        await airtable()(TABLE.POs).update([{ id: d.po.id, fields: pf }], { typecast: true });
      }
    }

    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
