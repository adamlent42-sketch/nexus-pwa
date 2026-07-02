// Shared outreach engine. Powers both /api/admin/outreach (the command center)
// and the outreach item on /api/admin/attention (the What-needs-you hub).
//
// One cadence model for the whole student lifecycle. Every tracked student maps
// to a "lane" (Retention / Pipeline / Recovery / Reactivation) and gets an
// on-cadence state from a single rule:
//   - Retention (active kids): driven by the Comm Queue Status formula, which
//     already encodes the retention check-in cadence.
//   - Every other lane: Days Since Last Contact vs the stage's Reach Out Every
//     cadence (from the Outreach Cadences table, surfaced as a lookup on Students).
//
// Historical (the ~408 Yunhee quarterly pool) and No Interest are intentionally
// excluded -- they're handled by the separate quarterly campaign and shouldn't
// flood a daily who-needs-contact worklist.

import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export type LaneKey = "retention" | "pipeline" | "recovery" | "reactivation";
export type OutreachState = "overdue" | "due-soon" | "on-track" | "no-contact";

export interface LaneDef {
  key: LaneKey;
  label: string;
  blurb: string;
  lifecycles: string[];
}

// Lane definitions. Order = display order (front of funnel risk -> win-back).
export const LANES: LaneDef[] = [
  {
    key: "retention",
    label: "Retention",
    blurb: "Keep current families engaged",
    lifecycles: ["Active-Engaged", "Active-At-Risk"]
  },
  {
    key: "pipeline",
    label: "Pipeline",
    blurb: "Protect momentum to first class",
    lifecycles: ["PO Booked", "Pending Start", "Pending Start State"]
  },
  {
    key: "recovery",
    label: "Recovery",
    blurb: "Didn't convert yet -- win them in",
    lifecycles: ["PO No-Show", "PO Cancelled", "PO Attended - Did Not Enroll"]
  },
  {
    key: "reactivation",
    label: "Reactivation",
    blurb: "Win back former families",
    lifecycles: ["Recently Discontinued", "Reactivation Target", "Long Lapsed"]
  }
];

const LIFECYCLE_TO_LANE = new Map<string, LaneKey>();
for (const lane of LANES) for (const lc of lane.lifecycles) LIFECYCLE_TO_LANE.set(lc, lane.key);

export interface OutreachStudent {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  lifecycle: string;
  lane: LaneKey;
  laneLabel: string;
  lastContactDate: string | null;
  lastContactType: string | null;
  daysSinceLastContact: number | null;
  reachOutEvery: number | null;
  state: OutreachState;
  overdueBy: number | null;     // days past cadence; null when unknown
  commQueueStatus: string | null;
  snoozeUntil: string | null;
  snoozed: boolean;
  pendingUpdateRequest: boolean;
}

export interface LaneSummary {
  key: LaneKey;
  label: string;
  blurb: string;
  total: number;
  onTrack: number;   // on-track + due-soon (contacted within / approaching window)
  overdue: number;
  dueSoon: number;
  noContact: number;
  percentOnCadence: number | null;  // onTrack / (onTrack + overdue)
}

export interface OutreachResult {
  lanes: LaneSummary[];
  overall: { total: number; onTrack: number; overdue: number; percentOnCadence: number | null };
  students: OutreachStudent[];      // full set, every tracked student
  worklist: OutreachStudent[];      // needs-contact subset (overdue / due-soon / no-contact, not snoozed)
}

function cadenceClassify(days: number | null, cadence: number | null): { state: OutreachState; overdueBy: number | null } {
  if (days === null) return { state: "no-contact", overdueBy: null };
  if (!cadence || cadence <= 0) return { state: "on-track", overdueBy: null };
  const overdueBy = days - cadence;
  if (overdueBy > 0) return { state: "overdue", overdueBy };
  if (days >= Math.ceil(cadence * 0.8)) return { state: "due-soon", overdueBy };
  return { state: "on-track", overdueBy };
}

function classify(
  lane: LaneKey,
  commQueueStatus: string | null,
  days: number | null,
  cadence: number | null
): { state: OutreachState; overdueBy: number | null } {
  if (lane === "retention") {
    const s = commQueueStatus ?? "";
    if (s.includes("Past Due")) return { state: "overdue", overdueBy: cadence && days !== null ? days - cadence : days };
    if (s.includes("Coming Due")) return { state: "due-soon", overdueBy: cadence && days !== null ? days - cadence : null };
    if (s.includes("No contact")) return { state: "no-contact", overdueBy: null };
    if (s.includes("Current")) return { state: "on-track", overdueBy: cadence && days !== null ? days - cadence : null };
    return cadenceClassify(days, cadence);
  }
  return cadenceClassify(days, cadence);
}

const STATE_RANK: Record<OutreachState, number> = { overdue: 0, "no-contact": 1, "due-soon": 2, "on-track": 3 };

