import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// POST /api/pos/[id]/reschedule
// Reschedules an existing PO without losing history:
//   1. The original PO is marked Status = "Rescheduled" (it stays on record,
//      with an optional reason appended to its Staff Notes).
//   2. A brand-new PO is created at the new date/time with Status = "Scheduled",
//      copying the Family, Student(s), Subject Interest, Parent Phone and
//      Booking Source from the original so the appointment is fully linked.
// This prevents the "marked Rescheduled but never recreated" gap.
const Body = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "newDate must be YYYY-MM-DD"),
  newTime: z.string().min(1, "newTime is required"),
  reason: z.string().optional()
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { newDate, newTime, reason } = parsed.data;

    // 1. Load the original PO so we can copy its links and details forward.
    const original = await airtable()(TABLE.POs).find(id);
    const familyIds = ((original.get("Family") as string[] | undefined) ?? []) as string[];
    const studentIds = ((original.get("Students") as string[] | undefined) ?? []) as string[];
    const subjectInterest = ((original.get("Subject Interest") as string[] | undefined) ?? []) as string[];
    const parentPhone = (original.get("Parent Phone") as string | null) ?? "";
    const bookingSource = (original.get("Booking Source") as string | null) ?? "";
    const existingNotes = (original.get("Staff Notes ") as string | null) ?? "";

    // 2. Mark the original as Rescheduled (keep it for history).
    const rescheduleNote = `Rescheduled to ${newDate} ${newTime}${reason ? ` — ${reason}` : ""}`;
    const originalFields: Partial<FieldSet> = {
      Status: "Rescheduled",
      "Staff Notes ": existingNotes ? `${existingNotes}\n${rescheduleNote}` : rescheduleNote
    };
    await airtable()(TABLE.POs).update([{ id, fields: originalFields }], { typecast: true });

    // 3. Create the new PO at the new date/time, fully linked.
    const newFields: Partial<FieldSet> = {
      "PO Date": newDate,
      "PO Time": newTime,
      Status: "Scheduled",
      ...(bookingSource ? { "Booking Source": bookingSource } : {}),
      ...(familyIds.length ? { Family: familyIds } : {}),
      ...(studentIds.length ? { Students: studentIds } : {}),
      ...(subjectInterest.length ? { "Subject Interest": subjectInterest } : {}),
      ...(parentPhone ? { "Parent Phone": parentPhone } : {})
    };
    const created = await airtable()(TABLE.POs).create([{ fields: newFields }], { typecast: true });
    const newPoId = created[0].id;

    // 4. Enqueue the reschedule-confirmation email into the Email Outbox — the
    //    worker drafts it (with DNC/bounce guards). Dedupe-keyed so a re-run
    //    can't double it.
    const OUTBOX = "tblHWXG0SDfUNQc7L";
    const dedupeKey = `reschedule:${newPoId}`;
    const existing = await airtable()(OUTBOX)
      .select({ filterByFormula: `{Dedupe Key}='${dedupeKey}'`, fields: ["Dedupe Key"], maxRecords: 1 })
      .firstPage();
    if (existing.length === 0) {
      const outboxFields: Partial<FieldSet> = {
        Job: `Reschedule Confirmation — ${newDate} ${newTime}`,
        "Job Type": "Reschedule Confirmation",
        Status: "Pending",
        PO: [newPoId],
        ...(studentIds.length ? { Students: studentIds } : {}),
        ...(familyIds.length ? { Family: familyIds } : {}),
        "Trigger Source": "dashboard-reschedule",
        "Dedupe Key": dedupeKey
      };
      await airtable()(OUTBOX).create([{ fields: outboxFields }], { typecast: true });
    }

    return NextResponse.json({
      ok: true,
      data: { originalPoId: id, newPoId, newDate, newTime }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
