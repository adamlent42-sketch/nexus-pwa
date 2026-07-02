import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { InstructionNoteCreate } from "@/lib/schemas";
import type { FieldSet } from "airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = InstructionNoteCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { studentId, note, category, createdBy } = parsed.data;
    const fields: Partial<FieldSet> = {
      Note: note,
      Student: [studentId],
      Category: category,
      "Created By": createdBy,
      "Date Noted": todayInET(),
      Status: "Active"
    };
    const created = await airtable()(TABLE.InstructionNotes).create([{ fields }], { typecast: true });
    const first = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
