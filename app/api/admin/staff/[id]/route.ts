import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { STAFF_TIERS, STAFF_STATUSES, STAFF_ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

// PATCH /api/admin/staff/[id]
// Body: any subset of { name, email, phone, tier, status, workingThrough,
//        primaryRoles, notes }. Pass null to clear a clearable field.
const Body = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  tier: z.enum(STAFF_TIERS).nullable().optional(),
  status: z.enum(STAFF_STATUSES).optional(),
  workingThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  primaryRoles: z.array(z.enum(STAFF_ROLES)).optional(),
  notes: z.string().nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const fields: Partial<FieldSet> = {};
    if (parsed.data.name !== undefined) fields["Staff Name"] = parsed.data.name;
    if (parsed.data.email !== undefined) fields.Email = parsed.data.email ?? "";
    if (parsed.data.phone !== undefined) fields.Phone = parsed.data.phone ?? "";
    if (parsed.data.tier !== undefined) fields.Tier = parsed.data.tier ?? "";
    if (parsed.data.status !== undefined) fields.Status = parsed.data.status;
    if (parsed.data.workingThrough !== undefined) fields["Working Through"] = parsed.data.workingThrough ?? "";
    if (parsed.data.primaryRoles !== undefined) fields["Primary Roles"] = [...parsed.data.primaryRoles];
    if (parsed.data.notes !== undefined) fields.Notes = parsed.data.notes ?? "";

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: true, data: { id: params.id, noop: true } });
    }

    await airtable()(TABLE.Staff).update([{ id: params.id, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
