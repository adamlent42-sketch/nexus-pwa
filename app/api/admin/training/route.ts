import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/training — completion matrix: active staff × published modules.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const [moduleRecs, staffRecs, progressRecs] = await Promise.all([
      airtable()(TABLE.TrainingModules).select({
        filterByFormula: `{Published}=1`,
        fields: ["Module", "Track", "Order"]
      }).all(),
      airtable()(TABLE.Staff).select({
        filterByFormula: `OR({Status}='Active', {Status}='Departing')`,
        fields: ["Staff Name", "Tier"]
      }).all(),
      airtable()(TABLE.StaffTrainingProgress).select({
        fields: ["Staff", "Module", "Status", "Score", "Total"]
      }).all()
    ]);

    const modules = moduleRecs
      .map((m) => ({ id: m.id, name: (m.get("Module") as string | null) ?? "(module)", order: (m.get("Order") as number | null) ?? 999 }))
      .sort((a, b) => a.order - b.order);

    // (staffId|moduleId) -> status
    const cell = new Map<string, { status: string; score: number | null; total: number | null }>();
    for (const p of progressRecs) {
      const sid = ((p.get("Staff") as string[] | undefined) ?? [])[0];
      const mid = ((p.get("Module") as string[] | undefined) ?? [])[0];
      if (!sid || !mid) continue;
      cell.set(`${sid}|${mid}`, {
        status: (p.get("Status") as string | null) ?? "In Progress",
        score: (p.get("Score") as number | null) ?? null,
        total: (p.get("Total") as number | null) ?? null
      });
    }

    const staff = staffRecs
      .map((s) => {
        const tierRaw = s.get("Tier") as string | number | null;
        const tier = tierRaw == null ? Infinity : Number(tierRaw);
        const byModule: Record<string, { status: string; score: number | null; total: number | null }> = {};
        for (const m of modules) {
          byModule[m.id] = cell.get(`${s.id}|${m.id}`) ?? { status: "Not started", score: null, total: null };
        }
        return { id: s.id, name: (s.get("Staff Name") as string | null) ?? "(unnamed)", tier: Number.isFinite(tier) ? tier : null, byModule };
      })
      .sort((a, b) => ((a.tier ?? Infinity) - (b.tier ?? Infinity)) || a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, data: { modules, staff } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
