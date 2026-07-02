import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = new Date().toISOString().slice(0, 10);
    const records = await airtable()(TABLE.TimeOff)
      .select({
        // Pending always shows. Approved shows only if not fully in the past.
        filterByFormula: `OR(
          {Status} = 'Pending',
          AND({Status} = 'Approved', {Start Date}, IS_AFTER({Effective End Date}, '${today}'))
        )`,
        sort: [{ field: "Start Date", direction: "asc" }],
        fields: ["Staff Name", "Type", "Start Date", "End Date", "Effective End Date", "Notes", "Submitted At", "Urgent", "Status"]
      })
      .all();

    const data = records.map((r) => {
      const nameArr = (r.get("Staff Name") as string[] | undefined) ?? [];
      return {
        id: r.id,
        staffName: nameArr[0] ?? "(staff)",
        type: (r.get("Type") as string | null) ?? null,
        startDate: (r.get("Start Date") as string | null) ?? null,
        endDate: (r.get("End Date") as string | null) ?? null,
        effectiveEnd: (r.get("Effective End Date") as string | null) ?? null,
        notes: (r.get("Notes") as string | null) ?? null,
        urgent: Number(r.get("Urgent") ?? 0) > 0,
        status: (r.get("Status") as string | null) ?? "Pending"
      };
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
