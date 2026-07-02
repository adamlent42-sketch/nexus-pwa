import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { WEEKDAYS } from "@/lib/options";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/timing
// Returns the student's current schedule + the Planned Start Date from
// their most-recent-or-future PO (and the PO record ID so the PATCH knows
// which PO row to update).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const student = await airtable()(TABLE.Students).find(params.id);
    const schedule = ((student.get("Schedule") as string[] | undefined) ?? []) as string[];
    const linkedPOIds = ((student.get("POs") as string[] | undefined) ?? []) as string[];

    let plannedStartDate: string | null = null;
    let poId: string | null = null;
    if (linkedPOIds.length > 0) {
      // Pull all linked POs, pick the one with the latest PO Date.
      const poRecs = await Promise.all(
        linkedPOIds.map((id) => airtable()(TABLE.POs).find(id).catch(() => null))
      );
      const valid = poRecs.filter(Boolean) as NonNullable<(typeof poRecs)[number]>[];
      valid.sort((a, b) => {
        const ad = (a.get("PO Date") as string | null) ?? "";
        const bd = (b.get("PO Date") as string | null) ?? "";
        return bd.localeCompare(ad);
      });
      const latest = valid[0];
      if (latest) {
        poId = latest.id;
        plannedStartDate = (latest.get("Planned Start Date") as string | null) ?? null;
      }
    }
    return NextResponse.json({
      ok: true,
      data: { schedule, plannedStartDate, poId, studentId: params.id }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/students/[id]/timing
// Body: { schedule?: string[], plannedStartDate?: string | null }
// schedule -> Student.Schedule. plannedStartDate -> linked PO.Planned Start Date.
const Body = z.object({
  schedule: z.array(z.string()).optional(),
  plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const validDays = new Set(WEEKDAYS);
    const cleanSchedule = parsed.data.schedule?.filter((d) => validDays.has(d as typeof WEEKDAYS[number]));

    // 1. Update Student.Schedule if provided.
    if (cleanSchedule !== undefined) {
      const fields: Partial<FieldSet> = { Schedule: cleanSchedule };
      await airtable()(TABLE.Students).update([{ id: params.id, fields }], { typecast: true });
    }

    // 2. Update the linked PO's Planned Start Date if provided.
    if (parsed.data.plannedStartDate !== undefined) {
      const student = await airtable()(TABLE.Students).find(params.id);
      const linkedPOIds = ((student.get("POs") as string[] | undefined) ?? []) as string[];
      if (linkedPOIds.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Student has no linked PO to update — Planned Start Date lives on the PO record." },
          { status: 400 }
        );
      }
      // Pick the most recent PO
      const poRecs = await Promise.all(linkedPOIds.map((id) => airtable()(TABLE.POs).find(id).catch(() => null)));
      const valid = poRecs.filter(Boolean) as NonNullable<(typeof poRecs)[number]>[];
      valid.sort((a, b) => {
        const ad = (a.get("PO Date") as string | null) ?? "";
        const bd = (b.get("PO Date") as string | null) ?? "";
        return bd.localeCompare(ad);
      });
      const target = valid[0];
      if (!target) {
        return NextResponse.json({ ok: false, error: "Could not resolve linked PO" }, { status: 400 });
      }
      await airtable()(TABLE.POs).update(
        [{ id: target.id, fields: { "Planned Start Date": parsed.data.plannedStartDate ?? "" } }],
        { typecast: true }
      );
    }

    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
