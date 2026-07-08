// Growth engine — powers /api/admin/growth (the "Road to 225" scoreboard).
//
// One enrollment = one subject a currently-active student is doing. A kid doing
// Math + Reading counts as TWO enrollments. The center's goal is 225 enrollments.
// Only "Math" and "Reading" are real subjects; "Schedule"/"Other" tags don't count.
//
// Everything is derived from two reads (Students + POs) and bucketed in JS, so
// there are no fragile Airtable date formulas to drift.

import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, addDays } from "@/lib/time";
import { getActiveRecurringMrr } from "@/lib/invoice-ninja";

export const ENROLLMENT_TARGET = 225;
// Monthly tuition per subject-enrollment, with a flat dual-subject discount:
// 1 subject = $165, 2 subjects = $320 (i.e. $330 - $10). So modeled MRR =
// enrollments * 165 - (dual students * 10).
export const TUITION_PER_ENROLLMENT = 165;
export const DUAL_DISCOUNT = 10;

const ACTIVE_LIFECYCLES = new Set(["Active-Engaged", "Active-At-Risk"]);
const PENDING_START_LIFECYCLES = new Set(["Pending Start", "Pending Start State"]);
const BREAK_LIFECYCLES = new Set(["Planned Break"]);
const REAL_SUBJECTS = new Set(["Math", "Reading"]);

function enrollmentsFromSubjects(subjects: string[]): number {
  const n = subjects.filter((s) => REAL_SUBJECTS.has(s)).length;
  return n;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  // Conversion from the previous stage, 0-100; null for the first stage.
  pctOfPrev: number | null;
}

export interface ChannelRow {
  source: string;
  booked: number;
  attended: number;
  attendRate: number | null; // attended / booked, 0-100
}

export interface GrowthResult {
  target: number;
  enrollments: number;          // active subject-enrollments
  gap: number;                  // target - enrollments (>=0)
  pctToTarget: number;          // 0-100
  studentCount: number;         // distinct active students
  dualCount: number;            // active students doing both subjects
  mrr: number;                  // modeled: enrollments * tuition - dual discount
  targetMrr: number;            // modeled MRR at 225 (same dual ratio)
  billedMonthly: number | null; // actual monthly recurring billings from Invoice Ninja (null if unavailable)
  // Confirmed upcoming starts (Pending Start lifecycle with a Planned Start Date set)
  pendingStartStudents: number;
  pendingStartEnrollments: number; // subject-enrollment count for pending starts
  // Students on a planned break (drag on enrollment count)
  onBreakStudents: number;
  onBreakEnrollments: number;
  // Net flow this calendar month, measured in enrollments.
  startedEnrollments: number;
  discontinuedEnrollments: number;
  netEnrollments: number;
  startedStudents: number;
  discontinuedStudents: number;
  // Months to target at the current monthly net pace; null if net <= 0.
  monthsToTarget: number | null;
  monthLabel: string;           // e.g. "June 2026"
  funnel: FunnelStage[];        // this month's HELD POs (conversion cohort)
  funnelLeak: string | null;    // human-readable biggest-leak note
  upcomingPos: number;          // POs dated later this month, not yet held
  noShowPos: number;            // No-show POs in trailing 90 days — re-engagement lead pool
  channels: ChannelRow[];       // trailing 90 days, by booking source
  generatedAt: string;
}

