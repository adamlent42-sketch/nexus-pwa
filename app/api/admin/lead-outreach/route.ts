import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/lead-outreach
// Lead follow-up metric: for every non-active lifecycle stage, returns the
// student count and the % of those students who've been contacted within the
// cadence target for that stage (Outreach Cadences.Reach Out Every).
//
// Excludes Active-Engaged + Active-At-Risk students (those live on the
// existing /admin/student-outreach Active tab) and students in lifecycles
// not in the outreach program (Active-Engaged, No Interest — cadence = 0).
//
// The point: drive towards ~100% on-cadence for every lead-stage bucket.

interface LeadStudent {
  id: string;
  name: string;
  grade: string | null;
  lifecycle: string;
  lastContactDate: string | null;
  lastContactType: string | null;
  daysSinceLastContact: number | null;
  reachOutEvery: number;
  onTrack: boolean | null;        // null when reachOutEvery=0 (not tracked)
  pendingUpdateRequest: boolean;
}

interface LifecycleSummary {
  lifecycle: string;
  cadenceDays: number;
  inProgram: boolean;
  total: number;
  onTrack: number;
  offTrack: number;
  noContact: number;
  percentOnTrack: number | null;  // null when not tracked
  students: LeadStudent[];
}

// Lifecycles that the existing /student-outreach Active tab covers — skip here.
const ACTIVE_LIFECYCLES = new Set(["Active-Engaged", "Active-At-Risk"]);

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const [records, pendingRequests] = await Promise.all([
      airtable()(TABLE.Students)
        .select({
          // Pull everyone NOT in the active buckets. We still filter out junk
          // (records with no lifecycle stage) below in JS.
          filterByFormula: `AND(
            {Lifecycle Stage} != 'Active-Engaged',
            {Lifecycle Stage} != 'Active-At-Risk',
            {Lifecycle Stage} != ''
          )`,
          fields: [
            "Student Name", "Grade", "Lifecycle Stage",
            "Last Contact Date", "Last Contact Type", "Days Since Last Contact",
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

    const students: LeadStudent[] = records.map((r) => {
      const lifecycle = (r.get("Lifecycle Stage") as string | null) ?? "";
      const reachOutLookup = r.get("Reach Out Every (lookup)") as (number | string)[] | undefined;
      const reachOutEvery = Array.isArray(reachOutLookup) && reachOutLookup.length > 0
        ? Number(reachOutLookup[0]) || 0
        : 0;
      const daysRaw = r.get("Days Since Last Contact");
      const days = typeof daysRaw === "number" ? daysRaw : daysRaw ? Number(daysRaw) : null;
      const lastContactDate = (r.get("Last Contact Date") as string | null) ?? null;
      // onTrack is null when the lifecycle isn't tracked, or when we have no
      // contact date on file at all (can't decide "fresh" vs "never").
      let onTrack: boolean | null = null;
      if (reachOutEvery > 0 && lastContactDate && days !== null) {
        onTrack = days <= reachOutEvery;
      }
      return {
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(unnamed)",
        grade: (r.get("Grade") as string | null) ?? null,
        lifecycle,
        lastContactDate,
        lastContactType: (r.get("Last Contact Type") as string | null) ?? null,
        daysSinceLastContact: days,
        reachOutEvery,
        onTrack,
        pendingUpdateRequest: pendingStudentIds.has(r.id)
      };
    }).filter((s) => ACTIVE_LIFECYCLES.has(s.lifecycle) === false);

    // Bucket by lifecycle.
    const buckets = new Map<string, LeadStudent[]>();
    for (const s of students) {
      const arr = buckets.get(s.lifecycle) ?? [];
      arr.push(s);
      buckets.set(s.lifecycle, arr);
    }

    const summaries: LifecycleSummary[] = [];
    for (const [lifecycle, list] of buckets) {
      const cadenceDays = list[0]?.reachOutEvery ?? 0;
      const inProgram = cadenceDays > 0;
      const noContact = list.filter((s) => s.lastContactDate === null).length;
      const onTrackCount = list.filter((s) => s.onTrack === true).length;
      const offTrackCount = list.filter((s) => s.onTrack === false).length;
      const trackable = onTrackCount + offTrackCount;
      const percentOnTrack = inProgram && trackable > 0
        ? Math.round((onTrackCount / trackable) * 100)
        : null;
      summaries.push({
        lifecycle,
        cadenceDays,
        inProgram,
        total: list.length,
        onTrack: onTrackCount,
        offTrack: offTrackCount,
        noContact,
        percentOnTrack,
        students: list.slice().sort((a, b) => {
          // off-track first, then no contact, then on-track. Within each
          // group: oldest contact first.
          const rank = (s: LeadStudent) => s.onTrack === false ? 0 : s.lastContactDate === null ? 1 : 2;
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
          const da = a.daysSinceLastContact ?? Number.MAX_SAFE_INTEGER;
          const db = b.daysSinceLastContact ?? Number.MAX_SAFE_INTEGER;
          if (da !== db) return db - da;
          return a.name.localeCompare(b.name);
        })
      });
    }

    // Sort summaries: in-program buckets first (by tightest cadence), then out-of-program.
    summaries.sort((a, b) => {
      if (a.inProgram !== b.inProgram) return a.inProgram ? -1 : 1;
      if (a.cadenceDays !== b.cadenceDays) return a.cadenceDays - b.cadenceDays;
      return a.lifecycle.localeCompare(b.lifecycle);
    });

    // Overall metric across IN-PROGRAM lifecycles only.
    let overallTotal = 0, overallOnTrack = 0;
    for (const s of summaries) {
      if (!s.inProgram) continue;
      overallTotal += s.onTrack + s.offTrack;
      overallOnTrack += s.onTrack;
    }
    const overallPercent = overallTotal > 0
      ? Math.round((overallOnTrack / overallTotal) * 100)
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        summaries,
        overall: { total: overallTotal, onTrack: overallOnTrack, percentOnTrack: overallPercent }
      }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET lead-outreach] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load lead outreach";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
