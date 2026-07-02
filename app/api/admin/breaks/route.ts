import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/breaks — students on a planned break, plus anyone with a pending
// invoice to-do (cancel/reactivate) so nothing slips. Owner-only.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const recs = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `OR({Lifecycle Stage}='Planned Break', AND({Invoice Action}, {Invoice Action}!='Done'))`,
        fields: ["Student Name", "Lifecycle Stage", "Hold Start", "Planned Return", "Break Check-in Date", "Hold Notes", "Invoice Action"]
      })
      .all();
    const data = recs
      .map((r) => ({
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(student)",
        lifecycle: (r.get("Lifecycle Stage") as string | null) ?? null,
        holdStart: (r.get("Hold Start") as string | null) ?? null,
        plannedReturn: (r.get("Planned Return") as string | null) ?? null,
        checkin: (r.get("Break Check-in Date") as string | null) ?? null,
        notes: (r.get("Hold Notes") as string | null) ?? null,
        invoiceAction: (r.get("Invoice Action") as string | null) ?? null
      }))
      .sort((a, b) => (a.checkin ?? a.plannedReturn ?? "9999").localeCompare(b.checkin ?? b.plannedReturn ?? "9999"));
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
