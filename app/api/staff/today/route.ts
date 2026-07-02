import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, dayNameET } from "@/lib/time";
import type { StaffRow, ApiResponse } from "@/types/kumon";

export const dynamic = "force-dynamic";

// GET /api/staff/today?date=YYYY-MM-DD
// Returns staff scheduled for the requested date (defaults to today ET) and
// flags which of them are out via Time Off records covering that date.
//
// For literal "today" we used to rely on the Weekly Schedule's "Staff Out
// Today" rollup (a same-day cache). That cache is empty for other dates, so
// we now always cross-reference the Time Off table: any Approved or
// Auto-logged absence whose date range covers the requested date marks the
// staff member out — regardless of whether the date is today, past, or future.
export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInET();
    const dayName = dayNameET(date);

    const [scheduleRecords, timeOffRecords] = await Promise.all([
      airtable()(TABLE.WeeklySchedule)
        .select({
          // Include recurring rows for this weekday (no Specific Date) plus any
          // one-off rows whose Specific Date is the requested date. One-off rows
          // with a Specific Date never show on other weeks.
          filterByFormula: `OR(
            AND({Day of Week} = '${dayName}', {Specific Date} = BLANK()),
            IS_SAME({Specific Date}, '${date}', 'day')
          )`,
          fields: [
            "Staff",
            "Staff Name",
            "Role",
            "Start Time",
            "End Time",
            "Specific Date"
          ]
        })
        .all(),
      airtable()(TABLE.TimeOff)
        .select({
          // Pull every approved/auto-logged absence whose range covers the
          // requested date. Effective End Date may equal Start Date for a
          // single-day absence.
          filterByFormula: `AND(
            OR({Status}='Approved', {Status}='Auto-logged'),
            {Start Date},
            IS_BEFORE({Start Date}, DATEADD('${date}', 1, 'days')),
            IS_AFTER(DATEADD({Effective End Date}, 1, 'days'), '${date}')
          )`,
          fields: ["Staff"]
        })
        .all()
    ]);

    const staffOutForDate = new Set<string>();
    for (const r of timeOffRecords) {
      const links = (r.get("Staff") as string[] | undefined) ?? [];
      for (const id of links) staffOutForDate.add(id);
    }

    const staff: StaffRow[] = scheduleRecords.map((r) => {
      const staffLinks = (r.get("Staff") as string[] | undefined) ?? [];
      const nameArr = (r.get("Staff Name") as string[] | undefined) ?? [];
      const roleArr = (r.get("Role") as string[] | undefined) ?? [];
      const staffId = staffLinks[0] ?? "";
      const isOut = staffId ? staffOutForDate.has(staffId) : false;
      return {
        id: r.id,
        staffId,
        name: nameArr[0] ?? "(unnamed)",
        role: roleArr.length > 0 ? roleArr.join(" + ") : null,
        startTime: (r.get("Start Time") as string | null) ?? null,
        endTime: (r.get("End Time") as string | null) ?? null,
        isOut
      };
    });

    staff.sort((a, b) => {
      if (a.isOut !== b.isOut) return a.isOut ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    const body: ApiResponse<StaffRow[]> = { ok: true, data: staff };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
