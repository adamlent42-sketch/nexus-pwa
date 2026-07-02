import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/po-tool/upcoming
// Upcoming (Scheduled/Rescheduled, today or later) POs for the PO-tool picker,
// with the parent's email resolved from the linked Family. Public (kiosk page).
export async function GET(_req: NextRequest) {
  try {
    const today = todayInET();
    const pos = await airtable()(TABLE.POs)
      .select({
        filterByFormula: `OR({Status}='Scheduled',{Status}='Rescheduled')`,
        fields: ["PO Date", "Status", "Student Display", "Grade", "Subject Interest", "Family"]
      })
      .all();

    const upcoming = pos.filter((r) => ((r.get("PO Date") as string | null) ?? "") >= today);

    const famIds = new Set<string>();
    for (const r of upcoming) for (const id of ((r.get("Family") as string[] | undefined) ?? [])) famIds.add(id);

    const email = new Map<string, string>();
    if (famIds.size) {
      const fams = await airtable()(TABLE.Families)
        .select({
          filterByFormula: `OR(${[...famIds].map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: ["Mother Email", "Father Email", "Other Contact Email"]
        })
        .all();
      for (const f of fams) {
        const e = (f.get("Mother Email") as string | null) || (f.get("Father Email") as string | null) || (f.get("Other Contact Email") as string | null) || "";
        email.set(f.id, e);
      }
    }

    const data = upcoming
      .sort((a, b) => ((a.get("PO Date") as string | null) ?? "").localeCompare((b.get("PO Date") as string | null) ?? ""))
      .map((r) => {
        const fam = ((r.get("Family") as string[] | undefined) ?? [])[0];
        return {
          id: r.id,
          name: (r.get("Student Display") as string | null) ?? "(student)",
          grade: (r.get("Grade") as string | null) ?? "",
          subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []),
          poDate: (r.get("PO Date") as string | null) ?? "",
          email: fam ? (email.get(fam) ?? "") : ""
        };
      });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
