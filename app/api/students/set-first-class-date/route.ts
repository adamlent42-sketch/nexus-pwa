import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// POST /api/students/set-first-class-date  (staff-facing)
// Reschedules a student's planned first-class date. First Class Date is the
// authoritative field the dashboard, 7-day welcome, and missed-start nudge all
// read, so editing it here is all that's needed to move a planned start.
// Body: { studentId: string, date: "YYYY-MM-DD" }
export async function POST(req: NextRequest) {
  try {
    const { studentId, date } = (await req.json()) as { studentId?: string; date?: string };
    if (!studentId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: "studentId and date (YYYY-MM-DD) required" }, { status: 400 });
    }
    await airtable()(TABLE.Students).update(
      [{ id: studentId, fields: { "First Class Date": date } as Partial<FieldSet> }],
      { typecast: true }
    );
    return NextResponse.json({ ok: true, data: { id: studentId, date } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
