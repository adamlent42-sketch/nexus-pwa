import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { fetchStudentLookups } from "@/lib/students";
import { todayInET, dayNameET } from "@/lib/time";
import type { InstructionNoteRow, ApiResponse, RecordId, DayOfWeek } from "@/types/kumon";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInET();
    const dayName = dayNameET(date);

    const records = await airtable()(TABLE.InstructionNotes)
      .select({
        filterByFormula: `{Status} = 'Active'`,
        sort: [{ field: "Date Noted", direction: "desc" }],
        fields: ["Note", "Category", "Created By", "Date Noted", "Student"]
      })
      .all();

    const studentIds = records.flatMap(
      (r) => ((r.get("Student") as RecordId[] | undefined) ?? [])
    );
    const lookups = await fetchStudentLookups(studentIds);

    const notes: InstructionNoteRow[] = records
      .map((r) => {
        const studentLinks = (r.get("Student") as RecordId[] | undefined) ?? [];
        const firstStudent = studentLinks[0];
        const lookup = firstStudent ? lookups.get(firstStudent) : undefined;
        return {
          id: r.id,
          note: (r.get("Note") as string | null) ?? "",
          category: (r.get("Category") as string | null) ?? null,
          createdBy: (r.get("Created By") as string | null) ?? null,
          dateNoted: (r.get("Date Noted") as string | null) ?? null,
          createdAt: r._rawJson?.createdTime ?? null,
          studentName: lookup?.name ?? null,
          studentSchedule: (lookup?.schedule ?? []) as DayOfWeek[]
        };
      })
      .filter((n) => n.studentSchedule.includes(dayName as DayOfWeek));

    const body: ApiResponse<InstructionNoteRow[]> = { ok: true, data: notes };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
