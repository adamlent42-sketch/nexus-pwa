import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

function etDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function minutesSince(isoTimestamp: string): number {
  return Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60000);
}

// GET /api/checkin/active
// Returns all students currently checked in (today, no check-out time).
// Used by the TV display and Who's Here panel.
export async function GET() {
  try {
    const todayISO = etDateISO();

    const records = await airtable()(TABLE.AttendanceLog)
      .select({
        filterByFormula: `AND(
          {Date} = '${todayISO}',
          {Check-Out Time} = BLANK(),
          {Check-In Time} != BLANK()
        )`,
        sort: [{ field: "Check-In Time", direction: "asc" }]
      })
      .all();

    const data = records.map((r) => {
      const checkInTime = (r.get("Check-In Time") as string | null) ?? "";
      const studentLinks = (r.get("Student") as string[] | null) ?? [];
      return {
        id: r.id,
        studentId: studentLinks[0] ?? null,
        studentName: (r.get("Student Name") as string | null) ?? "(Unknown)",
        checkInTime,
        minutesIn: checkInTime ? minutesSince(checkInTime) : 0,
        streak: (r.get("Streak At Check-In") as number | null) ?? 0,
        birthdayFlag: (r.get("Birthday Flag") as boolean | null) ?? false,
        milestoneTriggered: (r.get("Milestone Triggered") as number | null) ?? null,
        observationAdded: !!(r.get("Observation Completion") || r.get("Observation Notes"))
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
