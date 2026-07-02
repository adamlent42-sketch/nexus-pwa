import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/admin/upcoming-starts
// Lists POs whose Planned Start Date is today or later, regardless of recap status,
// where the outcome suggests they will actually start.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();

    const records = await airtable()(TABLE.POs)
      .select({
        // Include recent-past starts (last 30 days) too, so a student can still
        // be marked once they've actually attended — not only before their date.
        filterByFormula: `AND(
          {Planned Start Date},
          IS_AFTER(DATEADD({Planned Start Date}, 30, 'days'), '${today}'),
          OR({Outcome}='Plan to Enroll', {Outcome}='Enrolled')
        )`,
        sort: [{ field: "Planned Start Date", direction: "asc" }],
        fields: [
          "Student Display", "Grade", "Subject Interest",
          "Planned Start Date", "Planned Class Time", "Planned Schedule",
          "Outcome", "Recap Status", "eEnrollment Form Completed", "Students",
          "Parent Phone",
          "Invoice Sent", "Recurring Invoice Set Up",
          "Plastic Folder Made", "Books Pulled", "First Invoice Paid", "Enrolled in KSIS"
        ]
      })
      .all();

    // Resolve linked students so we can (a) return their IDs for the
    // "mark first class done" action and (b) drop anyone already Active.
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
        // "Already started" only if every linked student is active.
        const alreadyStarted = studentIds.length > 0 && studentIds.every((id) => studentActive.get(id));
        return {
          id: r.id,
          studentIds,
          alreadyStarted,
          student: (r.get("Student Display") as string | null) ?? "(unnamed)",
          grade: (r.get("Grade") as string | null) ?? null,
          subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []),
          plannedStartDate: (r.get("Planned Start Date") as string | null) ?? null,
          plannedClassTime: (r.get("Planned Class Time") as string | null) ?? null,
          plannedSchedule: ((r.get("Planned Schedule") as string[] | undefined) ?? []),
          outcome: (r.get("Outcome") as string | null) ?? null,
          recapStatus: (r.get("Recap Status") as string | null) ?? null,
          eEnrollmentCompleted: Boolean(r.get("eEnrollment Form Completed")),
          phone: (r.get("Parent Phone") as string | null) ?? null,
          invoiceSent: Boolean(r.get("Invoice Sent")),
          recurringInvoiceSetUp: Boolean(r.get("Recurring Invoice Set Up")),
          plasticFolderMade: Boolean(r.get("Plastic Folder Made")),
          booksPulled: Boolean(r.get("Books Pulled")),
          firstInvoicePaid: Boolean(r.get("First Invoice Paid")),
          enrolledInKsis: Boolean(r.get("Enrolled in KSIS"))
        };
      })
      .filter((row) => !row.alreadyStarted);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
