import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, dayNameET } from "@/lib/time";
import { STAFF_ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

// POST /api/staff/add-today
// Adds a staff member to a single day's class (defaults to today) WITHOUT
// creating a recurring weekly shift. It writes a Weekly Schedule row tagged
// with a Specific Date, so it only appears on that date and never repeats.
// Body: { staffId, role[], startTime?, endTime?, date? }
const Body = z.object({
  staffId: z.string().min(1, "staffId required"),
  role: z.array(z.enum(STAFF_ROLES)).min(1, "Pick at least one role"),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { staffId, role, startTime, endTime } = parsed.data;
    const date = parsed.data.date ?? todayInET();
    const dayName = dayNameET(date);

    const fields: Partial<FieldSet> = {
      Staff: [staffId],
      "Day of Week": dayName,
      Role: [...role],
      "Specific Date": date,
      ...(startTime ? { "Start Time": startTime } : {}),
      ...(endTime ? { "End Time": endTime } : {})
    };

    const created = await airtable()(TABLE.WeeklySchedule).create([{ fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: created[0].id, date } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
