import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// POST /api/students/mark-first-class
// Staff marks that a student attended their first class. Flips the student to
// Active-Engaged and stamps First Class Attended Date = today. Accepts one or
// more student record IDs (siblings on the same PO are marked together).
// Body: { studentIds: string[] }
export async function POST(req: NextRequest) {
  try {
    const { studentIds } = (await req.json()) as { studentIds?: string[] };
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ ok: false, error: "studentIds (non-empty array) required" }, { status: 400 });
    }
    const today = todayInET();
    const updates = studentIds.map((id) => ({
      id,
      // Only Lifecycle Stage is writable — Status is a formula, never touch it.
      fields: {
        "Lifecycle Stage": "Active-Engaged",
        "First Class Attended Date": today
      } as Partial<FieldSet>
    }));

    for (let i = 0; i < updates.length; i += 10) {
      await airtable()(TABLE.Students).update(updates.slice(i, i + 10), { typecast: true });
    }

    return NextResponse.json({ ok: true, data: { updated: studentIds.length, date: today } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
