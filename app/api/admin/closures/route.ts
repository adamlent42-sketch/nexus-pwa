import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { CLOSURE_REASONS } from "@/lib/options";

export const dynamic = "force-dynamic";

interface ClosureOut {
  id: string;
  date: string;
  reason: string | null;
  notes: string | null;
  announced: boolean;
}

// GET /api/admin/closures
// Returns every closure on file, sorted by date ascending.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const records = await airtable()(TABLE.Closures)
      .select({
        fields: ["Date", "Reason", "Notes", "Announced to Families"],
        sort: [{ field: "Date", direction: "asc" }]
      })
      .all();

    const data: ClosureOut[] = records.map((r) => ({
      id: r.id,
      date: (r.get("Date") as string | null) ?? "",
      reason: (r.get("Reason") as string | null) ?? null,
      notes: (r.get("Notes") as string | null) ?? null,
      announced: Number(r.get("Announced to Families") ?? 0) > 0
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET closures] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load closures";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/closures
// Accepts either a single closure or a batch of closures (for adding a whole
// break range with one click).
// Body: { dates: string[] (YYYY-MM-DD), reason, notes? }
const PostBody = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, "at least one date required"),
  reason: z.enum(CLOSURE_REASONS),
  notes: z.string().nullable().optional()
});

export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);
    const json = await req.json();
    const parsed = PostBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    // Skip dates that already have a closure on file — saves accidentally
    // creating duplicates when the admin clicks "Add all" twice.
    const existing = await airtable()(TABLE.Closures)
      .select({
        fields: ["Date"],
        filterByFormula: `OR(${parsed.data.dates.map((d) => `{Date}='${d}'`).join(",")})`
      })
      .all();
    const taken = new Set(existing.map((r) => (r.get("Date") as string | null) ?? ""));

    const toCreate = parsed.data.dates.filter((d) => !taken.has(d));
    if (toCreate.length === 0) {
      return NextResponse.json({ ok: true, data: { created: 0, skipped: parsed.data.dates.length } });
    }

    // Airtable cap: 10 records per create call. We send in chunks.
    const records: { fields: Partial<FieldSet> }[] = toCreate.map((d) => {
      const fields: Partial<FieldSet> = {
        Date: d,
        Reason: parsed.data.reason
      };
      if (parsed.data.notes) fields.Notes = parsed.data.notes;
      return { fields };
    });
    for (let i = 0; i < records.length; i += 10) {
      await airtable()(TABLE.Closures).create(records.slice(i, i + 10), { typecast: true });
    }

    return NextResponse.json({
      ok: true,
      data: { created: toCreate.length, skipped: parsed.data.dates.length - toCreate.length }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[POST closures] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to add closures";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
