import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, addDays } from "@/lib/time";
import { getInvoiceForStudent, invoiceNinjaConfigured } from "@/lib/invoice-ninja";

export const dynamic = "force-dynamic";

// GET /api/students/onboarding  (staff-facing, no admin gate)
// One feed for the onboarding journey, in three groups:
//   planned         — committed, First Class Date today-or-future, not yet started
//   pastDue         — committed, First Class Date already passed, not yet started
//   firstMonthWatch — started (Active-Engaged) within the last 45 days, where
//                     "started" = First Class Attended Date OR Enroll Date
//                     (attended is only stamped via the Arrived button, so most
//                     real recent starts only have an Enroll Date).
// First-weeks check-in state for the Recently-started card. Each new student
// gets a 1-week and 4-week touch (logged conversation or drafted update email).
// The button unlocks on the due date and goes red once it's overdue.
export type CheckinState = {
  state: "locked" | "due" | "overdue" | "done" | "moot";
  dueDate: string | null;
  doneDate: string | null;
  method: string | null;
};
function checkinState(started: string | null, doneDate: string | null, method: string | null, offset: number, today: string): CheckinState {
  if (doneDate) return { state: "done", dueDate: started ? addDays(started, offset) : null, doneDate, method };
  if (!started) return { state: "locked", dueDate: null, doneDate: null, method: null };
  const due = addDays(started, offset);
  if (today < due) return { state: "locked", dueDate: due, doneDate: null, method: null };
  if (today <= addDays(due, 3)) return { state: "due", dueDate: due, doneDate: null, method: null };
  return { state: "overdue", dueDate: due, doneDate: null, method: null };
}

type Row = {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  schedule: string[];
  firstClassDate: string | null;
  firstClassAttended: string | null;
  enrollDate: string | null;
  startedDate?: string | null;
  eEnrolled: boolean;
  familyId?: string | null;
  amountDue?: number | null;   // family invoice balance (Invoice Ninja, read-only)
  coveredByFamily?: boolean;   // sibling carries the $; this row is on the same family invoice
  nudged?: boolean;
  nudgeCount?: number;
  nudgedDate?: string | null;
  checklistDone?: number;   // onboarding checklist items complete (mirrors the modal's count)
  checklistTotal?: number;
  week1?: CheckinState;     // recently-started: 1-week check-in
  week4?: CheckinState;     // recently-started: 4-week check-in
};

const OUTBOX = "tblHWXG0SDfUNQc7L";

// Mirror the OnboardingChecklist modal's progress math: 6 recap items + 10 toggles = 16.
function checklistProgress(r: { get: (f: string) => unknown }): { checklistDone: number; checklistTotal: number } {
  const subjects = ((r.get("Subjects") as string[] | undefined) ?? []);
  const hasMath = subjects.includes("Math");
  const hasReading = subjects.includes("Reading");
  const levelsDone = subjects.length > 0 && (!hasMath || !!r.get("Math Level")) && (!hasReading || !!r.get("Reading Level"));
  const recap = [
    subjects.length > 0,
    !!r.get("Grade"),
    levelsDone,
    !!r.get("First Class Date"),
    ((r.get("Schedule") as string[] | undefined) ?? []).length > 0,
    !!r.get("Work Pickup Day")
  ];
  const toggles = [
    "Folder Made", "Name Label Made", "Worksheets Pulled", "Pouch Ready",
    "Invoice Account Created", "First Invoice Sent", "Recurring Invoice Set", "First Invoice Paid",
    "eEnrollment Completed", "KSIS Enrolled"
  ].map((f) => Boolean(r.get(f)));
  const all = [...recap, ...toggles];
  return { checklistDone: all.filter(Boolean).length, checklistTotal: all.length };
}

