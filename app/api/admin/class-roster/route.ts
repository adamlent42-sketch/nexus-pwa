import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass } from "@/lib/admin-auth";
import type { DayOfWeek } from "@/types/kumon";

export const dynamic = "force-dynamic";

export interface ClassRosterStudent {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  mathLevel: string | null;
  readingLevel: string | null;
}

const VALID_DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const day = req.nextUrl.searchParams.get("day") ?? "";
    if (!VALID_DAYS.includes(day as DayOfWeek)) {
      return NextResponse.json({ ok: false, error: "Invalid day" }, { status: 400 });
    }

    const formula = `AND(
      OR({Lifecycle Stage}='Active-Engaged', {Lifecycle Stage}='Active-At-Risk'),
      FIND('${day}', ARRAYJOIN({Schedule}, ',')) > 0
    )`;

    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula: formula,
        fields: ["Student Name", "Grade", "Subjects", "Math Level", "Reading Level"],
        sort: [{ field: "Student Name", direction: "asc" }],
      })
      .all();

    const data: ClassRosterStudent[] = records.map((r) => ({
      id: r.id,
      name: (r.get("Student Name") as string | null) ?? "(unnamed)",
      grade: (r.get("Grade") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | null) ?? []).filter(
        (s) => s !== "Other" && s !== "Schedule"
      ),
      mathLevel: (r.get("Math Level") as string | null) ?? null,
      readingLevel: (r.get("Reading Level") as string | null) ?? null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
