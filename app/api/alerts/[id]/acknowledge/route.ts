import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

// PATCH /api/alerts/[id]/acknowledge — mark a staff alert acknowledged.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const json = (await req.json().catch(() => ({}))) as { acknowledgedBy?: string };
    const acknowledgedBy = json.acknowledgedBy ?? null;

    const fields: Partial<FieldSet> = {
      Status: "Acknowledged",
      "Acknowledged At": new Date().toISOString().slice(0, 10)
    };
    if (acknowledgedBy) fields["Acknowledged By"] = acknowledgedBy;

    await airtable()(TABLE.StaffAlerts).update([{ id, fields }]);
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