export async function GET() {
  try {
    const today = todayInET();
    const cutoff45 = addDays(today, -45);

    const [committedRecs, watchRecs, nudgeRecs] = await Promise.all([
      airtable()(TABLE.Students)
        .select({
          // Committed but not yet started, with a planned first-class date.
          // Two committed stages: "Pending Start" (recapped Plan to Enroll, not yet
          // eEnrolled) and "Pending Start State" (eEnrolled). Include both.
          filterByFormula: `AND(OR({Lifecycle Stage}='Pending Start', {Lifecycle Stage}='Pending Start State'), {First Class Date}, NOT({First Class Attended Date}))`,
          fields: ["Student Name", "First Name", "Grade", "Subjects", "First Class Date", "eEnrollment Completed", "Family",
            "Schedule", "Work Pickup Day", "Math Level", "Reading Level",
            "Folder Made", "Name Label Made", "Worksheets Pulled", "Pouch Ready",
            "Invoice Account Created", "First Invoice Sent", "Recurring Invoice Set", "First Invoice Paid", "KSIS Enrolled"]
        })
        .all(),
      airtable()(TABLE.Students)
        .select({
          // Started within the last 45 days — recently-started watch.
          // "Started" = either the first class was marked attended OR they have an
          // Enroll Date in window. Most recent starts only have an Enroll Date,
          // since First Class Attended Date is only stamped by the Arrived button.
          filterByFormula: `AND({Lifecycle Stage}='Active-Engaged', OR(AND({First Class Attended Date}, IS_AFTER({First Class Attended Date}, '${cutoff45}')), AND({Enroll Date}, IS_AFTER({Enroll Date}, '${cutoff45}'))))`,
          fields: ["Student Name", "First Name", "Grade", "Subjects", "Schedule", "First Class Attended Date", "Enroll Date", "eEnrollment Completed",
            "Week 1 Check-In Date", "Week 1 Check-In Method", "Week 4 Check-In Date", "Week 4 Check-In Method"]
        })
        .all(),
      // Students already queued for / sent a missed-start nudge (so the card
      // can show a "nudged" tag and not look like outreach hasn't happened).
      airtable()(OUTBOX)
        .select({
          filterByFormula: `AND({Job Type}='Missed-Start Check-In', NOT({Status}='Skipped'))`,
          fields: ["Students", "Drafted At"]
        })
        .all()
    ]);

    // Per student: how many nudges have gone out and the latest nudge date,
    // so the card can show "nudged ×2 · 6/10" and drive the escalation ladder.
    const nudgeInfo = new Map<string, { count: number; last: string | null }>();
    for (const r of nudgeRecs) {
      const date = (r.get("Drafted At") as string | null) ?? null;
      for (const sid of ((r.get("Students") as string[] | undefined) ?? [])) {
        const cur = nudgeInfo.get(sid) ?? { count: 0, last: null };
        cur.count += 1;
        if (date && (!cur.last || date > cur.last)) cur.last = date;
        nudgeInfo.set(sid, cur);
      }
    }

    const mapRow = (r: { id: string; get: (f: string) => unknown }): Row => ({
      id: r.id,
      name: (r.get("Student Name") as string | null) ?? (r.get("First Name") as string | null) ?? "(student)",
      grade: (r.get("Grade") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | undefined) ?? []) as string[],
      schedule: ((r.get("Schedule") as string[] | undefined) ?? []) as string[],
      firstClassDate: (r.get("First Class Date") as string | null) ?? null,
      firstClassAttended: (r.get("First Class Attended Date") as string | null) ?? null,
      enrollDate: (r.get("Enroll Date") as string | null) ?? null,
      eEnrolled: Boolean(r.get("eEnrollment Completed")),
      familyId: ((r.get("Family") as string[] | undefined) ?? [])[0] ?? null
    });

    const committed = committedRecs.map(mapRow);

    // Onboarding checklist progress per committed kid (drives the button fill).
    const progressById = new Map<string, { checklistDone: number; checklistTotal: number }>();
    for (const r of committedRecs) progressById.set(r.id, checklistProgress(r));

    // Family invoice amount (Invoice Ninja, read-only) per committed kid. One
    // invoice per FAMILY, so siblings share the same number — labeled as such.
    const amountById = new Map<string, number | null>();
    if (invoiceNinjaConfigured() && committed.length > 0) {
      const famIds = Array.from(new Set(committed.map((c) => c.familyId).filter(Boolean) as string[]));
      const famEmails = new Map<string, string[]>();
      if (famIds.length > 0) {
        const fams = await airtable()(TABLE.Families).select({
          filterByFormula: `OR(${famIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: ["Mother Email", "Father Email", "Other Contact Email"]
        }).all();
        for (const f of fams) {
          famEmails.set(f.id, [
            f.get("Mother Email") as string | null,
            f.get("Father Email") as string | null,
            f.get("Other Contact Email") as string | null
          ].filter(Boolean) as string[]);
        }
      }
      await Promise.all(committed.map(async (c) => {
        const emails = c.familyId ? (famEmails.get(c.familyId) ?? []) : [];
        if (emails.length === 0) { amountById.set(c.id, null); return; }
        try {
          const inv = await getInvoiceForStudent(c.name, emails);
          amountById.set(c.id, inv.found && inv.amount != null ? (inv.balance ?? inv.amount) : null);
        } catch { amountById.set(c.id, null); }
      }));
    }

    // One invoice per family: show the $ on a single sibling; mark the rest
    // "on family invoice" so staff never read it as charged twice.
    const familyShown = new Set<string>();
    const displayAmount = new Map<string, { amountDue: number | null; coveredByFamily?: boolean }>();
    for (const s of [...committed].sort((a, b) => a.name.localeCompare(b.name))) {
      const amt = amountById.get(s.id) ?? null;
      if (amt == null) { displayAmount.set(s.id, { amountDue: null }); continue; }
      if (s.familyId && familyShown.has(s.familyId)) { displayAmount.set(s.id, { amountDue: null, coveredByFamily: true }); continue; }
      if (s.familyId) familyShown.add(s.familyId);
      displayAmount.set(s.id, { amountDue: amt });
    }
    const planned = committed
      .filter((s) => s.firstClassDate && s.firstClassDate >= today)
      .map((s) => ({ ...s, ...displayAmount.get(s.id), ...progressById.get(s.id) }))
      .sort((a, b) => (a.firstClassDate ?? "").localeCompare(b.firstClassDate ?? ""));
    const pastDue = committed
      .filter((s) => s.firstClassDate && s.firstClassDate < today)
      .map((s) => {
        const n = nudgeInfo.get(s.id);
        return { ...s, ...displayAmount.get(s.id), ...progressById.get(s.id), nudged: !!n, nudgeCount: n?.count ?? 0, nudgedDate: n?.last ?? null };
      })
      .sort((a, b) => (a.firstClassDate ?? "").localeCompare(b.firstClassDate ?? ""));
    // Check-in completion per watched kid (drives the 1-week / 4-week buttons).
    const checkinByIdW = new Map<string, { w1d: string | null; w1m: string | null; w4d: string | null; w4m: string | null }>();
    for (const r of watchRecs) {
      checkinByIdW.set(r.id, {
        w1d: (r.get("Week 1 Check-In Date") as string | null) ?? null,
        w1m: (r.get("Week 1 Check-In Method") as string | null) ?? null,
        w4d: (r.get("Week 4 Check-In Date") as string | null) ?? null,
        w4m: (r.get("Week 4 Check-In Method") as string | null) ?? null
      });
    }
    const firstMonthWatch = watchRecs
      .map(mapRow)
      .map((s) => {
        const started = s.firstClassAttended ?? s.enrollDate ?? null;
        const c = checkinByIdW.get(s.id);
        const week1 = checkinState(started, c?.w1d ?? null, c?.w1m ?? null, 7, today);
        const week4 = checkinState(started, c?.w4d ?? null, c?.w4m ?? null, 28, today);
        // If the 4-week is already done but the 1-week never happened, the 1-week
        // is moot -- we're not going back to do it. Drop it from red to gray.
        if (week4.state === "done" && (week1.state === "overdue" || week1.state === "due")) {
          week1.state = "moot";
        }
        return { ...s, startedDate: started, week1, week4 };
      })
      // Once both touch-points are handled (done or moot), remove from the list.
      .filter((s) => !(
        (s.week1.state === "done" || s.week1.state === "moot") &&
        s.week4.state === "done"
      ))
      .sort((a, b) => (b.startedDate ?? "").localeCompare(a.startedDate ?? ""));

    return NextResponse.json({ ok: true, data: { planned, pastDue, firstMonthWatch } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
