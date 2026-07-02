import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// PATCH /api/instruction-notes/[id]/edit
// Updates the Note text and/or Category of an existing Active Instruction Note.
// Does NOT close it — for that, use /api/instruction-notes/[id]/close.
const Body = z.object({
  note: z.string().min(1).optional(),
  category: z.string().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const fields: Partial<FieldSet> = {};
    if (parsed.data.note !== undefined) fields["Note"] = parsed.data.note.trim();
    if (parsed.data.category !== undefined) fields["Category"] = parsed.data.category;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }
    const updated = await airtable()(TABLE.InstructionNotes).update(
      [{ id: params.id, fields }],
      { typecast: true }
    );
    return NextResponse.json({ ok: true, data: { id: updated[0].id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
