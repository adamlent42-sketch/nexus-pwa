import { NextResponse } from "next/server";
import { airtable, TABLE, ATTENDANCE_FIELD } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// Vercel Cron: runs at 4am UTC = midnight ET (EDT summer).
// Closes any attendance sessions that were left open from the current day.

function etDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export async function GET() {
  try {
    const targetDate = etDateISO();
    const closeTime = new Date().toISOString();

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
      console.log(`[checkin-auto-close] No open sessions for ${targetDate}`);
      return NextResponse.json({ ok: true, data: { closed: 0, date: targetDate } });
    }

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

    // Batch update (10 at a time -- Airtable limit)
    for (let i = 0; i < updates.length; i += 10) {
      await airtable()(TABLE.AttendanceLog).update(updates.slice(i, i + 10));
    }

    console.log(`[checkin-auto-close] Closed ${openRecords.length} sessions for ${targetDate}`);
    return NextResponse.json({ ok: true, data: { closed: openRecords.length, date: targetDate } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[checkin-auto-close]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
