import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/po-recaps/search?q=name
// Searches ALL POs (not just pending) by student display name.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ ok: true, data: [] });

    // Airtable SEARCH() is case-insensitive substring match.
    const filterByFormula = `SEARCH(LOWER("${q.replace(/"/g, "")}"), LOWER({Student Display}))`;

    const records = await airtable()(TABLE.POs)
      .select({
        filterByFormula,
        sort: [{ field: "PO Date", direction: "desc" }],
        maxRecords: 20,
        fields: [
          "PO Date", "PO Time", "Student Display", "Grade",
          "Status", "Outcome", "Subject Interest", "Parent Phone",
          "Booking Source", "Recap Status", "Planned Start Date",
          "Planned Class Time", "Planned Schedule",
          "Recommended Math Starting Level", "Recommended Reading Starting Level",
          "Lead Source", "Staff Notes ", "Notes", "eEnrollment Form Completed",
          "Target Student Lifecycle", "30 Day Vision", "GPS Priorities"
        ]
      })
      .all();

    const data = records.map((r) => ({
      id: r.id,
      date: (r.get("PO Date") as string | null) ?? null,
      time: (r.get("PO Time") as string | null) ?? "",
      student: (r.get("Student Display") as string | null) ?? "(unnamed)",
      grade: (r.get("Grade") as string | null) ?? null,
      status: (r.get("Status") as string | null) ?? null,
      outcome: (r.get("Outcome") as string | null) ?? null,
      subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []),
      phone: (r.get("Parent Phone") as string | null) ?? null,
      source: (r.get("Booking Source") as string | null) ?? null,
      plannedStartDate: (r.get("Planned Start Date") as string | null) ?? null,
      plannedClassTime: (r.get("Planned Class Time") as string | null) ?? null,
      plannedSchedule: ((r.get("Planned Schedule") as string[] | undefined) ?? []),
      mathLevel: (r.get("Recommended Math Starting Level") as string | null) ?? null,
      readingLevel: (r.get("Recommended Reading Starting Level") as string | null) ?? null,
      leadSource: (r.get("Lead Source") as string | null) ?? null,
      staffNotes: (r.get("Staff Notes ") as string | null) ?? null,
      bookingNotes: (r.get("Notes") as string | null) ?? null,
      eEnrollmentCompleted: Boolean(r.get("eEnrollment Form Completed")),
      targetLifecycle: (r.get("Target Student Lifecycle") as string | null) ?? null,
      recapStatus: (r.get("Recap Status") as string | null) ?? null,
      thirtyDayVision: (r.get("30 Day Vision") as string | null) ?? null,
      gpsPriorities: ((r.get("GPS Priorities") as string[] | undefined) ?? [])
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
