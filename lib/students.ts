// Server-side helper: batch-fetch student names by record ID.
// Used by routes that return rows linking to a student (alerts, instruction notes).

import { airtable, TABLE } from "@/lib/airtable";
import type { DayOfWeek, RecordId } from "@/types/kumon";

export interface StudentLookup {
  name: string;
  schedule: DayOfWeek[];
  grade: string | null;
}

// Returns a Map keyed by student record ID. Missing IDs are simply absent.
export async function fetchStudentLookups(ids: RecordId[]): Promise<Map<RecordId, StudentLookup>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();

  // Airtable formula: OR(RECORD_ID() = 'rec1', RECORD_ID() = 'rec2', ...)
  const formula = `OR(${unique.map((id) => `RECORD_ID()='${id}'`).join(",")})`;

  const records = await airtable()(TABLE.Students)
    .select({
      filterByFormula: formula,
      fields: ["Student Name", "Schedule", "Grade"]
    })
    .all();

  const out = new Map<RecordId, StudentLookup>();
  for (const r of records) {
    const name = (r.get("Student Name") as string | null) ?? "(unnamed)";
    const schedule = ((r.get("Schedule") as DayOfWeek[] | null) ?? []) as DayOfWeek[];
    const grade = (r.get("Grade") as string | null) ?? null;
    out.set(r.id, { name, schedule, grade });
  }
  return out;
}
