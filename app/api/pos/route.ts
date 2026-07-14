import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// POST /api/pos
// Creates a Family + Student(s) + PO in one shot for a walk-in / phone
// booking. Each piece can be either:
//   - existing: pass the record ID (familyId, students[i].studentId)
//   - new: pass new* fields and the row is created in the right order
// before being linked into the PO.
const NewStudent = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  grade: z.string().optional(),
  subjects: z.array(z.enum(["Math", "Reading"])).default([])
});

const StudentRef = z.union([
  z.object({ studentId: z.string().min(1) }),
  z.object({ newStudent: NewStudent })
]);

const NewFamily = z.object({
  familyName: z.string().min(1),
  motherFirstName: z.string().optional(),
  motherLastName: z.string().optional(),
  motherEmail: z.string().email().optional().or(z.literal("")),
  motherPhone: z.string().optional(),
  fatherFirstName: z.string().optional(),
  fatherLastName: z.string().optional(),
  fatherEmail: z.string().email().optional().or(z.literal("")),
  fatherPhone: z.string().optional()
});

const Body = z.object({
  familyId: z.string().optional(),
  newFamily: NewFamily.optional(),
  students: z.array(StudentRef).min(1),
  poDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  poTime: z.string().min(1),
  bookingSource: z.enum(["Online Scheduler", "Kumon CEC", "Instructor", "Re-engagement", "Other"]),
  parentPhone: z.string().optional(),
  subjectInterest: z.array(z.enum(["Math", "Reading"])).default([])
}).refine((b) => b.familyId || b.newFamily, {
  message: "Either familyId or newFamily must be provided"
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // 1. Family — create if new.
    let familyId = data.familyId;
    if (!familyId && data.newFamily) {
      const f = data.newFamily;
      const familyFields: Partial<FieldSet> = {
        "Family Name": f.familyName,
        ...(f.motherFirstName ? { "Mother First Name": f.motherFirstName } : {}),
        ...(f.motherLastName ? { "Mother Last Name": f.motherLastName } : {}),
        ...(f.motherEmail ? { "Mother Email": f.motherEmail } : {}),
        ...(f.motherPhone ? { "Mother Phone": f.motherPhone } : {}),
        ...(f.fatherFirstName ? { "Father First Name": f.fatherFirstName } : {}),
        ...(f.fatherLastName ? { "Father Last Name": f.fatherLastName } : {}),
        ...(f.fatherEmail ? { "Father Email": f.fatherEmail } : {}),
        ...(f.fatherPhone ? { "Father Phone": f.fatherPhone } : {})
      };
      const created = await airtable()(TABLE.Families).create([{ fields: familyFields }], { typecast: true });
      familyId = created[0].id;
    }
    if (!familyId) {
      return NextResponse.json({ ok: false, error: "Family not resolved" }, { status: 400 });
    }

    // 2. Students — create new ones, link existing ones.
    const studentIds: string[] = [];
    for (const s of data.students) {
      if ("studentId" in s) {
        studentIds.push(s.studentId);
      } else {
        const ns = s.newStudent;
        const studentFields: Partial<FieldSet> = {
          "Student Name": `${ns.firstName} ${ns.lastName}`.trim(),
          "First Name": ns.firstName,
          "Last Name": ns.lastName,
          Family: [familyId],
          "Lifecycle Stage": "PO Booked",
          ...(ns.grade ? { Grade: ns.grade } : {}),
          ...(ns.subjects.length ? { Subjects: ns.subjects } : {})
        };
        const created = await airtable()(TABLE.Students).create([{ fields: studentFields }], { typecast: true });
        studentIds.push(created[0].id);
      }
    }

    // 3. PO — link family + students.
    const poFields: Partial<FieldSet> = {
      "PO Date": data.poDate,
      "PO Time": data.poTime,
      Status: "Scheduled",
      "Booking Source": data.bookingSource,
      Family: [familyId],
      Students: studentIds,
      ...(data.parentPhone ? { "Parent Phone": data.parentPhone } : {}),
      ...(data.subjectInterest.length ? { "Subject Interest": data.subjectInterest } : {})
    };
    const createdPO = await airtable()(TABLE.POs).create([{ fields: poFields }], { typecast: true });

    return NextResponse.json({
      ok: true,
      data: {
        poId: createdPO[0].id,
        familyId,
        studentIds
      }
    });
  } catch (err: unknown) {
    let msg = "Unknown error";
    if (err instanceof Error) {
      msg = err.message;
    } else if (typeof err === "object" && err !== null) {
      const e = err as Record<string, unknown>;
      msg = String(e.message ?? e.error ?? JSON.stringify(err));
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
