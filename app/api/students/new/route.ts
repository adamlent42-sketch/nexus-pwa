import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, daysBetween } from "@/lib/time";
import type { NewStudentRow, NewStudentsGroups, ApiResponse } from "@/types/kumon";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayInET();

    // Broad filter: anyone with a recent Enroll Date OR any Planned Start Date.
    const filterByFormula = `OR(
      AND({Enroll Date}, IS_AFTER({Enroll Date}, DATEADD(TODAY(), -31, 'days'))),
      {Planned Start Date}
    )`;

    const records = await airtable()(TABLE.Students)
      .select({
        filterByFormula,
        fields: [
          "Student Name",
          "Grade",
          "Subjects",
          "Lifecycle Stage",
          "Planned Start Date",
          "Enroll Date",
          "30 Day Vision",
          "GPS Priorities"
        ]
      })
      .all();

    const startingToday: NewStudentRow[] = [];
    const plannedThisWeek: NewStudentRow[] = [];
    const firstMonthWatch: NewStudentRow[] = [];

    for (const r of records) {
      const enrollDate = (r.get("Enroll Date") as string | null) ?? null;
      const plannedArr = ((r.get("Planned Start Date") as string[] | null) ?? []) as string[];
      const plannedStartDate = plannedArr[0] ?? null;

      const row: NewStudentRow = {
        id: r.id,
        name: (r.get("Student Name") as string | null) ?? "(unnamed)",
        grade: (r.get("Grade") as string | null) ?? null,
        subjects: ((r.get("Subjects") as string[] | null) ?? []) as string[],
        plannedStartDate,
        enrollDate,
        weekOfWatch: null,
        thirtyDayVision: (r.get("30 Day Vision") as string | null) ?? null,
        gpsPriorities: ((r.get("GPS Priorities") as string[] | null) ?? []) as string[]
      };

      // Effective start = when the student actually starts class. The Planned
      // Start Date is the source of truth whenever it's set (past OR future);
      // Enroll Date (eEnrollment form completion) is only a fallback. Filling
      // out the eEnrollment form is NOT the same as starting class - a student
      // can complete it weeks before their planned first day.
      const startDate = plannedStartDate ?? enrollDate;
      if (!startDate) continue;

      if (startDate === today) {
        startingToday.push(row);
      } else if (startDate > today) {
        const daysUntil = daysBetween(today, startDate);
        if (daysUntil > 0 && daysUntil <= 30) {
          plannedThisWeek.push(row);
        }
      } else {
        // startDate < today - student has already started; keep on the
        // first-month watch for 30 days from their real start date.
        const daysSinceStart = daysBetween(startDate, today);
        if (daysSinceStart > 0 && daysSinceStart <= 30) {
          row.weekOfWatch = Math.min(4, Math.floor(daysSinceStart / 7) + 1);
          firstMonthWatch.push(row);
        }
      }
    }

    startingToday.sort((a, b) => a.name.localeCompare(b.name));
    plannedThisWeek.sort((a, b) => (a.plannedStartDate ?? "").localeCompare(b.plannedStartDate ?? ""));
    firstMonthWatch.sort((a, b) => (a.weekOfWatch ?? 5) - (b.weekOfWatch ?? 5));

    const data: NewStudentsGroups = { startingToday, plannedThisWeek, firstMonthWatch };
    const body: ApiResponse<NewStudentsGroups> = { ok: true, data };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
