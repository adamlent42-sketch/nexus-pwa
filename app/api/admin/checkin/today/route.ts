import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function etDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function minutesSince(isoTimestamp: string): number {
  return Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60000);
}

// GET /api/admin/checkin/today
// Returns all attendance records for today — both active (no check-out) and
// already checked-out — so staff can log observations after a student leaves.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const todayISO = etDateISO();

    const records = await airtable()(TABLE.AttendanceLog)
      .select({
        filterByFormula: `AND(
          {Date} = '${todayISO}',
          {Check-In Time} != BLANK()
        )`,
        fields: [
          "Student Name",
          "Student",
          "Check-In Time",
          "Check-Out Time",
          "Observation Completion",
          "Observation Notes",
        ],
        sort: [{ field: "Check-In Time", direction: "asc" }],
      })
      .all();

    const data = records.map((r) => {
      const checkInTime = (r.get("Check-In Time") as string | null) ?? "";
      const checkOutTime = (r.get("Check-Out Time") as string | null) ?? null;
      const studentLinks = (r.get("Student") as string[] | null) ?? [];
      return {
        id: r.id,
        studentId: studentLinks[0] ?? null,
        studentName: (r.get("Student Name") as string | null) ?? "(Unknown)",
        checkInTime,
        checkOutTime,
        minutesIn: checkInTime ? minutesSince(checkInTime) : 0,
        checkedOut: !!checkOutTime,
        observationAdded: !!(r.get("Observation Completion") || r.get("Observation Notes")),
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
