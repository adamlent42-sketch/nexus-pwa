import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/closures/prep-plan
// For each upcoming closure that lands on a pickup day (Tue/Thu/Sat),
// compute the prep plan: the prior pickup-day date when affected families
// should be handed extra worksheets, the number of weeks of work to provide,
// and the list of students whose pickup day matches.
//
// Consecutive same-pickup-day closures (e.g. two Saturdays in Winter Break)
// are grouped together so one prep date covers them all and the worksheet
// count rolls up: weeksOfWork = run.length + 1.
//
// "Affected" here = students with that pickup day who are still Current
// (status filter). We don't try to detect students who switched pickup days
// recently — for that, Adam should reload after editing the student profile.

interface PrepStudent {
  id: string;
  name: string;
  grade: string | null;
  schedule: string[];
}

interface PrepPlan {
  prepDate: string;          // YYYY-MM-DD — the pickup day to hand out extra work
  pickupDay: string;         // "Tuesday" | "Thursday" | "Saturday"
  weeksOfWork: number;       // closures.length + 1
  closures: { date: string; reason: string | null }[];
  students: PrepStudent[];
}

const DOW_NAME: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday"
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = ymd(new Date());

    // 1. Pull all upcoming closures.
    const closureRecords = await airtable()(TABLE.Closures)
      .select({
        fields: ["Date", "Reason"],
        filterByFormula: `IS_AFTER({Date}, DATEADD('${today}', -1, 'days'))`,
        sort: [{ field: "Date", direction: "asc" }]
      })
      .all();

    const closures = closureRecords
      .map((r) => ({
        date: (r.get("Date") as string | null) ?? "",
        reason: (r.get("Reason") as string | null) ?? null
      }))
      .filter((c) => !!c.date);

    if (closures.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    // 2. Pull all currently-enrolled students with their pickup day.
    // The Airtable field is "Work Pickup Day" (not "Pickup Day").
    const studentRecords = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `{Status} = 'Current'`,
        fields: ["Student Name", "Grade", "Work Pickup Day", "Schedule"]
      })
      .all();

    const studentsByPickupDay = new Map<string, PrepStudent[]>();
    for (const r of studentRecords) {
      const pickup = r.get("Work Pickup Day") as string | null;
      if (!pickup) continue;
      const s: PrepStudent = {
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(unnamed)",
        grade: (r.get("Grade") as string | null) ?? null,
        schedule: ((r.get("Schedule") as string[] | undefined) ?? []) as string[]
      };
      const arr = studentsByPickupDay.get(pickup) ?? [];
      arr.push(s);
      studentsByPickupDay.set(pickup, arr);
    }

    // 3. For each pickup day, find closures that fall on it and group consecutive runs.
    const PICKUP_DAYS = ["Tuesday", "Thursday", "Saturday"] as const;
    const plans: PrepPlan[] = [];

    for (const pickupDay of PICKUP_DAYS) {
      const hits = closures.filter((c) => DOW_NAME[parseYmd(c.date).getDay()] === pickupDay);
      if (hits.length === 0) continue;

      // Group consecutive (gap exactly 7 days). Each group becomes one plan.
      const groups: typeof hits[] = [];
      for (const h of hits) {
        const last = groups[groups.length - 1];
        if (last && parseYmd(h.date).getTime() - parseYmd(last[last.length - 1].date).getTime() === 7 * 86400 * 1000) {
          last.push(h);
        } else {
          groups.push([h]);
        }
      }

      for (const group of groups) {
        const firstClosure = parseYmd(group[0].date);
        const prepDate = ymd(addDays(firstClosure, -7));
        const students = (studentsByPickupDay.get(pickupDay) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
        plans.push({
          prepDate,
          pickupDay,
          weeksOfWork: group.length + 1,
          closures: group.map((g) => ({ date: g.date, reason: g.reason })),
          students
        });
      }
    }

    // Sort all plans by prep date ascending.
    plans.sort((a, b) => a.prepDate.localeCompare(b.prepDate));

    return NextResponse.json({ ok: true, data: plans });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET prep-plan] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to compute prep plan";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
