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
        endDate: s("End Date"),
        lifecycleStage: s("Lifecycle Stage"),
        schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
        workPickupDay: s("Work Pickup Day")
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
  endDate: dateStr,
  lifecycleStage: z.enum(LIFECYCLE_STAGES).nullable().optional()
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
    if (d.endDate !== undefined) fields["End Date"] = d.endDate;
    if (d.lifecycleStage !== undefined) fields["Lifecycle Stage"] = d.lifecycleStage;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    const updated = await airtable()(TABLE.Students).update(
      [{ id: params.id, fields: fields as Partial<FieldSet> }],
      { typecast: true }
    );
    return NextResponse.json({ ok: true, data: { id: updated[0].id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
