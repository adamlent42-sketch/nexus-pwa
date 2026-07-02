import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { CLOSURE_REASONS } from "@/lib/options";

export const dynamic = "force-dynamic";

// PATCH /api/admin/closures/[id]
// Update reason, notes, or announced flag.
const PatchBody = z.object({
  reason: z.enum(CLOSURE_REASONS).optional(),
  notes: z.string().nullable().optional(),
  announced: z.boolean().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const json = await req.json();
    const parsed = PatchBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const fields: Partial<FieldSet> = {};
    if (parsed.data.reason !== undefined) fields.Reason = parsed.data.reason;
    if (parsed.data.notes !== undefined) fields.Notes = parsed.data.notes ?? "";
    if (parsed.data.announced !== undefined) fields["Announced to Families"] = parsed.data.announced;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: true, data: { id: params.id, noop: true } });
    }
    await airtable()(TABLE.Closures).update([{ id: params.id, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[PATCH closure] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update closure";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/closures/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    await airtable()(TABLE.Closures).destroy(params.id);
    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[DELETE closure] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to delete closure";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
