import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// POST /api/po-tool/create-walkin
// Creates Airtable records for a walk-in so the normal recap/onboarding workflow
// can pick it up: links or creates a Family, creates the Student, and creates a PO
// (Status = Attended, Outcome = Plan to Enroll) linked to both, pre-filled with the
// placement and planned schedule from the PO tool.
const Body = z.object({
  famId: z.string().optional(),
  parent: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  child: z.string().min(1, "Child name is required"),
  grade: z.string().optional(),
  subject: z.enum(["math", "reading", "both"]),
  mathLevel: z.string().optional(),
  readingLevel: z.string().optional(),
  schedule: z.array(z.string()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classTime: z.string().optional()
});

const DAY: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

// Map free-text grade to a valid Students.Grade single-select option.
function gradeChoice(s?: string): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (/(pk|pre-?k)\s*1/.test(t)) return "PK1";
  if (/(pk|pre-?k)\s*2/.test(t)) return "PK2";
  if (/pre/.test(t)) return "PreK";
  if (/^k|kinder/.test(t)) return "K";
  const m = t.match(/1[0-3]|[1-9]/);
  return m ? m[0] : null;
}

function splitName(name: string): { first: string; last: string } {
  const p = name.trim().split(/\s+/);
  return { first: p[0] || "", last: p.slice(1).join(" ") };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    const d = parsed.data;
    const base = airtable();
    const subjects = d.subject === "both" ? ["Math", "Reading"] : d.subject === "reading" ? ["Reading"] : ["Math"];
    const child = splitName(d.child);
    const parent = splitName(d.parent || "");

    // 1) Family — link existing or create new.
    let familyId = d.famId;
    let familyCreated = false;
    if (!familyId) {
      const famName = parent.last || child.last || (d.parent || d.child).trim();
      const ff: Partial<FieldSet> = { "Family Name": famName };
      if (parent.first) ff["Mother First Name"] = parent.first;
      if (parent.last) ff["Mother Last Name"] = parent.last;
      if (d.email) ff["Mother Email"] = d.email;
      if (d.phone) ff["Mother Phone"] = d.phone;
      const fam = await base(TABLE.Families).create([{ fields: ff }], { typecast: true });
      familyId = fam[0].id;
      familyCreated = true;
    }

    // 2) Student.
    const sf: Partial<FieldSet> = {
      "Student Name": d.child.trim(),
      Subjects: subjects,
      "Lifecycle Stage": "Attended PO",
      Family: [familyId]
    };
    if (child.first) sf["First Name"] = child.first;
    if (child.last) sf["Last Name"] = child.last;
    const g = gradeChoice(d.grade);
    if (g) sf.Grade = g;
    if (d.subject !== "reading" && d.mathLevel) sf["Math Level"] = d.mathLevel;
    if (d.subject !== "math" && d.readingLevel) sf["Reading Level"] = d.readingLevel;
    const stu = await base(TABLE.Students).create([{ fields: sf }], { typecast: true });
    const studentId = stu[0].id;

    // 3) PO — linked to the family and student, pre-filled for the recap.
    const pf: Partial<FieldSet> = {
      "PO Date": todayInET(),
      Status: "Attended",
      Outcome: "Plan to Enroll",
      "Lead Source": "Walk-in",
      "Subject Interest": subjects,
      Family: [familyId],
      Students: [studentId]
    };
    if (d.grade) pf.Grade = d.grade.trim();
    if (d.subject !== "reading" && d.mathLevel) pf["Recommended Math Starting Level"] = d.mathLevel;
    if (d.subject !== "math" && d.readingLevel) pf["Recommended Reading Starting Level"] = d.readingLevel;
    if (d.schedule && d.schedule.length) pf["Planned Schedule"] = d.schedule.map((x) => DAY[x] ?? x);
    if (d.startDate) pf["Planned Start Date"] = d.startDate;
    if (d.classTime) pf["Planned Class Time"] = d.classTime;
    const po = await base(TABLE.POs).create([{ fields: pf }], { typecast: true });

    return NextResponse.json({ ok: true, data: { poId: po[0].id, familyId, studentId, familyCreated } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
