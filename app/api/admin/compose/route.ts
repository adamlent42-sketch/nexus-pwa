import { NextRequest, NextResponse } from "next/server";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const TYPES = new Set([
  "Update Email", "Achievement Test", "Confirm Class Days",
  "Parent Reply", "Staff Broadcast", "Closure Notice",
  "First Class Follow-up", "First Weeks Check-in"
]);
// Which types need a linked student.
const NEEDS_STUDENT = new Set([
  "Update Email", "Achievement Test", "Confirm Class Days", "Parent Reply",
  "First Class Follow-up", "First Weeks Check-in"
]);

// POST /api/admin/compose — queue an on-demand email draft. The 15-min
// kumon-compose-drafter turns it into a Gmail draft for Adam to review.
export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);
    const body = (await req.json()) as {
      type?: string; studentId?: string; studentName?: string;
      notes?: string; closureDate?: string; closureDates?: string; recipientScope?: string; requestedBy?: string;
    };
    const type = body.type ?? "";
    const closureDates = (body.closureDates ?? body.closureDate ?? "").trim();
    if (!TYPES.has(type)) return NextResponse.json({ ok: false, error: "Unknown email type" }, { status: 400 });
    if (NEEDS_STUDENT.has(type) && !body.studentId) return NextResponse.json({ ok: false, error: "Pick a student for this email type" }, { status: 400 });
    if (type === "Closure Notice" && !closureDates) return NextResponse.json({ ok: false, error: "Add at least one closed day" }, { status: 400 });
    if ((type === "Parent Reply" || type === "Staff Broadcast") && !(body.notes ?? "").trim()) {
      return NextResponse.json({ ok: false, error: "Add the notes / pasted email for this type" }, { status: 400 });
    }

    const firstDate = closureDates.split(",")[0]?.trim();
    const label = body.studentName ? `${type} — ${body.studentName}`
      : type === "Closure Notice" ? `${type} — ${firstDate}${closureDates.includes(",") ? "…" : ""}`
      : type;

    const fields: Partial<FieldSet> = {
      Request: label,
      Type: type,
      Notes: body.notes ?? "",
      Status: "Pending",
      "Requested By": body.requestedBy ?? "Adam"
    };
    if (body.studentId) fields["Student"] = [body.studentId];
    if (type === "Closure Notice") {
      fields["Closure Dates"] = closureDates;
      if (firstDate) fields["Closure Date"] = firstDate;
      if (body.recipientScope) fields["Recipient Scope"] = body.recipientScope;
    }

    const created = await airtable()(TABLE.ComposeRequests).create([{ fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: created[0].id } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/admin/compose — recent requests + their draft status.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const recs = await airtable()(TABLE.ComposeRequests)
      .select({
        sort: [{ field: "Drafted At", direction: "desc" }],
        fields: ["Request", "Type", "Status", "Drafted At", "Last Error"],
        maxRecords: 25
      })
      .all();
    const rows = recs
      .map((r) => ({
        id: r.id,
        title: (r.get("Request") as string | null) ?? "(request)",
        type: (r.get("Type") as string | null) ?? "—",
        status: (r.get("Status") as string | null) ?? "Pending",
        draftedAt: (r.get("Drafted At") as string | null) ?? null,
        error: (r.get("Last Error") as string | null) ?? null,
        createdTime: (r as unknown as { _rawJson?: { createdTime?: string } })._rawJson?.createdTime ?? null
      }))
      .sort((a, b) => (b.createdTime ?? "").localeCompare(a.createdTime ?? ""));
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
