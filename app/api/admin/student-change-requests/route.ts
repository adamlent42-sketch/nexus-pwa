import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export interface ChangeRequestRow {
  id: string;
  title: string;
  type: string | null;
  studentId: string | null;
  studentName: string | null;
  studentStatus: string | null;
  studentLifecycle: string | null;
  studentEndDate: string | null;
  effectiveDate: string | null;
  reason: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  status: string | null;
  completedBy: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  externalSystems: string[];
  completedSystems: string[];
  ksisCompletedByStaff: boolean;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const records = await airtable()(TABLE.StudentChangeRequests)
      .select({
        fields: [
          "Request Title", "Student", "Type", "Effective Date",
          "Reason / Notes", "Submitted By", "Status",
          "Completed By", "Completed At", "Completion Notes",
          "External Systems", "Completed Systems", "KSIS Completed by Staff"
        ]
      })
      .all();

    const rows: ChangeRequestRow[] = records.map((r) => {
      const studentLinks = (r.get("Student") as string[] | undefined) ?? [];
      return {
        id: r.id,
        title: (r.get("Request Title") as string | null) ?? "(untitled)",
        type: (r.get("Type") as string | null) ?? null,
        studentId: studentLinks[0] ?? null,
        studentName: null,
        studentStatus: null,
        studentLifecycle: null,
        studentEndDate: null,
        effectiveDate: (r.get("Effective Date") as string | null) ?? null,
        reason: (r.get("Reason / Notes") as string | null) ?? null,
        submittedBy: (r.get("Submitted By") as string | null) ?? null,
        submittedAt: r._rawJson?.createdTime ?? null,
        status: (r.get("Status") as string | null) ?? null,
        completedBy: (r.get("Completed By") as string | null) ?? null,
        completedAt: (r.get("Completed At") as string | null) ?? null,
        completionNotes: (r.get("Completion Notes") as string | null) ?? null,
        externalSystems: ((r.get("External Systems") as string[] | undefined) ?? []),
        completedSystems: ((r.get("Completed Systems") as string[] | undefined) ?? []),
        ksisCompletedByStaff: Boolean(r.get("KSIS Completed by Staff"))
      };
    });

    // Sort newest first (by Airtable created time)
    rows.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

    // Bulk-fetch the linked student records so the modal can show the current
    // lifecycle/status/end-date and pre-populate the lifecycle picker.
    const studentIds = Array.from(new Set(rows.map((r) => r.studentId).filter(Boolean) as string[]));
    if (studentIds.length > 0) {
      const studentRecs = await airtable()(TABLE.Students)
        .select({
          fields: ["Student Name", "Status", "Lifecycle Stage", "End Date"],
          filterByFormula: `OR(${studentIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`
        })
        .all();
      const byId = new Map(studentRecs.map((s) => [s.id, s]));
      for (const r of rows) {
        if (!r.studentId) continue;
        const s = byId.get(r.studentId);
        if (!s) continue;
        r.studentName = (s.get("Student Name") as string | null) ?? null;
        r.studentStatus = (s.get("Status") as string | null) ?? null;
        r.studentLifecycle = (s.get("Lifecycle Stage") as string | null) ?? null;
        r.studentEndDate = (s.get("End Date") as string | null) ?? null;
      }
    }

    return NextResponse.json({ ok: true, data: rows });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
