import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID_DAYS = ["Monday", "Tuesday", "Thursday", "Saturday", "Other"];

// GET /api/admin/scheduled-day?day=Thursday
// Lists active students whose weekly Schedule includes the chosen day,
// so the owner can see who is expected to come in on a given class day.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const day = req.nextUrl.searchParams.get("day") ?? "";
    if (!VALID_DAYS.includes(day)) {
      return NextResponse.json(
        { ok: false, error: `Invalid day "${day}". Expected one of: ${VALID_DAYS.join(", ")}.` },
        { status: 400 }
      );
    }

    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `AND(
          OR({Lifecycle Stage}='Active-Engaged', {Lifecycle Stage}='Active-At-Risk'),
          FIND('${day}', ARRAYJOIN({Schedule}, ','))
        )`,
        sort: [{ field: "Student Name", direction: "asc" }],
        fields: [
          "Student Name", "Grade", "Subjects", "Schedule",
          "Lifecycle Stage", "Math Level", "Reading Level"
        ]
      })
      .all();

    const data = records.map((r) => ({
      id: r.id,
      student: (r.get("Student Name") as string | null) ?? "(unnamed)",
      grade: (r.get("Grade") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
      schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
      lifecycle: (r.get("Lifecycle Stage") as string | null) ?? null,
      mathLevel: (r.get("Math Level") as string | null) ?? null,
      readingLevel: (r.get("Reading Level") as string | null) ?? null
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
