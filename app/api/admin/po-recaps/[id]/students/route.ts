import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

interface PerStudent {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  mathLevel: string | null;
  readingLevel: string | null;
  schedule: string[];
}

// GET — list linked students for this PO with their current per-student fields
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const { id } = params;
    const po = await airtable()(TABLE.POs).find(id);
    const studentIds = ((po.get("Students") as string[] | undefined) ?? []) as string[];
    if (studentIds.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }
    const formula = `OR(${studentIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const recs = await airtable()(TABLE.Students)
      .select({
        filterByFormula: formula,
        fields: ["Student Name", "Grade", "Subjects", "Math Level", "Reading Level", "Schedule"]
      })
      .all();
    const data: PerStudent[] = recs.map((r) => ({
      id: r.id,
      name: (r.get("Student Name") as string | null) ?? "(unnamed)",
      grade: (r.get("Grade") as string | null) ?? null,
      subjects: ((r.get("Subjects") as string[] | null) ?? []) as string[],
      mathLevel: (r.get("Math Level") as string | null) ?? null,
      readingLevel: (r.get("Reading Level") as string | null) ?? null,
      schedule: ((r.get("Schedule") as string[] | null) ?? []) as string[]
    }));
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH — bulk update linked students' per-student fields
// Body: { students: PerStudent[] }
export async function PATCH(req: NextRequest) {
  try {
    requireAdminPass(req);
    const body = await req.json() as { students: PerStudent[] };
    if (!Array.isArray(body.students)) {
      return NextResponse.json({ ok: false, error: "students must be an array" }, { status: 400 });
    }
    const updates = body.students.map((s) => {
      const fields: Partial<FieldSet> = {};
      if (s.subjects !== undefined) fields["Subjects"] = s.subjects;
      if (s.mathLevel !== undefined) fields["Math Level"] = s.mathLevel ?? "";
      if (s.readingLevel !== undefined) fields["Reading Level"] = s.readingLevel ?? "";
      if (s.schedule !== undefined) fields["Schedule"] = s.schedule;
      return { id: s.id, fields };
    });
    // Airtable allows up to 10 per update batch
    for (let i = 0; i < updates.length; i += 10) {
      await airtable()(TABLE.Students).update(updates.slice(i, i + 10), { typecast: true });
    }
    return NextResponse.json({ ok: true, data: { count: updates.length } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
