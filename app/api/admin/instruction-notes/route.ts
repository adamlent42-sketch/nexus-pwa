import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { fetchStudentLookups } from "@/lib/students";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import type { RecordId } from "@/types/kumon";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const records = await airtable()(TABLE.InstructionNotes)
      .select({
        filterByFormula: `AND({Status} = 'Complete', {Owner Review Status} = 'Pending Review')`,
        sort: [{ field: "Completed Date", direction: "desc" }],
        fields: [
          "Note", "Closing Note", "Parent-Facing Version", "Student",
          "Category", "Created By", "Date Noted",
          "Completed By", "Completed Date"
        ]
      })
      .all();

    const studentIds = records.flatMap(
      (r) => (r.get("Student") as RecordId[] | undefined) ?? []
    );
    const lookups = await fetchStudentLookups(studentIds);

    const data = records.map((r) => {
      const links = (r.get("Student") as RecordId[] | undefined) ?? [];
      const first = links[0];
      return {
        id: r.id,
        studentName: first ? lookups.get(first)?.name ?? null : null,
        studentGrade: first ? lookups.get(first)?.grade ?? null : null,
        note: (r.get("Note") as string | null) ?? "",
        closingNote: (r.get("Closing Note") as string | null) ?? "",
        parentFacingVersion: (r.get("Parent-Facing Version") as string | null) ?? "",
        category: (r.get("Category") as string | null) ?? null,
        createdBy: (r.get("Created By") as string | null) ?? null,
        dateNoted: (r.get("Date Noted") as string | null) ?? null,
        completedBy: (r.get("Completed By") as string | null) ?? null,
        completedDate: (r.get("Completed Date") as string | null) ?? null
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
