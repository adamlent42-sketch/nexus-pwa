import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import type { FieldSet } from "airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { closingNote, completedBy } = await req.json() as { closingNote: string; completedBy: string };
    if (!closingNote || !completedBy) {
      return NextResponse.json({ ok: false, error: "closingNote and completedBy required" }, { status: 400 });
    }
    const fields: Partial<FieldSet> = {
      Status: "Complete",
      "Closing Note": closingNote,
      "Completed By": completedBy,
      "Completed Date": todayInET(),
      "Owner Review Status": "Pending Review"
    };
    await airtable()(TABLE.InstructionNotes).update([{ id, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
