import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// POST /api/students/[id]/checkin
// Records a first-weeks check-in (1-week or 4-week) for a recently-started kid.
// Either logs a face-to-face conversation (Communications row) or queues a
// touch-base "Routine Check-In" update email for the overnight drafter — then
// stamps the completion date + method on the student so the dashboard button
// flips to done.
const Body = z.object({
  which: z.enum(["w1", "w4"]),
  method: z.enum(["conversation", "email"]),
  note: z.string().max(2000).optional()
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const studentId = params.id;
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { which, method, note } = parsed.data;
    const today = todayInET();
    const label = which === "w1" ? "1-week" : "4-week";

    const student = await airtable()(TABLE.Students).find(studentId);
    const familyLinks = (student.get("Family") as string[] | undefined) ?? [];
    const studentName = (student.get("Student Name") as string | null) ?? "Student";

    if (method === "conversation") {
      // Log the in-person touch as a Communications row (the reconciliation sweep
      // also sees it). Last Contact Date is stamped directly below so the check-in
      // counts as contact immediately, not on the next batch run.
      await airtable()(TABLE.Communications).create([{
        fields: {
          Date: today,
          Type: "In Person",
          Direction: "Outbound",
          Status: "Sent",
          Subject: `${label} check-in — ${studentName}`,
          Notes: note?.trim() ?? "",
          Students: [studentId],
          ...(familyLinks.length ? { Family: familyLinks } : {})
        }
      }], { typecast: true });
    } else {
      // Queue a touch-base update email for the overnight drafter.
      await airtable()(TABLE.UpdateEmailRequests).create([{
        fields: {
          Student: [studentId],
          "Request Date": today,
          Status: "Pending",
          "Email Type": "Routine Check-In",
          "Notable in Class": note?.trim()
            ? note.trim()
            : `${label} check-in — touch base with the family: ask how the first weeks are going and whether they have any questions, and share tips on building a daily routine, supporting their child, and looking over completed work to make sure it's getting done.`
        }
      }], { typecast: true });
    }

    // Stamp completion so the dashboard button shows done — AND stamp Last Contact
    // directly so the check-in counts as communication right away and the student
    // drops off the outreach "needs contact" list immediately (not on a batch run).
    const dateField = which === "w1" ? "Week 1 Check-In Date" : "Week 4 Check-In Date";
    const methodField = which === "w1" ? "Week 1 Check-In Method" : "Week 4 Check-In Method";
    await airtable()(TABLE.Students).update([{
      id: studentId,
      fields: {
        [dateField]: today,
        [methodField]: method === "conversation" ? "Conversation" : "Email",
        "Last Contact Date": today,
        "Last Contact Type": method === "conversation" ? "In Person" : "Other"
      }
    }], { typecast: true });

    return NextResponse.json({ ok: true, data: { which, method } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
