import { airtable, TABLE } from "@/lib/airtable";

// Shared "students missing required data" computation, used by both the
// /api/admin/students-missing-data view and the admin command center count.
// Required-by-stage (per Adam):
//   Lead    → a deliverable parent email (DOB not required — historic, unknown)
//   Pending → Subjects, Grade, class Schedule, First Class Date, a Level per subject
//   Active  → Subjects, Grade, class Schedule, Work Pickup Day, a Level per subject
// Other stages (lapsed / discontinued / etc.) are not checked.

const LEAD = new Set(["Lead", "PO Booked", "Attended PO", "PO Attended - Did Not Enroll", "PO No-Show", "PO Cancelled"]);
const PENDING = new Set(["Pending Start", "Pending Start State"]);
const ACTIVE = new Set(["Active-Engaged", "Active-At-Risk"]);

const has = (v: unknown) => {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== "";
};

export interface MissingRow {
  id: string;
  name: string;
  stage: string;
  bucket: string;
  missing: string[];
}

export async function computeMissingData(): Promise<{ count: number; rows: MissingRow[] }> {
  const students = await airtable()(TABLE.Students)
    .select({
      fields: ["Student Name", "Lifecycle Stage", "Subjects", "Grade", "Schedule", "Work Pickup Day",
        "Math Level", "Reading Level", "First Class Date", "DOB", "Family"]
    })
    .all();

  // For Lead-stage students we need to know if the family has a deliverable email.
  const leadFamilyIds = new Set<string>();
  for (const s of students) {
    const stage = (s.get("Lifecycle Stage") as string | null) ?? "";
    if (LEAD.has(stage)) {
      for (const fid of ((s.get("Family") as string[] | undefined) ?? [])) leadFamilyIds.add(fid);
    }
  }
  const familyHasEmail = new Map<string, boolean>();
  if (leadFamilyIds.size > 0) {
    const ids = Array.from(leadFamilyIds);
    const fams = await airtable()(TABLE.Families)
      .select({
        filterByFormula: `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
        fields: ["Mother Email", "Mother Email Bouncing", "Father Email", "Father Email Bouncing", "Other Contact Email", "Other Email Bouncing"]
      })
      .all();
    for (const f of fams) {
      const ok =
        (has(f.get("Mother Email")) && !f.get("Mother Email Bouncing")) ||
        (has(f.get("Father Email")) && !f.get("Father Email Bouncing")) ||
        (has(f.get("Other Contact Email")) && !f.get("Other Email Bouncing"));
      familyHasEmail.set(f.id, ok);
    }
  }

  const rows: MissingRow[] = [];
  for (const s of students) {
    const stage = (s.get("Lifecycle Stage") as string | null) ?? "";
    const subjects = ((s.get("Subjects") as string[] | undefined) ?? []) as string[];
    const hasMath = subjects.includes("Math");
    const hasReading = subjects.includes("Reading");
    const missing: string[] = [];
    let bucket = "";

    if (LEAD.has(stage)) {
      bucket = "Lead";
      const famIds = ((s.get("Family") as string[] | undefined) ?? []) as string[];
      const emailOk = famIds.some((fid) => familyHasEmail.get(fid));
      if (!emailOk) missing.push("Parent email");
    } else if (PENDING.has(stage)) {
      bucket = "Pending start";
      if (!has(subjects)) missing.push("Subjects");
      if (!has(s.get("Grade"))) missing.push("Grade");
      if (!has(s.get("Schedule"))) missing.push("Class days");
      if (!has(s.get("First Class Date"))) missing.push("First class date");
      if (hasMath && !has(s.get("Math Level"))) missing.push("Math starting level");
      if (hasReading && !has(s.get("Reading Level"))) missing.push("Reading starting level");
    } else if (ACTIVE.has(stage)) {
      bucket = "Active";
      if (!has(subjects)) missing.push("Subjects");
      if (!has(s.get("Grade"))) missing.push("Grade");
      if (!has(s.get("Schedule"))) missing.push("Class days");
      if (!has(s.get("Work Pickup Day"))) missing.push("Pickup day");
      if (hasMath && !has(s.get("Math Level"))) missing.push("Math level");
      if (hasReading && !has(s.get("Reading Level"))) missing.push("Reading level");
    } else {
      continue;
    }

    if (missing.length > 0) {
      rows.push({ id: s.id, name: (s.get("Student Name") as string | null) ?? "(student)", stage, bucket, missing });
    }
  }

  const order: Record<string, number> = { Active: 0, "Pending start": 1, Lead: 2 };
  rows.sort((a, b) => (order[a.bucket] - order[b.bucket]) || a.name.localeCompare(b.name));
  return { count: rows.length, rows };
}
