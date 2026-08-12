import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();

    const records = await airtable()(TABLE.POs)
      .select({
        filterByFormula: `AND(
          NOT({Recap Status} = 'Reviewed'),
          NOT({Recap Status} = 'Legacy - Pre-Workflow'),
          {PO Date},
          IS_AFTER({PO Date}, DATEADD('${today}', -180, 'days')),
          IS_BEFORE({PO Date}, DATEADD('${today}', 32, 'days'))
        )`,
        sort: [{ field: "PO Date", direction: "desc" }],
        fields: [
          "PO Date", "PO Time", "Student Display", "Grade",
          "Status", "Outcome", "Subject Interest", "Parent Phone",
          "Booking Source", "Recap Status", "Planned Start Date",
          "Planned Class Time", "Planned Schedule",
          "Recommended Math Starting Level", "Recommended Reading Starting Level",
          "Lead Source", "Staff Notes ", "Notes", "eEnrollment Form Completed",
          "Target Student Lifecycle", "30 Day Vision", "GPS Priorities",
          "Family"
        ]
      })
      .all();

    // ── Last contact date per family ────────────────────────────────────────
    // Fetch recent outbound communications and build a familyId → latest-date map.
    const lastContactByFamily = new Map<string, string>();
    try {
      const commRecs = await airtable()(TABLE.Communications)
        .select({
          filterByFormula: `AND({Date}, IS_AFTER({Date}, DATEADD('${today}', -90, 'days')))`,
          sort: [{ field: "Date", direction: "desc" }],
          fields: ["Date", "Family"]
        })
        .all();
      for (const rec of commRecs) {
        const date = (rec.get("Date") as string | null) ?? null;
        const families = (rec.get("Family") as string[] | undefined) ?? [];
        for (const fid of families) {
          if (!lastContactByFamily.has(fid) && date) {
            lastContactByFamily.set(fid, date);
          }
        }
      }
    } catch {
      // Non-fatal — just won't show last contact dates
    }
    // ────────────────────────────────────────────────────────────────────────

    const data = records.map((r) => {
      const familyIds = ((r.get("Family") as string[] | undefined) ?? []) as string[];
      const familyId = familyIds[0] ?? null;
      const lastContactDate = familyId ? (lastContactByFamily.get(familyId) ?? null) : null;
      return {
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
        gpsPriorities: ((r.get("GPS Priorities") as string[] | undefined) ?? []),
        familyId,
        lastContactDate
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
