import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Lifecycle stages that mean "this family is actively enrolling and not yet a
// running student." Legacy records use "Pending Start State"; newer lifecycle
// moves (see lib/po-lifecycle.ts) use "Pending Start". A student who has become
// Active-Engaged is done onboarding and must NOT appear in this queue — that's
// what was flooding the list with already-active kids.
const ENROLLING_STAGES = ["Pending Start", "Pending Start State"];

// A family is "stalled" (needs a call) when they planned to enroll but have no
// committed start date AND haven't been in contact for this many days. These
// silently rot otherwise — no automation chases a Pending Start with no start
// date, so the onboarding queue flags them for a phone call.
const STALL_DAYS = 7;

// GET /api/admin/onboarding
// The post-PO enrollment onboarding queue: every PO whose family is actively
// enrolling (Outcome = Plan to Enroll or Enrolled, linked student still in an
// enrolling lifecycle stage) that has NOT yet been activated in KSIS.
// Once "Enrolled in KSIS" is checked, the PO drops off this queue — the digital
// equivalent of filing away the green folder sleeve.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    // 1) Students currently in an enrolling lifecycle stage, with how long since
    //    we last contacted them (drives the stalled-call flag).
    const enrollingStudents = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `OR(${ENROLLING_STAGES.map((s) => `{Lifecycle Stage}='${s}'`).join(",")})`,
        fields: ["Lifecycle Stage", "Days Since Last Contact"]
      })
      .all();
    // Map studentId -> days since last contact (null = never contacted / unknown).
    const daysMap = new Map<string, number | null>();
    for (const r of enrollingStudents) {
      const d = r.get("Days Since Last Contact");
      daysMap.set(r.id, typeof d === "number" ? d : null);
    }

    // 2) Enrolling POs not yet activated in KSIS.
    const records = await airtable()(TABLE.POs)
      .select({
        filterByFormula: `AND(
          OR({Outcome}='Plan to Enroll', {Outcome}='Enrolled'),
          NOT({Enrolled in KSIS})
        )`,
        sort: [{ field: "Planned Start Date", direction: "asc" }],
        fields: [
          "Student Display", "Grade", "PO Date", "Students",
          "Subject Interest", "Parent Phone", "Outcome",
          "Planned Start Date", "Planned Class Time", "Planned Schedule",
          "eEnrollment Form Completed",
          "Invoice Sent", "Recurring Invoice Set Up", "Plastic Folder Made",
          "Books Pulled", "First Invoice Paid", "Enrolled in KSIS"
        ]
      })
      .all();

    const data = records
      .filter((r) => {
        // Keep only POs linked to a student who is still in an enrolling stage.
        const studentIds = (r.get("Students") as string[] | undefined) ?? [];
        return studentIds.some((id) => daysMap.has(id));
      })
      .map((r) => {
        const plannedStartDate = (r.get("Planned Start Date") as string | null) ?? null;
        const plannedSchedule = (r.get("Planned Schedule") as string[] | undefined) ?? [];
        const startDateSet = Boolean(plannedStartDate);

        // Days since last contact across the linked enrolling students.
        const studentIds = (r.get("Students") as string[] | undefined) ?? [];
        const linkedVals = studentIds.filter((id) => daysMap.has(id)).map((id) => daysMap.get(id) ?? null);
        const hasNeverContacted = linkedVals.some((v) => v === null);
        const known = linkedVals.filter((v): v is number => typeof v === "number");
        const daysSinceContact = hasNeverContacted ? null : known.length ? Math.min(...known) : null;
        // Stalled: planned to enroll, no start date locked, and gone quiet.
        const stalled = !startDateSet && (daysSinceContact === null || daysSinceContact >= STALL_DAYS);

        return {
          id: r.id,
          student: (r.get("Student Display") as string | null) ?? "(unnamed)",
          grade: (r.get("Grade") as string | null) ?? null,
          poDate: (r.get("PO Date") as string | null) ?? null,
          subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []),
          phone: (r.get("Parent Phone") as string | null) ?? null,
          outcome: (r.get("Outcome") as string | null) ?? null,
          plannedStartDate,
          plannedClassTime: (r.get("Planned Class Time") as string | null) ?? null,
          plannedSchedule,
          daysSinceContact,
          stalled,
          // Derived steps — reflect data already captured on the PO.
          startDateSet,
          scheduleSet: plannedSchedule.length > 0,
          // Toggleable steps.
          eEnrollmentCompleted: Boolean(r.get("eEnrollment Form Completed")),
          invoiceSent: Boolean(r.get("Invoice Sent")),
          recurringInvoiceSetUp: Boolean(r.get("Recurring Invoice Set Up")),
          plasticFolderMade: Boolean(r.get("Plastic Folder Made")),
          booksPulled: Boolean(r.get("Books Pulled")),
          firstInvoicePaid: Boolean(r.get("First Invoice Paid")),
          enrolledInKsis: Boolean(r.get("Enrolled in KSIS"))
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
