import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

const OUTBOX = "tblHWXG0SDfUNQc7L";

// POST /api/students/nudge-now  (staff-facing)
// Queues the "we missed you for your first class" check-in RIGHT NOW for a
// no-show, instead of waiting for the 3-day auto-task. Groups siblings into one
// email and uses the SAME dedupe key the auto-task uses, so the nightly task
// will skip it — never a duplicate.
// Body: { studentId: string }
export async function POST(req: NextRequest) {
  try {
    const { studentId } = (await req.json()) as { studentId?: string };
    if (!studentId) {
      return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });
    }
    const today = todayInET();

    const clicked = await airtable()(TABLE.Students).find(studentId);
    const familyIds = ((clicked.get("Family") as string[] | undefined) ?? []) as string[];
    const familyId = familyIds[0] ?? null;

    // Build the qualifying set: this family's committed-not-active kids whose
    // first-class date has passed. (No family link → just this student.)
    type Q = { id: string; first: string | null; firstName: string };
    let qualifying: Q[] = [];
    if (familyId) {
      const fam = await airtable()(TABLE.Families).find(familyId);
      const sibIds = ((fam.get("Students") as string[] | undefined) ?? []) as string[];
      if (sibIds.length > 0) {
        const sibs = await airtable()(TABLE.Students)
          .select({
            filterByFormula: `OR(${sibIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
            fields: ["First Name", "Lifecycle Stage", "First Class Date", "First Class Attended Date"]
          })
          .all();
        qualifying = sibs
          .filter((s) => {
            const fc = s.get("First Class Date") as string | null;
            const attended = s.get("First Class Attended Date") as string | null;
            const stage = (s.get("Lifecycle Stage") as string | null) ?? "";
            return fc && fc < today && !attended && (stage === "Pending Start" || stage === "Pending Start State");
          })
          .map((s) => ({ id: s.id, first: (s.get("First Class Date") as string | null) ?? null, firstName: (s.get("First Name") as string | null) ?? "" }));
      }
    }
    if (qualifying.length === 0) {
      qualifying = [{
        id: studentId,
        first: (clicked.get("First Class Date") as string | null) ?? null,
        firstName: (clicked.get("First Name") as string | null) ?? ""
      }];
    }

    const earliest = qualifying.map((q) => q.first).filter(Boolean).sort()[0] ?? today;
    const dedupeKey = `nudge:${familyId ?? studentId}:${earliest}`;

    // Already queued? (by this button or the auto-task) → no-op.
    const existing = await airtable()(OUTBOX)
      .select({ filterByFormula: `{Dedupe Key}='${dedupeKey}'`, fields: ["Dedupe Key"], maxRecords: 1 })
      .firstPage();
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, data: { queued: false, reason: "already queued" } });
    }

    const names = qualifying.map((q) => q.firstName).filter(Boolean).join(" & ") || "student";
    const fields: Partial<FieldSet> = {
      Job: `Missed-Start Check-In — ${names}`,
      "Job Type": "Missed-Start Check-In",
      Status: "Pending",
      Students: qualifying.map((q) => q.id),
      ...(familyId ? { Family: [familyId] } : {}),
      "Trigger Source": "dashboard-nudge-now",
      "Dedupe Key": dedupeKey
    };
    await airtable()(OUTBOX).create([{ fields }], { typecast: true });

    return NextResponse.json({ ok: true, data: { queued: true, students: qualifying.length } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
