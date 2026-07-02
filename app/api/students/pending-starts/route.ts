import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/students/pending-starts  (staff-facing, no admin gate)
// Lists students who are committed to start (PO Outcome Plan to Enroll / Enrolled)
// with a Planned Start Date within the last 30 days or in the future, who have
// NOT yet been marked active. Powers the "Starting soon — mark first class" card.
export async function GET() {
  try {
    const today = todayInET();

    const records = await airtable()(TABLE.POs)
      .select({
        filterByFormula: `AND(
          {Planned Start Date},
          IS_AFTER(DATEADD({Planned Start Date}, 30, 'days'), '${today}'),
          OR({Outcome}='Plan to Enroll', {Outcome}='Enrolled')
        )`,
        sort: [{ field: "Planned Start Date", direction: "asc" }],
        fields: [
          "Student Display", "Grade", "Subject Interest",
          "Planned Start Date", "Planned Class Time", "Planned Schedule",
          "eEnrollment Form Completed", "Students"
        ]
      })
      .all();

    const allStudentIds = Array.from(
      new Set(records.flatMap((r) => ((r.get("Students") as string[] | undefined) ?? [])))
    );
    const studentActive = new Map<string, boolean>();
    if (allStudentIds.length > 0) {
      const studentRecs = await airtable()(TABLE.Students)
        .select({
          filterByFormula: `OR(${allStudentIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: ["Lifecycle Stage", "First Class Attended Date"]
        })
        .all();
      for (const s of studentRecs) {
        const stage = (s.get("Lifecycle Stage") as string | null) ?? "";
        const attended = s.get("First Class Attended Date") as string | null;
        studentActive.set(s.id, stage === "Active-Engaged" || stage === "Active-At-Risk" || Boolean(attended));
      }
    }

    const data = records
      .map((r) => {
        const studentIds = ((r.get("Students") as string[] | undefined) ?? []) as string[];
        const alreadyStarted = studentIds.length > 0 && studentIds.every((id) => studentActive.get(id));
        return {
          id: r.id,
          studentIds,
          alreadyStarted,
          student: (r.get("Student Display") as string | null) ?? "(unnamed)",
          grade: (r.get("Grade") as string | null) ?? null,
          subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []) as string[],
          plannedStartDate: (r.get("Planned Start Date") as string | null) ?? null,
          plannedClassTime: (r.get("Planned Class Time") as string | null) ?? null,
          plannedSchedule: ((r.get("Planned Schedule") as string[] | undefined) ?? []) as string[],
          eEnrollmentCompleted: Boolean(r.get("eEnrollment Form Completed"))
        };
      })
      .filter((row) => !row.alreadyStarted);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
