import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE, ATTENDANCE_FIELD } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// PATCH /api/admin/checkin/observation
// Adds an observation to an open (or recently closed) attendance session.
export async function PATCH(req: NextRequest) {
  try {
    requireAdminPass(req);

    const body = await req.json() as {
      attendanceId?: string;
      completion?: string;
      focus?: string;
      progress?: string;
      notes?: string;
      flagCallParent?: boolean;
      flagAddInstructionNote?: boolean;
      addedBy?: string;
    };

    const { attendanceId, completion, focus, progress, notes,
      flagCallParent, flagAddInstructionNote, addedBy } = body;

    if (!attendanceId) {
      return NextResponse.json({ ok: false, error: "attendanceId is required" }, { status: 400 });
    }

    const fields: Record<string, string | number | boolean | undefined> = {};
    if (completion) fields[ATTENDANCE_FIELD.ObservationCompletion] = completion;
    if (focus) fields[ATTENDANCE_FIELD.ObservationFocus] = focus;
    if (progress) fields[ATTENDANCE_FIELD.ObservationProgress] = progress;
    if (notes) fields[ATTENDANCE_FIELD.ObservationNotes] = notes;
    if (typeof flagCallParent === "boolean") fields[ATTENDANCE_FIELD.FlagCallParent] = flagCallParent;
    if (typeof flagAddInstructionNote === "boolean") fields[ATTENDANCE_FIELD.FlagAddInstructionNote] = flagAddInstructionNote;
    if (addedBy) fields[ATTENDANCE_FIELD.ObservationAddedBy] = addedBy;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    await airtable()(TABLE.AttendanceLog).update(attendanceId, fields);

    return NextResponse.json({ ok: true, data: { id: attendanceId } });

  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
