import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/students?lifecycle=active
// Returns students for admin tools (QR labels, etc.).
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const lifecycle = req.nextUrl.searchParams.get("lifecycle") ?? "";

    const lifecycleFilter = lifecycle === "active"
      ? `OR({Lifecycle Stage}='Active-Engaged', {Lifecycle Stage}='Active-At-Risk')`
      : `{Student Name} != ''`;

    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula: lifecycleFilter,
        sort: [{ field: "Student Name", direction: "asc" }],
        fields: [
          "Student Name", "First Name", "Subjects", "Schedule", "Lifecycle Stage", "Work Pickup Day"
        ]
      })
      .all();

    const data = records.map((r) => ({
      id: r.id,
      student: (r.get("Student Name") as string | null) ?? "(unnamed)",
      firstName: (r.get("First Name") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
      schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
      workPickupDay: (r.get("Work Pickup Day") as string | null) ?? null,
      lifecycle: (r.get("Lifecycle Stage") as string | null) ?? null
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
