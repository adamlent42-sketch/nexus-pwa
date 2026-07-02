import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// POST /api/admin/log-conversation
// Records a non-email touch (face-to-face conversation, phone call) for a
// student by writing a Communications row. This resets the student's
// Last Contact Date rollup so the outreach cadence picks up the most
// recent conversation.
const Body = z.object({
  studentId: z.string().min(1),
  type: z.enum(["In Person", "Phone Call"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional()
});

export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { studentId, type, date, notes } = parsed.data;

    // Cap the date at today so staff can't backdate to the future.
    const today = todayInET();
    const effectiveDate = date > today ? today : date;

    // Fetch the student to find the linked family for proper rollup.
    const student = await airtable()(TABLE.Students).find(studentId);
    const familyLinks = (student.get("Family") as string[] | undefined) ?? [];

    const created = await airtable()(TABLE.Communications).create([
      {
        fields: {
          Date: effectiveDate,
          Type: type,
          Direction: "Outbound",
          Status: "Sent",
          Subject: type === "In Person"
            ? "Face-to-face conversation"
            : "Phone conversation",
          Notes: notes?.trim() ?? "",
          Students: [studentId],
          ...(familyLinks.length ? { Family: familyLinks } : {})
        }
      }
    ], { typecast: true });

    return NextResponse.json({
      ok: true,
      data: { id: created[0]?.id ?? null, date: effectiveDate, type }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
