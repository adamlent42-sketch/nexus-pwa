import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { PickupNotificationCreate } from "@/lib/schemas";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = PickupNotificationCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { studentIds, submittedBy, notes } = parsed.data;

    const fields: Partial<FieldSet> = {
      Students: studentIds,
      "Submitted By": submittedBy,
      Status: "Pending"
    };
    if (notes && notes.trim()) fields["Notes"] = notes.trim();

    const created = await airtable()(TABLE.WorkPickupNotifications).create([{ fields }]);
    const first = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
