import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/staff/list
// Active + Departing staff. Sorted by Tier ascending (numeric), then name A→Z.
// Tier is a singleSelect with options "1".."6", but Airtable's singleSelect sort
// uses option position rather than numeric value — so we parse + sort here for
// predictable ordering regardless of how the options are configured.
export async function GET() {
  try {
    const records = await airtable()(TABLE.Staff)
      .select({
        filterByFormula: `OR({Status}='Active', {Status}='Departing')`,
        fields: ["Staff Name", "Tier"]
      })
      .all();

    const data = records
      .map((r) => ({
        id: r.id,
        name: (r.get("Staff Name") as string | null) ?? "(unnamed)"
      }))
      .sort((a, b) => {
        // Sort by first name A→Z
        const aFirst = a.name.split(" ")[0] ?? a.name;
        const bFirst = b.name.split(" ")[0] ?? b.name;
        return aFirst.localeCompare(bFirst);
      });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
