import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { WEEKDAYS_ALL, STAFF_ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

// POST /api/admin/staff/[id]/shifts
// Adds a new row to the Weekly Schedule table linked to this staff member.
// Body: { dayOfWeek, role[], startTime?, endTime?, notes? }
const Body = z.object({
  dayOfWeek: z.enum(WEEKDAYS_ALL),
  role: z.array(z.enum(STAFF_ROLES)).min(1, "role required"),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    const fields: Partial<FieldSet> = {
      Staff: [params.id],
      "Day of Week": parsed.data.dayOfWeek,
      Role: [...parsed.data.role]
    };
    if (parsed.data.startTime !== undefined && parsed.data.startTime !== null) {
      fields["Start Time"] = parsed.data.startTime;
    }
    if (parsed.data.endTime !== undefined && parsed.data.endTime !== null) {
      fields["End Time"] = parsed.data.endTime;
    }
    if (parsed.data.notes !== undefined && parsed.data.notes !== null) {
      fields.Notes = parsed.data.notes;
    }

    const created = await airtable()(TABLE.WeeklySchedule).create([{ fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: created[0].id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
