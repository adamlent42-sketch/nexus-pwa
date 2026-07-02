import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { WEEKDAYS_ALL, STAFF_ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

// PATCH /api/admin/staff/[id]/shifts/[shiftId]
// Edits one Weekly Schedule row. Day/role/times/notes all optional.
const PatchBody = z.object({
  dayOfWeek: z.enum(WEEKDAYS_ALL).optional(),
  role: z.array(z.enum(STAFF_ROLES)).optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; shiftId: string } }
) {
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
    if (parsed.data.dayOfWeek !== undefined) fields["Day of Week"] = parsed.data.dayOfWeek;
    if (parsed.data.role !== undefined) fields.Role = [...parsed.data.role];
    if (parsed.data.startTime !== undefined) fields["Start Time"] = parsed.data.startTime ?? "";
    if (parsed.data.endTime !== undefined) fields["End Time"] = parsed.data.endTime ?? "";
    if (parsed.data.notes !== undefined) fields.Notes = parsed.data.notes ?? "";

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: true, data: { id: params.shiftId, noop: true } });
    }
    await airtable()(TABLE.WeeklySchedule).update([{ id: params.shiftId, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: params.shiftId } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[PATCH shift] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update shift";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/staff/[id]/shifts/[shiftId]
// Removes a Weekly Schedule row. The [id] path segment exists for symmetry
// with the POST/PATCH routes; we don't validate the link here.
// Uses single-string destroy form (rather than array) because some Airtable
// JS client versions reject the promise with a non-Error object when called
// with an array, even when the delete actually succeeds.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; shiftId: string } }
) {
  try {
    requireAdminPass(req);
    await airtable()(TABLE.WeeklySchedule).destroy(params.shiftId);
    return NextResponse.json({ ok: true, data: { id: params.shiftId } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    // Log the raw error so we can see what Airtable actually rejected with.
    console.error("[DELETE shift] error:", err);
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Failed to delete shift";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
