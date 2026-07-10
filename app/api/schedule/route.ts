import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAY_ORDER: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
};

// GET /api/schedule?staffId=recXXX
// Returns the staff member's weekly shifts, upcoming time-off, and upcoming closures.
export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId");
  if (!staffId) {
    return NextResponse.json({ ok: false, error: "staffId is required" }, { status: 400 });
  }

  try {
    const today = todayInET();
    const cutoff90 = new Date(today);
    cutoff90.setDate(cutoff90.getDate() + 90);
    const cutoff90Str = cutoff90.toISOString().slice(0, 10);

    const [staffRec, shiftRecs, timeOffRecs, closureRecs] = await Promise.all([
      airtable()(TABLE.Staff).find(staffId),
      airtable()(TABLE.WeeklySchedule)
        .select({
          filterByFormula: `FIND('${staffId}', ARRAYJOIN({Staff}))`,
          fields: ["Day of Week", "Role", "Start Time", "End Time", "Specific Date"]
        })
        .all(),
      airtable()(TABLE.TimeOff)
        .select({
          filterByFormula: `AND(FIND('${staffId}', ARRAYJOIN({Staff})), IS_AFTER({Start Date}, DATEADD('${today}', -1, 'days')), OR({Status}='Pending', {Status}='Approved'))`,
          fields: ["Type", "Start Date", "End Date", "Status", "Notes"],
          sort: [{ field: "Start Date", direction: "asc" }]
        })
        .all(),
      airtable()(TABLE.Closures)
        .select({
          filterByFormula: `AND(IS_AFTER({Date}, DATEADD('${today}', -1, 'days')), IS_BEFORE({Date}, '${cutoff90Str}'))`,
          fields: ["Date", "Reason", "Notes"],
          sort: [{ field: "Date", direction: "asc" }]
        })
        .all()
    ]);

    const staffName = (staffRec.get("Staff Name") as string | null) ?? "";
    const staffEmail = (staffRec.get("Email") as string | null) ?? null;

    // Recurring shifts only (no Specific Date one-offs)
    const shifts = shiftRecs
      .filter((r) => !r.get("Specific Date"))
      .map((r) => ({
        id: r.id,
        dayOfWeek: (r.get("Day of Week") as string | null) ?? "",
        role: (r.get("Role") as string[] | undefined) ?? [],
        startTime: (r.get("Start Time") as string | null) ?? null,
        endTime: (r.get("End Time") as string | null) ?? null
      }))
      .sort((a, b) => (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99));

    const timeOff = timeOffRecs.map((r) => ({
      id: r.id,
      type: (r.get("Type") as string | null) ?? "",
      startDate: (r.get("Start Date") as string | null) ?? "",
      endDate: (r.get("End Date") as string | null) ?? null,
      status: (r.get("Status") as string | null) ?? "",
      notes: (r.get("Notes") as string | null) ?? null
    }));

    const closures = closureRecs.map((r) => ({
      date: (r.get("Date") as string | null) ?? "",
      reason: (r.get("Reason") as string | null) ?? null,
      notes: (r.get("Notes") as string | null) ?? null
    }));

    return NextResponse.json({ ok: true, data: { staffName, staffEmail, shifts, timeOff, closures } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
