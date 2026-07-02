import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { CHANGE_REQUEST_TYPES } from "@/lib/options";
import { todayInET, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

// POST /api/student-change-requests
// Logs a Student Change Request row for audit and (where applicable) KSIS / Invoice Ninja follow-up.
// All change types are now logged so Adam has a full audit trail of who changed what and when.

const Body = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  type: z.enum(CHANGE_REQUEST_TYPES),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(2000).optional(),
  submittedBy: z.string().min(1),
  ksisCompletedByStaff: z.boolean().optional(),
  // Break-specific fields (only used when type = "Pause / Break")
  breakStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedReturn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// Which external systems each change type touches.
function externalSystemsFor(type: string): string[] {
  switch (type) {
    case "Pickup Day Change":  return ["KSIS"];
    case "Pause / Break":      return ["Invoice Ninja"];
    case "Stop Enrollment":    return ["KSIS", "Invoice Ninja"];
    case "Restart Enrollment": return ["KSIS", "Invoice Ninja"];
    // Edit Details, Schedule Change, Other → no external system follow-up needed
    default:                   return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const {
      studentId, studentName, type, effectiveDate, reason, submittedBy,
      ksisCompletedByStaff, breakStart, expectedReturn, followUpDate
    } = parsed.data;

    const title = `${type} — ${studentName} (${effectiveDate})`;
    let externalSystems = externalSystemsFor(type);
    if (ksisCompletedByStaff) {
      externalSystems = externalSystems.filter((s) => s !== "KSIS");
    }

    // Build notes: for break requests, append the dates so the log is self-contained.
    let notes = reason?.trim() ?? "";
    if (type === "Pause / Break") {
      const parts = [
        breakStart     ? `Break start: ${breakStart}`       : null,
        expectedReturn ? `Expected return: ${expectedReturn}` : null,
        followUpDate   ? `Follow-up date: ${followUpDate}`   : null
      ].filter(Boolean);
      if (parts.length) notes = [notes, parts.join(" · ")].filter(Boolean).join("\n");
    }

    await airtable()(TABLE.StudentChangeRequests).create(
      [
        {
          fields: {
            "Request Title": title,
            Student: [studentId],
            Type: type,
            "Effective Date": effectiveDate,
            "Reason / Notes": notes,
            "Submitted By": submittedBy,
            "KSIS Completed by Staff": Boolean(ksisCompletedByStaff),
            "External Systems": externalSystems,
            // All changes go into the review queue as Pending so Adam can see and acknowledge them.
            Status: "Pending"
          }
        }
      ],
      { typecast: true }
    );

    // Apply student record changes where needed.
    const studentFields: Partial<FieldSet> = {};

    if (type === "Stop Enrollment") {
      studentFields["Lifecycle Stage"] = "Recently Discontinued";
      studentFields["End Date"] = effectiveDate;
    } else if (type === "Pause / Break") {
      // Set lifecycle + break dates immediately so the break-reminder cron can fire.
      studentFields["Lifecycle Stage"] = "Planned Break";
      studentFields["Snooze Until"] = addDays(effectiveDate, 60);
      if (breakStart)     studentFields["Hold Start"]     = breakStart;
      if (expectedReturn) studentFields["Planned Return"] = expectedReturn;
      if (followUpDate)   studentFields["Break Checkin"]  = followUpDate;
    } else if (type === "Restart Enrollment") {
      studentFields["Lifecycle Stage"] = "Active-Engaged";
      studentFields["Enroll Date"] = effectiveDate;
      studentFields["Snooze Until"] = undefined;
      studentFields["End Date"] = undefined;
    }

    if (Object.keys(studentFields).length > 0) {
      await airtable()(TABLE.Students).update(
        [{ id: studentId, fields: studentFields }],
        { typecast: true }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        title,
        submittedAt: todayInET(),
        studentUpdated: Object.keys(studentFields).length > 0,
        externalSystems
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
