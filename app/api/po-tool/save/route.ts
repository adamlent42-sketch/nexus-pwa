import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// POST /api/po-tool/save
// Writes the at-the-table enrollment choices back onto the PO record so the PO
// recap is pre-filled: starting levels, schedule, start date, class time, and
// Outcome = "Plan to Enroll". Walk-ins (no poId) just return — nothing to write.
const Body = z.object({
  poId: z.string().optional(),
  mathLevel: z.string().optional(),
  readingLevel: z.string().optional(),
  schedule: z.array(z.string()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classTime: z.string().optional()
});

const DAY: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    const d = parsed.data;
    if (!d.poId) return NextResponse.json({ ok: true, data: { written: false } });

    const f: Partial<FieldSet> = { Outcome: "Plan to Enroll" };
    if (d.mathLevel) f["Recommended Math Starting Level"] = d.mathLevel;
    if (d.readingLevel) f["Recommended Reading Starting Level"] = d.readingLevel;
    if (d.schedule && d.schedule.length) f["Planned Schedule"] = d.schedule.map((x) => DAY[x] ?? x);
    if (d.startDate) f["Planned Start Date"] = d.startDate;
    if (d.classTime) f["Planned Class Time"] = d.classTime;

    await airtable()(TABLE.POs).update([{ id: d.poId, fields: f }], { typecast: true });
    return NextResponse.json({ ok: true, data: { written: true } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
