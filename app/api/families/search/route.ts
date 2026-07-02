import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/families/search?q=foo
// Returns up to 25 matching families (by Family Name), plus their linked
// student IDs/names so the Create PO form can offer siblings as a quick pick.
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const filter = q
      ? `AND({Family Name} != '', SEARCH(LOWER('${escape(q)}'), LOWER({Family Name})) > 0)`
      : `{Family Name} != ''`;

    const records = await airtable()(TABLE.Families)
      .select({
        filterByFormula: filter,
        sort: [{ field: "Family Name", direction: "asc" }],
        fields: [
          "Family Name",
          "Mother First Name", "Mother Email", "Mother Phone",
          "Father First Name", "Father Email", "Father Phone",
          "Students"
        ],
        maxRecords: 25
      })
      .all();

    // Resolve student names for each family in one bulk call.
    const allStudentIds = Array.from(
      new Set(records.flatMap((r) => ((r.get("Students") as string[] | undefined) ?? [])))
    );
    const studentNameById = new Map<string, string>();
    if (allStudentIds.length > 0) {
      const formula = `OR(${allStudentIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const sRecs = await airtable()(TABLE.Students)
        .select({ filterByFormula: formula, fields: ["Student Name", "Grade"] })
        .all();
      for (const s of sRecs) {
        const name = (s.get("Student Name") as string | null) ?? "";
        const grade = (s.get("Grade") as string | null) ?? "";
        studentNameById.set(s.id, grade ? `${name} (Gr ${grade})` : name);
      }
    }

    const data = records.map((r) => {
      const studentIds = ((r.get("Students") as string[] | undefined) ?? []) as string[];
      return {
        id: r.id,
        name: (r.get("Family Name") as string | null) ?? "",
        motherFirst: (r.get("Mother First Name") as string | null) ?? null,
        motherEmail: (r.get("Mother Email") as string | null) ?? null,
        motherPhone: (r.get("Mother Phone") as string | null) ?? null,
        fatherFirst: (r.get("Father First Name") as string | null) ?? null,
        fatherEmail: (r.get("Father Email") as string | null) ?? null,
        fatherPhone: (r.get("Father Phone") as string | null) ?? null,
        students: studentIds.map((id) => ({
          id,
          name: studentNameById.get(id) ?? "(unknown)"
        }))
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function escape(s: string): string {
  return s.replace(/'/g, "\\'");
}