export async function computeOutreach(): Promise<OutreachResult> {
  const today = todayInET();
  const lifecycles = LANES.flatMap((l) => l.lifecycles);
  const orClause = lifecycles.map((lc) => `{Lifecycle Stage}='${lc}'`).join(", ");

  const [records, pendingRequests, dncFamilies] = await Promise.all([
    airtable()(TABLE.Students)
      .select({
        filterByFormula: `OR(${orClause})`,
        fields: [
          "Student Name", "Grade", "Subjects", "Schedule", "Math Level", "Reading Level",
          "Lifecycle Stage", "Last Contact Date", "Last Contact Type", "Days Since Last Contact",
          "Reach Out Every (lookup)", "Comm Queue Status", "Snooze Until", "Family"
        ]
      })
      .all(),
    airtable()(TABLE.UpdateEmailRequests)
      .select({ filterByFormula: `{Status}='Pending'`, fields: ["Student"] })
      .all(),
    // Families that opted out — their students are excluded from outreach entirely
    // (DNC is intent, not just deliverability; bouncing families still show so you can call).
    airtable()(TABLE.Families)
      .select({ filterByFormula: `{Do Not Contact}=TRUE()`, fields: [] })
      .all()
  ]);

  const dncFamilyIds = new Set(dncFamilies.map((f) => f.id));

  const pendingStudentIds = new Set<string>();
  for (const r of pendingRequests) {
    for (const id of ((r.get("Student") as string[] | undefined) ?? [])) pendingStudentIds.add(id);
  }

  // Drop students whose linked Family is flagged Do Not Contact — they never
  // appear in any lane, count, or worklist.
  const visibleRecords = records.filter((r) => {
    const fam = (r.get("Family") as string[] | undefined) ?? [];
    return !fam.some((fid) => dncFamilyIds.has(fid));
  });

  const students: OutreachStudent[] = visibleRecords.map((r) => {
    const lifecycle = (r.get("Lifecycle Stage") as string | null) ?? "";
    const lane = LIFECYCLE_TO_LANE.get(lifecycle) ?? "reactivation";
    const laneDef = LANES.find((l) => l.key === lane)!;

    const reachLookup = r.get("Reach Out Every (lookup)") as (number | string)[] | undefined;
    const reachOutEvery = Array.isArray(reachLookup) && reachLookup.length > 0 ? Number(reachLookup[0]) || 0 : null;

    const daysRaw = r.get("Days Since Last Contact");
    const days = typeof daysRaw === "number" ? daysRaw : daysRaw ? Number(daysRaw) : null;

    const commQueueStatus = (r.get("Comm Queue Status") as string | null) ?? null;
    const snoozeUntil = (r.get("Snooze Until") as string | null) ?? null;
    const snoozed = !!snoozeUntil && snoozeUntil >= today;

    const { state, overdueBy } = classify(lane, commQueueStatus, days, reachOutEvery);

    return {
      id: r.id,
      name: (r.get("Student Name") as string | null) ?? "(unnamed)",
      grade: (r.get("Grade") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | undefined) ?? []),
      schedule: ((r.get("Schedule") as string[] | undefined) ?? []),
      mathLevel: (r.get("Math Level") as string | null) ?? null,
      readingLevel: (r.get("Reading Level") as string | null) ?? null,
      lifecycle,
      lane,
      laneLabel: laneDef.label,
      lastContactDate: (r.get("Last Contact Date") as string | null) ?? null,
      lastContactType: (r.get("Last Contact Type") as string | null) ?? null,
      daysSinceLastContact: days,
      reachOutEvery,
      state,
      overdueBy,
      commQueueStatus,
      snoozeUntil,
      snoozed,
      pendingUpdateRequest: pendingStudentIds.has(r.id)
    };
  });

  // Per-lane summaries.
  const lanes: LaneSummary[] = LANES.map((def) => {
    const list = students.filter((s) => s.lane === def.key);
    const overdue = list.filter((s) => s.state === "overdue").length;
    const dueSoon = list.filter((s) => s.state === "due-soon").length;
    const noContact = list.filter((s) => s.state === "no-contact").length;
    const onTrackPure = list.filter((s) => s.state === "on-track").length;
    const onTrack = onTrackPure + dueSoon;       // not-yet-overdue
    const trackable = onTrack + overdue;
    return {
      key: def.key,
      label: def.label,
      blurb: def.blurb,
      total: list.length,
      onTrack,
      overdue,
      dueSoon,
      noContact,
      percentOnCadence: trackable > 0 ? Math.round((onTrack / trackable) * 100) : null
    };
  });

  const overallTotalTrackable = lanes.reduce((a, l) => a + l.onTrack + l.overdue, 0);
  const overallOnTrack = lanes.reduce((a, l) => a + l.onTrack, 0);
  const overallOverdue = lanes.reduce((a, l) => a + l.overdue, 0);
  const overall = {
    total: students.length,
    onTrack: overallOnTrack,
    overdue: overallOverdue,
    percentOnCadence: overallTotalTrackable > 0 ? Math.round((overallOnTrack / overallTotalTrackable) * 100) : null
  };

  // Worklist: who needs contact now. Overdue -> no-contact -> due-soon, hide snoozed.
  const worklist = students
    .filter((s) => !s.snoozed && s.state !== "on-track")
    .sort((a, b) => {
      const ra = STATE_RANK[a.state], rb = STATE_RANK[b.state];
      if (ra !== rb) return ra - rb;
      const oa = a.overdueBy ?? a.daysSinceLastContact ?? -Infinity;
      const ob = b.overdueBy ?? b.daysSinceLastContact ?? -Infinity;
      if (oa !== ob) return ob - oa;
      return a.name.localeCompare(b.name);
    });

  return { lanes, overall, students, worklist };
}
