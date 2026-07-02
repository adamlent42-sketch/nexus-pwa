import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { fetchStudentLookups } from "@/lib/students";
import type { AlertRow, ApiResponse, RecordId } from "@/types/kumon";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await airtable()(TABLE.StaffAlerts)
      .select({
        filterByFormula: `{Status} = 'Active'`,
        sort: [{ field: "Date Noted", direction: "desc" }],
        fields: ["Alert", "Category", "Created By", "Date Noted", "Student"]
      })
      .all();

    const studentIds = records.flatMap(
      (r) => ((r.get("Student") as RecordId[] | undefined) ?? [])
    );
    const lookups = await fetchStudentLookups(studentIds);

    const alerts: AlertRow[] = records.map((r) => {
      const studentLinks = (r.get("Student") as RecordId[] | undefined) ?? [];
      const firstStudent = studentLinks[0];
      return {
        id: r.id,
        alert: (r.get("Alert") as string | null) ?? "",
        category: (r.get("Category") as string | null) ?? null,
        createdBy: (r.get("Created By") as string | null) ?? null,
        dateNoted: (r.get("Date Noted") as string | null) ?? null,
        // Real wall-clock UTC ISO for accurate "X hours ago". Date Noted is
        // date-only and parses to UTC midnight, which is ~16h ago in ET.
        createdAt: r._rawJson?.createdTime ?? null,
        studentId: firstStudent ?? null,
        studentName: firstStudent ? lookups.get(firstStudent)?.name ?? null : null
      };
    });

    const body: ApiResponse<AlertRow[]> = { ok: true, data: alerts };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
