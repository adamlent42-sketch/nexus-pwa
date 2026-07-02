import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/students/search?q=foo
// Returns up to 25 matching students (by Student Name LIKE).
// Always filters out rows with an empty Student Name so the picker never
// shows "(unnamed)" stubs.
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const nameFilter = `{Student Name} != ''`;
    const filterByFormula = q
      ? `AND(${nameFilter}, SEARCH(LOWER('${escape(q)}'), LOWER({Student Name})) > 0)`
      : nameFilter;

    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula,
        sort: [{ field: "Student Name", direction: "asc" }],
        fields: ["Student Name", "Grade", "Status"],
        maxRecords: 25
      })
      .all();

    const data = records
      .map((r) => ({
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "",
        grade: (r.get("Grade") as string | null) ?? null,
        status: (r.get("Status") as string | null) ?? null
      }))
      .filter((s) => s.name.trim().length > 0);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function escape(s: string): string {
  return s.replace(/'/g, "\\'");
}
