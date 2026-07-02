import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { StaffAlertUpdate } from "@/lib/schemas";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// PATCH /api/alerts/[id] — edit an existing staff alert in place.
// Updates the text, student link, category, and created-by without changing Status.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const json = await req.json();
    const parsed = StaffAlertUpdate.safeParse(json);
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
      // Setting to [] clears the link when the student is removed.
      Student: studentId ? [studentId] : []
    };

    await airtable()(TABLE.StaffAlerts).update([{ id, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
