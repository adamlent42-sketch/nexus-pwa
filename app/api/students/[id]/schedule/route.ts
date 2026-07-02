import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

const VALID_DAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

// PATCH /api/students/[id]/schedule
// Body: { schedule: string[] }   — days of week
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json() as { schedule: string[] };
    const days = (body.schedule ?? []).filter((d) => VALID_DAYS.has(d));
    const fields: Partial<FieldSet> = { Schedule: days };
    await airtable()(TABLE.Students).update([{ id, fields }]);
    return NextResponse.json({ ok: true, data: { id, schedule: days } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/students/[id]/schedule — read current schedule + work pickup day
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const r = await airtable()(TABLE.Students).find(id);
    const days = ((r.get("Schedule") as string[] | undefined) ?? []) as string[];
    const name = (r.get("Student Name") as string | null) ?? "";
    const workPickupDay = (r.get("Work Pickup Day") as string | null) ?? null;
    return NextResponse.json({ ok: true, data: { id, name, schedule: days, workPickupDay } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
