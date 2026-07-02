import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// PATCH /api/admin/student-change-requests/[id]
// Marks a change request complete. In a single round-trip we also:
//   - Record which external systems Adam ticked off (Completed Systems).
//   - Optionally update the linked Student record's Lifecycle Stage / Status /
//     End Date so the outreach engine picks the student up correctly.
//
// completedBy is a free-text string from the live Staff dropdown (e.g.
// "Adam Lent"). External systems and lifecycle stage strings are also
// free-text and rely on Airtable's typecast to map onto the existing options.
const Body = z.object({
  completedBy: z.string().trim().min(1, "completedBy required"),
  completionNotes: z.string().max(2000).optional(),
  completedSystems: z.array(z.string()).optional(),
  // Linked-student updates. All optional — if omitted, student is untouched.
  // Status is no longer writable here; it's derived from Lifecycle Stage via
  // an Airtable formula. Only Lifecycle and End Date are mutable.
  newLifecycleStage: z.string().nullable().optional(),
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    const today = todayInET();

    // 1. Update the change request row.
    const requestFields: Partial<FieldSet> = {
      Status: "Completed",
      "Completed By": parsed.data.completedBy,
      "Completed At": today,
      "Completion Notes": parsed.data.completionNotes?.trim() ?? ""
    };
    if (parsed.data.completedSystems !== undefined) {
      requestFields["Completed Systems"] = parsed.data.completedSystems;
    }
    const updated = await airtable()(TABLE.StudentChangeRequests).update(
      [{ id: params.id, fields: requestFields }],
      { typecast: true }
    );

    // 2. If any student-level updates were sent, patch the linked Student.
    const wantsStudentUpdate =
      parsed.data.newLifecycleStage !== undefined
      || parsed.data.newEndDate !== undefined;

    let studentUpdated: string | null = null;
    if (wantsStudentUpdate) {
      const req = await airtable()(TABLE.StudentChangeRequests).find(params.id);
      const studentLinks = (req.get("Student") as string[] | undefined) ?? [];
      const studentId = studentLinks[0];
      if (!studentId) {
        return NextResponse.json(
          { ok: false, error: "Change request has no linked student to update." },
          { status: 400 }
        );
      }
      const studentFields: Partial<FieldSet> = {};
      if (parsed.data.newLifecycleStage !== undefined && parsed.data.newLifecycleStage !== null) {
        studentFields["Lifecycle Stage"] = parsed.data.newLifecycleStage;
      }
      if (parsed.data.newEndDate !== undefined) {
        studentFields["End Date"] = parsed.data.newEndDate ?? "";
      }
      if (Object.keys(studentFields).length > 0) {
        await airtable()(TABLE.Students).update(
          [{ id: studentId, fields: studentFields }],
          { typecast: true }
        );
        studentUpdated = studentId;
      }
    }

    return NextResponse.json({
      ok: true,
      data: { id: updated[0].id, studentUpdated }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[PATCH change-request] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