function monthName(prefix: string): string {
  const [y, m] = prefix.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[Number(m) - 1] ?? ""} ${y}`;
}

export async function computeGrowth(): Promise<GrowthResult> {
  const today = todayInET();
  const monthPrefix = today.slice(0, 7);      // "YYYY-MM"
  const ninetyDaysAgo = addDays(today, -90);

  const [studentRecs, poRecs, billedMonthly] = await Promise.all([
    airtable()(TABLE.Students)
      .select({ fields: ["Lifecycle Stage", "Subjects", "Enroll Date", "End Date", "Planned Start Date"] })
      .all(),
    airtable()(TABLE.POs)
      .select({ fields: ["PO Date", "Status", "Outcome", "Booking Source"] })
      .all(),
    getActiveRecurringMrr()   // fail-soft: null if Invoice Ninja unavailable
  ]);

  // --- Active enrollments (the headline number) ---
  let enrollments = 0;
  let studentCount = 0;
  let dualCount = 0;
  let pendingStartStudents = 0;
  let pendingStartEnrollments = 0;
  let onBreakStudents = 0;
  let onBreakEnrollments = 0;
  let startedEnrollments = 0;
  let startedStudents = 0;
  let discontinuedEnrollments = 0;
  let discontinuedStudents = 0;

  for (const r of studentRecs) {
    const lifecycle = (r.get("Lifecycle Stage") as string | null) ?? "";
    const subjects = ((r.get("Subjects") as string[] | undefined) ?? []);
    const subjEnroll = enrollmentsFromSubjects(subjects);

    if (ACTIVE_LIFECYCLES.has(lifecycle)) {
      studentCount += 1;
      enrollments += subjEnroll;
      if (subjects.includes("Math") && subjects.includes("Reading")) dualCount += 1;
    }

    // Confirmed upcoming starts — Pending Start with a Planned Start Date locked in.
    if (PENDING_START_LIFECYCLES.has(lifecycle)) {
      const plannedStartDate = (r.get("Planned Start Date") as string | null) ?? null;
      if (plannedStartDate) {
        pendingStartStudents += 1;
        pendingStartEnrollments += subjEnroll > 0 ? subjEnroll : 1;
      }
    }

    // Students currently on a planned break — they're paused, not growing.
    if (BREAK_LIFECYCLES.has(lifecycle)) {
      onBreakStudents += 1;
      onBreakEnrollments += subjEnroll > 0 ? subjEnroll : 1;
    }

    const enrollDate = (r.get("Enroll Date") as string | null) ?? null;
    if (enrollDate && enrollDate.slice(0, 7) === monthPrefix) {
      startedStudents += 1;
      startedEnrollments += subjEnroll > 0 ? subjEnroll : 1;
    }

    const endDate = (r.get("End Date") as string | null) ?? null;
    if (endDate && endDate.slice(0, 7) === monthPrefix) {
      discontinuedStudents += 1;
      discontinuedEnrollments += subjEnroll > 0 ? subjEnroll : 1;
    }
  }

  const gap = Math.max(0, ENROLLMENT_TARGET - enrollments);
  const pctToTarget = Math.min(100, Math.round((enrollments / ENROLLMENT_TARGET) * 100));

  // Modeled MRR: list price per enrollment minus the flat dual-subject discount.
  const mrr = enrollments * TUITION_PER_ENROLLMENT - dualCount * DUAL_DISCOUNT;
  // Project the same dual ratio out to 225 so the target MRR isn't overstated.
  const dualAtTarget = enrollments > 0 ? Math.round(dualCount * (ENROLLMENT_TARGET / enrollments)) : 0;
  const targetMrr = ENROLLMENT_TARGET * TUITION_PER_ENROLLMENT - dualAtTarget * DUAL_DISCOUNT;
  const netEnrollments = startedEnrollments - discontinuedEnrollments;
  const monthsToTarget = netEnrollments > 0 ? Math.ceil(gap / netEnrollments) : null;

  // --- Funnel (this calendar month) ---
  // Conversion is measured ONLY on POs that have actually occurred (date on or
  // before today). A future-dated PO hasn't happened yet, so counting it as
  // "not attended" would fake a no-show leak. Upcoming POs are reported separately.
  const monthPos = poRecs.filter((r) => ((r.get("PO Date") as string | null) ?? "").slice(0, 7) === monthPrefix);
  const duePos = monthPos.filter((r) => ((r.get("PO Date") as string | null) ?? "") <= today);
  const upcomingPos = monthPos.length - duePos.length;

  const held = duePos.length;
  const attended = duePos.filter((r) => (r.get("Status") as string | null) === "Attended").length;
  const planEnroll = duePos.filter((r) => {
    const o = (r.get("Outcome") as string | null) ?? "";
    return o === "Plan to Enroll" || o === "Enrolled";
  }).length;

  const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 100) : null);
  const funnel: FunnelStage[] = [
    { key: "held", label: "POs held (to date)", count: held, pctOfPrev: null },
    { key: "attended", label: "Attended", count: attended, pctOfPrev: pct(attended, held) },
    { key: "plan", label: "Plan to enroll", count: planEnroll, pctOfPrev: pct(planEnroll, attended) }
  ];

  // Biggest leak = the stage transition with the lowest conversion (needs a denom).
  // Computed on held POs only, so it reflects real no-shows, not pending appointments.
  let funnelLeak: string | null = null;
  const transitions = [
    { from: "held", to: "attended", rate: pct(attended, held), lost: held - attended, note: "no-shows / cancellations" },
    { from: "attended", to: "plan to enroll", rate: pct(planEnroll, attended), lost: attended - planEnroll, note: "attended but didn't commit" }
  ].filter((t) => t.rate !== null);
  if (transitions.length) {
    const worst = transitions.reduce((a, b) => (a.rate! <= b.rate! ? a : b));
    if (worst.lost > 0) {
      funnelLeak = `Biggest leak is ${worst.from} → ${worst.to} (${worst.rate}%) — ${worst.lost} lost this month to ${worst.note}.`;
    }
  }

  // --- No-show lead pool (trailing 90 days) ---
  // POs that occurred (date <= today) but were not attended — these families showed
  // enough interest to book and are the warmest re-engagement targets.
  const noShowPos = poRecs.filter((r) => {
    const d = (r.get("PO Date") as string | null) ?? "";
    const status = (r.get("Status") as string | null) ?? "";
    return d >= ninetyDaysAgo && d <= today && status === "No Show";
  }).length;

  // --- Channels (trailing 90 days, by booking source) ---
  const recentPos = poRecs.filter((r) => {
    const d = (r.get("PO Date") as string | null) ?? "";
    return d >= ninetyDaysAgo && d <= today;
  });
  const channelMap = new Map<string, { booked: number; attended: number }>();
  for (const r of recentPos) {
    const src = (r.get("Booking Source") as string | null) || "Not captured";
    const row = channelMap.get(src) ?? { booked: 0, attended: 0 };
    row.booked += 1;
    if ((r.get("Status") as string | null) === "Attended") row.attended += 1;
    channelMap.set(src, row);
  }
  const channels: ChannelRow[] = [...channelMap.entries()]
    .map(([source, v]) => ({ source, booked: v.booked, attended: v.attended, attendRate: pct(v.attended, v.booked) }))
    .sort((a, b) => b.booked - a.booked);

  return {
    target: ENROLLMENT_TARGET,
    enrollments,
    gap,
    pctToTarget,
    studentCount,
    dualCount,
    mrr,
    targetMrr,
    billedMonthly,
    pendingStartStudents,
    pendingStartEnrollments,
    onBreakStudents,
    onBreakEnrollments,
    startedEnrollments,
    discontinuedEnrollments,
    netEnrollments,
    startedStudents,
    discontinuedStudents,
    monthsToTarget,
    monthLabel: monthName(monthPrefix),
    funnel,
    funnelLeak,
    upcomingPos,
    noShowPos,
    channels,
    generatedAt: new Date().toISOString()
  };
}
