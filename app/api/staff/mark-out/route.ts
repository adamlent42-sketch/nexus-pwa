import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// POST /api/staff/mark-out — log a Same-Day Absence for today
// Body: { staffId: string }
export async function POST(req: NextRequest) {
  try {
    const { staffId } = await req.json() as { staffId: string };
    if (!staffId) {
      return NextResponse.json({ ok: false, error: "staffId required" }, { status: 400 });
    }
    const today = todayInET();
    const fields: Partial<FieldSet> = {
      Staff: [staffId],
      Type: "Same-Day Absence",
      "Start Date": today,
      Status: "Auto-logged"
    };
    const created = await airtable()(TABLE.TimeOff).create([{ fields }]);
    const first = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
