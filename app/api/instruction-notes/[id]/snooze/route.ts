import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { snoozedUntil } = await req.json() as { snoozedUntil: string };
    if (!snoozedUntil) {
      return NextResponse.json({ ok: false, error: "snoozedUntil required" }, { status: 400 });
    }
    const fields: Partial<FieldSet> = {
      Status: "Snoozed",
      "Snoozed Until": snoozedUntil
    };
    await airtable()(TABLE.InstructionNotes).update([{ id, fields }]);
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
