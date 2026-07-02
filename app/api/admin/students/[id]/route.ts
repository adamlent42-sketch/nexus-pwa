import { NextRequest, NextResponse } from "next/server";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET  /api/admin/students/[id]  — load a student's editable record + most recent PO.
// PATCH /api/admin/students/[id] — update any of the student's fields (and, optionally,
//   fields on their most-recent PO). Owner-only.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const s = await airtable()(TABLE.Students).find(params.id);

    const poIds = ((s.get("POs") as string[] | undefined) ?? []) as string[];
    let po: Record<string, unknown> | null = null;
    if (poIds.length > 0) {
      const pos = await airtable()(TABLE.POs)
        .select({
          filterByFormula: `OR(${poIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: ["PO Date", "PO Time", "Status", "Outcome", "Planned Start Date"]
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
        id: s.id,
        name: (s.get("Student Name") as string | null) ?? "(student)",
        grade: (s.get("Grade") as string | null) ?? null,
        subjects: ((s.get("Subjects") as string[] | undefined) ?? []) as string[],
        lifecycle: (s.get("Lifecycle Stage") as string | null) ?? null,
        firstClassDate: (s.get("First Class Date") as string | null) ?? null,
        firstClassAttended: (s.get("First Class Attended Date") as string | null) ?? null,
        eEnrollmentCompleted: Boolean(s.get("eEnrollment Completed")),
        schedule: ((s.get("Schedule") as string[] | undefined) ?? []) as string[],
        workPickupDay: (s.get("Work Pickup Day") as string | null) ?? null,
        mathLevel: (s.get("Math Level") as string | null) ?? null,
        readingLevel: (s.get("Reading Level") as string | null) ?? null,
        school: (s.get("School") as string | null) ?? null,
        paperConnect: (s.get("Paper/Kumon Connect") as string | null) ?? null,
        dob: (s.get("DOB") as string | null) ?? null,
        enrollDate: (s.get("Enroll Date") as string | null) ?? null,
        endDate: (s.get("End Date") as string | null) ?? null,
        holdStart: (s.get("Hold Start") as string | null) ?? null,
        plannedReturn: (s.get("Planned Return") as string | null) ?? null,
        breakCheckin: (s.get("Break Check-in Date") as string | null) ?? null,
        holdNotes: (s.get("Hold Notes") as string | null) ?? null,
        invoiceAction: (s.get("Invoice Action") as string | null) ?? null,
        po
      }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

interface PatchBody {
  lifecycle?: string;
  grade?: string;
  subjects?: string[];
  firstClassDate?: string | null;
  firstClassAttended?: string | null;
  eEnrollmentCompleted?: boolean;
  schedule?: string[];
  workPickupDay?: string | null;
  mathLevel?: string | null;
  readingLevel?: string | null;
  school?: string | null;
  paperConnect?: string | null;
  dob?: string | null;
  enrollDate?: string | null;
  endDate?: string | null;
  holdStart?: string | null;
  plannedReturn?: string | null;
  breakCheckin?: string | null;
  holdNotes?: string | null;
  invoiceAction?: string | null;
  breakAction?: "plan" | "return";
  po?: { id: string; status?: string; outcome?: string; plannedStartDate?: string | null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const body = (await req.json()) as PatchBody;

    const sf: Partial<FieldSet> = {};
    if (body.lifecycle !== undefined) sf["Lifecycle Stage"] = body.lifecycle;
    if (body.grade !== undefined) sf["Grade"] = body.grade;
    if (body.subjects !== undefined) sf["Subjects"] = body.subjects;
    if (body.firstClassDate !== undefined) sf["First Class Date"] = body.firstClassDate ?? ("" as unknown as string);
    if (body.firstClassAttended !== undefined) sf["First Class Attended Date"] = body.firstClassAttended ?? ("" as unknown as string);
    if (body.eEnrollmentCompleted !== undefined) sf["eEnrollment Completed"] = body.eEnrollmentCompleted;
    if (body.schedule !== undefined) sf["Schedule"] = body.schedule;
    if (body.workPickupDay !== undefined) sf["Work Pickup Day"] = body.workPickupDay ?? ("" as unknown as string);
    if (body.mathLevel !== undefined) sf["Math Level"] = body.mathLevel ?? ("" as unknown as string);
    if (body.readingLevel !== undefined) sf["Reading Level"] = body.readingLevel ?? ("" as unknown as string);
    if (body.school !== undefined) sf["School"] = body.school ?? ("" as unknown as string);
    if (body.paperConnect !== undefined) sf["Paper/Kumon Connect"] = body.paperConnect ?? ("" as unknown as string);
    if (body.dob !== undefined) sf["DOB"] = body.dob ?? ("" as unknown as string);
    if (body.enrollDate !== undefined) sf["Enroll Date"] = body.enrollDate ?? ("" as unknown as string);
    if (body.endDate !== undefined) sf["End Date"] = body.endDate ?? ("" as unknown as string);
    if (body.holdStart !== undefined) sf["Hold Start"] = body.holdStart ?? ("" as unknown as string);
    if (body.plannedReturn !== undefined) sf["Planned Return"] = body.plannedReturn ?? ("" as unknown as string);
    if (body.breakCheckin !== undefined) sf["Break Check-in Date"] = body.breakCheckin ?? ("" as unknown as string);
    if (body.holdNotes !== undefined) sf["Hold Notes"] = body.holdNotes ?? ("" as unknown as string);
    if (body.invoiceAction !== undefined) sf["Invoice Action"] = body.invoiceAction ?? ("" as unknown as string);

    // Plan-a-break / return side effects.
    if (body.breakAction === "plan") {
      sf["Lifecycle Stage"] = "Planned Break";
      sf["Invoice Action"] = "Cancel recurring";
      sf["Break Reminder Sent"] = false;
      if (body.plannedReturn) sf["Snooze Until"] = body.plannedReturn; // mute overdue nudges while paused
    } else if (body.breakAction === "return") {
      sf["Lifecycle Stage"] = "Active-Engaged";
      sf["Invoice Action"] = "Reactivate";
      sf["Snooze Until"] = "" as unknown as string;
    }

    if (Object.keys(sf).length > 0) {
      await airtable()(TABLE.Students).update([{ id: params.id, fields: sf }], { typecast: true });
    }

    if (body.po && body.po.id) {
      const pf: Partial<FieldSet> = {};
      if (body.po.status !== undefined) pf["Status"] = body.po.status;
      if (body.po.outcome !== undefined) pf["Outcome"] = body.po.outcome;
      if (body.po.plannedStartDate !== undefined) pf["Planned Start Date"] = body.po.plannedStartDate ?? ("" as unknown as string);
      if (Object.keys(pf).length > 0) {
        await airtable()(TABLE.POs).update([{ id: body.po.id, fields: pf }], { typecast: true });
      }
    }

    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
