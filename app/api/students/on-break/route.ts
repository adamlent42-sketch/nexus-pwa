import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/students/on-break
// Staff-facing — no admin auth required.
// Returns all students in "Planned Break", sorted soonest return date first.
export async function GET() {
  try {
    const recs = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `{Lifecycle Stage} = 'Planned Break'`,
        fields: ["Student Name", "Subjects", "Schedule", "Planned Return", "Hold Start", "Hold Notes"]
      })
      .all();

    const data = recs
      .map((r) => ({
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(student)",
        subjects: (r.get("Subjects") as string[] | null) ?? [],
        schedule: (r.get("Schedule") as string[] | null) ?? [],
        plannedReturn: (r.get("Planned Return") as string | null) ?? null,
        holdStart: (r.get("Hold Start") as string | null) ?? null,
        notes: (r.get("Hold Notes") as string | null) ?? null,
      }))
      .sort((a, b) => (a.plannedReturn ?? "9999").localeCompare(b.plannedReturn ?? "9999"));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
