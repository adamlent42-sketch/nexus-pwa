import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/po-tool/families?q=  — search existing Families by name for the walk-in
// family picker. Returns id, name, and a contact email for disambiguation.
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ ok: true, data: [] });
    const safe = q.replace(/['"\\]/g, "").toLowerCase();
    const recs = await airtable()(TABLE.Families)
      .select({
        filterByFormula: `SEARCH('${safe}', LOWER({Family Name}))`,
        fields: ["Family Name", "Mother Email", "Father Email", "Other Contact Email"],
        maxRecords: 12
      })
      .all();
    const data = recs.map((r) => ({
      id: r.id,
      name: (r.get("Family Name") as string) || "(family)",
      email: (r.get("Mother Email") as string) || (r.get("Father Email") as string) || (r.get("Other Contact Email") as string) || ""
    }));
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
