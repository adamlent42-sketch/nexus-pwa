import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE, ATTENDANCE_FIELD } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function etDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

// POST /api/admin/checkin/auto-close
// Closes any open attendance sessions from today (or optionally a specified date).
// Run nightly at midnight via scheduled task.
export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);

    const body = await req.json().catch(() => ({})) as { date?: string };
    const targetDate = body.date ?? etDateISO();

    const openRecords = await airtable()(TABLE.AttendanceLog)
      .select({
        filterByFormula: `AND(
          {Date} = '${targetDate}',
          {Check-Out Time} = BLANK(),
          {Check-In Time} != BLANK()
        )`
      })
      .all();

    if (openRecords.length === 0) {
      return NextResponse.json({ ok: true, data: { closed: 0, date: targetDate } });
    }

    const closeTime = new Date().toISOString();
    const updates = openRecords.map((r) => {
      const checkInTime = (r.get("Check-In Time") as string | null) ?? closeTime;
      const duration = minutesBetween(checkInTime, closeTime);
      return {
        id: r.id,
        fields: {
          [ATTENDANCE_FIELD.CheckOutTime]: closeTime,
          [ATTENDANCE_FIELD.DurationMinutes]: duration,
          [ATTENDANCE_FIELD.Method]: "Auto-closed"
        }
      };
    });

    // Airtable supports batch updates of up to 10 records at a time
    for (let i = 0; i < updates.length; i += 10) {
      await airtable()(TABLE.AttendanceLog).update(updates.slice(i, i + 10));
    }

    console.log(`[auto-close] Closed ${openRecords.length} open sessions for ${targetDate}`);
    return NextResponse.json({ ok: true, data: { closed: openRecords.length, date: targetDate } });

  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
