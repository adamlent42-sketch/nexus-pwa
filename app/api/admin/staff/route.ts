import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { STAFF_TIERS, STAFF_STATUSES, STAFF_ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

// One row per shift on the Weekly Schedule table. We group these under the
// staff member on the client.
interface ShiftOut {
  id: string;
  dayOfWeek: string | null;
  role: string[];
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

interface StaffOut {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string | null;
  status: string | null;
  workingThrough: string | null;
  primaryRoles: string[];
  notes: string | null;
  shifts: ShiftOut[];
}

// Sort helper: tier ascending (numeric), unset goes last, then name A→Z.
function tierKey(t: string | null): number {
  if (!t) return Number.POSITIVE_INFINITY;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

// Day ordering inside a staff member's shifts.
const DAY_ORDER: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
};

// GET /api/admin/staff
// Returns every staff record + every Weekly Schedule shift grouped under each.
// Shifts that have no Staff link (orphaned) are dropped.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const [staffRecs, shiftRecs] = await Promise.all([
      airtable()(TABLE.Staff)
        .select({
          fields: ["Staff Name", "Email", "Phone", "Tier", "Status", "Working Through", "Primary Roles", "Notes"]
        })
        .all(),
      airtable()(TABLE.WeeklySchedule)
        .select({
          fields: ["Staff", "Day of Week", "Role", "Start Time", "End Time", "Notes"]
        })
        .all()
    ]);

    const shiftsByStaff = new Map<string, ShiftOut[]>();
    for (const r of shiftRecs) {
      const links = (r.get("Staff") as string[] | undefined) ?? [];
      if (links.length === 0) continue;
      const staffId = links[0];
      const shift: ShiftOut = {
        id: r.id,
        dayOfWeek: (r.get("Day of Week") as string | null) ?? null,
        role: (r.get("Role") as string[] | undefined) ?? [],
        startTime: (r.get("Start Time") as string | null) ?? null,
        endTime: (r.get("End Time") as string | null) ?? null,
        notes: (r.get("Notes") as string | null) ?? null
      };
      const arr = shiftsByStaff.get(staffId) ?? [];
      arr.push(shift);
      shiftsByStaff.set(staffId, arr);
    }

    const data: StaffOut[] = staffRecs.map((r) => {
      const id = r.id;
      const shifts = (shiftsByStaff.get(id) ?? []).sort((a, b) => {
        const ad = DAY_ORDER[a.dayOfWeek ?? ""] ?? 99;
        const bd = DAY_ORDER[b.dayOfWeek ?? ""] ?? 99;
        if (ad !== bd) return ad - bd;
        return (a.startTime ?? "").localeCompare(b.startTime ?? "");
      });
      return {
        id,
        name: (r.get("Staff Name") as string | null) ?? "(unnamed)",
        email: (r.get("Email") as string | null) ?? null,
        phone: (r.get("Phone") as string | null) ?? null,
        tier: (r.get("Tier") as string | null) ?? null,
        status: (r.get("Status") as string | null) ?? null,
        workingThrough: (r.get("Working Through") as string | null) ?? null,
        primaryRoles: (r.get("Primary Roles") as string[] | undefined) ?? [],
        notes: (r.get("Notes") as string | null) ?? null,
        shifts
      };
    });

    // Active first, then Departing, then Departed; within each by tier then name.
    const statusOrder: Record<string, number> = { Active: 0, Departing: 1, Departed: 2 };
    data.sort((a, b) => {
      const sa = statusOrder[a.status ?? ""] ?? 99;
      const sb = statusOrder[b.status ?? ""] ?? 99;
      if (sa !== sb) return sa - sb;
      const ta = tierKey(a.tier);
      const tb = tierKey(b.tier);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/staff
// Body: { name, email?, phone?, tier?, status?, primaryRoles? }
// Creates a new Staff record. Defaults status=Active. typecast on so a
// brand-new option ends up on the right field even if Airtable doesn't know it.
const CreateBody = z.object({
  name: z.string().trim().min(1, "name required"),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  tier: z.enum(STAFF_TIERS).nullable().optional(),
  status: z.enum(STAFF_STATUSES).optional(),
  primaryRoles: z.array(z.enum(STAFF_ROLES)).optional(),
  notes: z.string().nullable().optional()
});

export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);
    const json = await req.json();
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const fields: Partial<FieldSet> = {
      "Staff Name": parsed.data.name,
      Status: parsed.data.status ?? "Active"
    };
    if (parsed.data.email !== undefined && parsed.data.email !== null) fields.Email = parsed.data.email;
    if (parsed.data.phone !== undefined && parsed.data.phone !== null) fields.Phone = parsed.data.phone;
    if (parsed.data.tier !== undefined && parsed.data.tier !== null) fields.Tier = parsed.data.tier;
    if (parsed.data.primaryRoles && parsed.data.primaryRoles.length > 0) {
      fields["Primary Roles"] = [...parsed.data.primaryRoles];
    }
    if (parsed.data.notes !== undefined && parsed.data.notes !== null) fields.Notes = parsed.data.notes;

    const created = await airtable()(TABLE.Staff).create([{ fields }], { typecast: true });
    const rec = created[0];
    return NextResponse.json({ ok: true, data: { id: rec.id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
