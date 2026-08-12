import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/checkin/students
// Returns all active students for the kiosk manual check-in picker.
// No admin auth required — kiosk is a staff-facing device.
export async function GET() {
  try {
    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `OR({Lifecycle Stage}='Active-Engaged', {Lifecycle Stage}='Active-At-Risk')`,
        sort: [{ field: "Student Name", direction: "asc" }],
        fields: ["Student Name", "First Name", "Subjects", "Grade"]
      })
      .all();

    const data = records.map((r) => ({
      id: r.id,
      name: (r.get("Student Name") as string | null) ?? "(unnamed)",
      firstName: (r.get("First Name") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
      grade: (r.get("Grade") as string | null) ?? null
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
