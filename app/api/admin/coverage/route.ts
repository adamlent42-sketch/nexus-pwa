import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, addDays, dayNameET } from "@/lib/time";

export const dynamic = "force-dynamic";

const CLASS_DAYS = new Set(["Monday", "Tuesday", "Thursday", "Saturday"]);
const LEAD_ROLES = new Set(["OL", "CL"]);

export interface CoverageClassStaff {
  name: string;
  roles: string[];
  isLead: boolean;
  available: boolean;
  reason: string | null; // "out" | "departed" | null
}
export interface CoverageClass {
  date: string;
  weekday: string;
  staff: CoverageClassStaff[];
  leads: number;
  helpers: number;
  demand: { students: number; handsOn: number; independent: number };
}

const HANDS_ON = new Set(["7A", "6A", "5A", "4A", "3A", "2A"]);

// GET /api/admin/coverage?count=16
// The next N actual class sessions (Mon/Tue/Thu/Sat, skipping closures), each with
// the staff scheduled that day and whether they're available on THAT specific date
// (out on approved/pending time off, or already past their Working Through date).
export async function GET(req: NextRequest) {
  try {
    const count = Math.min(40, Math.max(1, parseInt(req.nextUrl.searchParams.get("count") || "16", 10)));
    const today = todayInET();

    const staffRecs = await airtable()(TABLE.Staff)
      .select({ fields: ["Staff Name", "Primary Roles", "Status", "Working Through"] })
      .all();
    const staffById = new Map<string, { name: string; primaryRoles: string[]; status: string | null; workingThrough: string | null }>();
    for (const r of staffRecs) {
      staffById.set(r.id, {
        name: (r.get("Staff Name") as string | null) ?? "(staff)",
        primaryRoles: ((r.get("Primary Roles") as string[] | null) ?? []),
        status: (r.get("Status") as string | null) ?? null,
        workingThrough: (r.get("Working Through") as string | null) ?? null
      });
    }

    const closeRecs = await airtable()(TABLE.Closures).select({ fields: ["Date"] }).all();
    const closed = new Set<string>();
    for (const r of closeRecs) { const d = r.get("Date") as string | null; if (d) closed.add(d); }

    // Non-denied time off ending today or later.
    const toRecs = await airtable()(TABLE.TimeOff)
      .select({
        filterByFormula: `AND({Start Date}, {Status}!='Denied', IS_AFTER(DATEADD({Effective End Date}, 1, 'days'), '${today}'))`,
        fields: ["Staff", "Start Date", "Effective End Date"]
      })
      .all();
    const outRanges = new Map<string, { start: string; end: string }[]>();
    for (const r of toRecs) {
      const id = ((r.get("Staff") as string[] | undefined) ?? [])[0];
      if (!id) continue;
      const start = (r.get("Start Date") as string | null) ?? "";
      if (!start) continue;
      const end = (r.get("Effective End Date") as string | null) ?? start;
      const arr = outRanges.get(id) ?? [];
      arr.push({ start, end });
      outRanges.set(id, arr);
    }

    const wsRecs = await airtable()(TABLE.WeeklySchedule).select({ fields: ["Staff", "Day of Week", "Role", "Specific Date"] }).all();
    const recurring = new Map<string, { id: string; roles: string[] }[]>();
    const specific = new Map<string, { id: string; roles: string[] }[]>();
    for (const r of wsRecs) {
      const roles = ((r.get("Role") as string[] | null) ?? []);
      if (roles.length > 0 && roles.every((x) => x === "Prep AM")) continue;
      const id = ((r.get("Staff") as string[] | undefined) ?? [])[0];
      if (!id) continue;
      const sd = (r.get("Specific Date") as string | null) ?? null;
      if (sd) { const a = specific.get(sd) ?? []; a.push({ id, roles }); specific.set(sd, a); continue; }
      const dow = (r.get("Day of Week") as string | null) ?? "";
      if (!CLASS_DAYS.has(dow)) continue;
      const a = recurring.get(dow) ?? []; a.push({ id, roles }); recurring.set(dow, a);
    }

    // Weighted demand per weekday from active students' levels (early learners = hands-on).
    const demandByDay: Record<string, { students: number; handsOn: number; independent: number }> = {
      Monday: { students: 0, handsOn: 0, independent: 0 },
      Tuesday: { students: 0, handsOn: 0, independent: 0 },
      Thursday: { students: 0, handsOn: 0, independent: 0 },
      Saturday: { students: 0, handsOn: 0, independent: 0 }
    };
    const stuRecs = await airtable()(TABLE.Students)
      .select({ filterByFormula: `OR({Lifecycle Stage}='Active-Engaged',{Lifecycle Stage}='Active-At-Risk')`, fields: ["Schedule", "Math Level", "Reading Level"] })
      .all();
    // Count by subject-SESSION, not by kid: a student doing both subjects generates two
    // sessions per visit (the "there for an hour" kids). Each session is either a hands-on
    // sitting (early-learner level) or an independent session (needs check-ins + grading).
    for (const r of stuRecs) {
      const sched = ((r.get("Schedule") as string[] | null) ?? []);
      const ml = ((r.get("Math Level") as string | null) ?? "").trim().toUpperCase();
      const rl = ((r.get("Reading Level") as string | null) ?? "").trim().toUpperCase();
      const doesMath = ml !== "";
      const doesReading = rl !== "";
      for (const d of sched) {
        if (!demandByDay[d]) continue;
        demandByDay[d].students++;
        if (doesMath) { if (HANDS_ON.has(ml)) demandByDay[d].handsOn++; else demandByDay[d].independent++; }
        if (doesReading) { if (HANDS_ON.has(rl)) demandByDay[d].handsOn++; else demandByDay[d].independent++; }
      }
    }

    const classes: CoverageClass[] = [];
    let cur = today, guard = 0;
    while (classes.length < count && guard < 160) {
      const wd = dayNameET(cur);
      if (CLASS_DAYS.has(wd) && !closed.has(cur)) {
        const rows = [...(recurring.get(wd) ?? []), ...(specific.get(cur) ?? [])];
        const seen = new Set<string>();
        const staff: CoverageClassStaff[] = [];
        for (const row of rows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          const info = staffById.get(row.id);
          if (!info || info.status === "Departed") continue;
          const isLead = row.roles.some((x) => LEAD_ROLES.has(x)) || info.primaryRoles.some((x) => LEAD_ROLES.has(x));
          let available = true, reason: string | null = null;
          if (info.status === "Departing" && info.workingThrough && info.workingThrough < cur) { available = false; reason = "departed"; }
          if (available) {
            const ranges = outRanges.get(row.id) ?? [];
            if (ranges.some((g) => cur >= g.start && cur <= g.end)) { available = false; reason = "out"; }
          }
          staff.push({ name: info.name, roles: row.roles, isLead, available, reason });
        }
        staff.sort((a, b) => (a.isLead === b.isLead ? a.name.localeCompare(b.name) : a.isLead ? -1 : 1));
        classes.push({
          date: cur,
          weekday: wd,
          staff,
          leads: staff.filter((s) => s.isLead && s.available).length,
          helpers: staff.filter((s) => !s.isLead && s.available).length,
          demand: demandByDay[wd] ?? { students: 0, handsOn: 0, independent: 0 }
        });
      }
      cur = addDays(cur, 1);
      guard++;
    }

    return NextResponse.json({ ok: true, data: { today, classes } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
