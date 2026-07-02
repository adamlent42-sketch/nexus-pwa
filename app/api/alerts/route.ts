import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { StaffAlertCreate } from "@/lib/schemas";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// POST /api/alerts — create a new Staff Alert (Status defaults to Active)
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = StaffAlertCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { alert, studentId, category, createdBy } = parsed.data;

    const fields: Partial<FieldSet> = {
      Alert: alert,
      Category: category,
      "Created By": createdBy,
      Status: "Active"
    };
    if (studentId) fields["Student"] = [studentId];

    const created = await airtable()(TABLE.StaffAlerts).create([{ fields }], { typecast: true });
    const first = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
