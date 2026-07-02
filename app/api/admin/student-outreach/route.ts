import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export interface StudentOutreachRow {
  id: string;
  name: string;
  grade: string | null;
  lifecycleStage: string | null;
  subjects: string[];
  schedule: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  lastContactDate: string | null;
  lastContactType: string | null;
  daysSinceLastContact: number | null;
  commQueueStatus: string | null;
  outreachPriority: string | null;
  snoozeUntil: string | null;
  reachOutEvery: number | null;
  pendingUpdateRequest: boolean;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();

    const [records, pendingRequests] = await Promise.all([
      airtable()(TABLE.Students)
        .select({
          // Belt + suspenders: must be Status=Current AND lifecycle stage of an
          // actively-enrolled kid. Catches mismatches where a student's lifecycle
          // is stale but their Status has been moved to Recently Discontinued.
          filterByFormula: `AND(
            {Status}='Current',
            OR({Lifecycle Stage}='Active-Engaged', {Lifecycle Stage}='Active-At-Risk')
          )`,
          fields: [
            "Student Name", "Grade", "Lifecycle Stage",
            "Subjects", "Schedule", "Math Level", "Reading Level",
            "Last Contact Date", "Last Contact Type", "Days Since Last Contact",
            "Comm Queue Status", "Outreach Priority", "Snooze Until",
            "Reach Out Every (lookup)"
          ]
        })
        .all(),
      airtable()(TABLE.UpdateEmailRequests)
        .select({
          filterByFormula: `{Status}='Pending'`,
          fields: ["Student"]
        })
        .all()
    ]);

    const pendingStudentIds = new Set<string>();
    for (const r of pendingRequests) {
      const links = (r.get("Student") as string[] | undefined) ?? [];
      for (const id of links) pendingStudentIds.add(id);
    }

    const rows: StudentOutreachRow[] = records.map((r) => {
      const reachOutLookup = r.get("Reach Out Every (lookup)") as (number | string)[] | undefined;
      const reachOutEvery = Array.isArray(reachOutLookup) && reachOutLookup.length > 0
        ? Number(reachOutLookup[0])
        : null;
      const daysRaw = r.get("Days Since Last Contact");
      const days = typeof daysRaw === "number" ? daysRaw : daysRaw ? Number(daysRaw) : null;
      return {
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(unnamed)",
        grade: (r.get("Grade") as string | null) ?? null,
        lifecycleStage: (r.get("Lifecycle Stage") as string | null) ?? null,
        subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
        schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
        mathLevel: (r.get("Math Level") as string | null) ?? null,
        readingLevel: (r.get("Reading Level") as string | null) ?? null,
        lastContactDate: (r.get("Last Contact Date") as string | null) ?? null,
        lastContactType: (r.get("Last Contact Type") as string | null) ?? null,
        daysSinceLastContact: days,
        commQueueStatus: (r.get("Comm Queue Status") as string | null) ?? null,
        outreachPriority: (r.get("Outreach Priority") as string | null) ?? null,
        snoozeUntil: (r.get("Snooze Until") as string | null) ?? null,
        reachOutEvery: Number.isFinite(reachOutEvery as number) ? (reachOutEvery as number) : null,
        pendingUpdateRequest: pendingStudentIds.has(r.id)
      };
    });

    const bucketOrder = (s: string | null): number => {
      if (!s) return 4;
      if (s.includes("Past Due")) return 0;
      if (s.includes("Coming Due")) return 1;
      if (s.includes("No contact yet")) return 2;
      if (s.includes("Current")) return 3;
      return 4;
    };
    rows.sort((a, b) => {
      const ab = bucketOrder(a.commQueueStatus);
      const bb = bucketOrder(b.commQueueStatus);
      if (ab !== bb) return ab - bb;
      const ad = a.daysSinceLastContact ?? -1;
      const bd = b.daysSinceLastContact ?? -1;
      if (ad !== bd) return bd - ad;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ ok: true, data: rows, meta: { today } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
