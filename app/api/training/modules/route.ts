import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/training/modules?staffId=...  (staff-facing kiosk)
// Published modules + this staff member's status on each.
export async function GET(req: NextRequest) {
  try {
    const staffId = req.nextUrl.searchParams.get("staffId");

    const [moduleRecs, blockRecs, progressRecs] = await Promise.all([
      airtable()(TABLE.TrainingModules).select({
        filterByFormula: `{Published}=1`,
        fields: ["Module", "Track", "Order", "Pass Threshold", "Description", "Estimated Minutes"]
      }).all(),
      airtable()(TABLE.TrainingBlocks).select({ fields: ["Module", "Question Type"] }).all(),
      staffId
        ? airtable()(TABLE.StaffTrainingProgress).select({
            fields: ["Staff", "Module", "Status", "Score", "Total"]
          }).all()
        : Promise.resolve([])
    ]);

    // Count gradeable blocks (everything except Reflection) per module.
    const blockCount = new Map<string, number>();
    for (const b of blockRecs) {
      if ((b.get("Question Type") as string | null) === "Reflection") continue;
      for (const mid of ((b.get("Module") as string[] | undefined) ?? [])) {
        blockCount.set(mid, (blockCount.get(mid) ?? 0) + 1);
      }
    }

    // This staff member's progress by module.
    const myProgress = new Map<string, { status: string; score: number | null; total: number | null }>();
    if (staffId) {
      for (const p of progressRecs) {
        const staffLink = (p.get("Staff") as string[] | undefined) ?? [];
        if (!staffLink.includes(staffId)) continue;
        for (const mid of ((p.get("Module") as string[] | undefined) ?? [])) {
          myProgress.set(mid, {
            status: (p.get("Status") as string | null) ?? "In Progress",
            score: (p.get("Score") as number | null) ?? null,
            total: (p.get("Total") as number | null) ?? null
          });
        }
      }
    }

    const data = moduleRecs
      .map((m) => {
        const prog = myProgress.get(m.id);
        return {
          id: m.id,
          module: (m.get("Module") as string | null) ?? "(module)",
          track: (m.get("Track") as string | null) ?? null,
          order: (m.get("Order") as number | null) ?? 999,
          passThreshold: (m.get("Pass Threshold") as number | null) ?? 0,
          description: (m.get("Description") as string | null) ?? "",
          estMinutes: (m.get("Estimated Minutes") as number | null) ?? null,
          gradeable: blockCount.get(m.id) ?? 0,
          status: prog?.status ?? "Not started",
          score: prog?.score ?? null,
          total: prog?.total ?? null
        };
      })
      .sort((a, b) => (a.track ?? "").localeCompare(b.track ?? "") || a.order - b.order);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
