import { NextRequest, NextResponse } from "next/server";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

async function findRow(staffId: string, moduleId: string) {
  const rows = await airtable()(TABLE.StaffTrainingProgress)
    .select({ fields: ["Staff", "Module", "Status", "Current Block", "Score", "Total", "Answers"] })
    .all();
  return rows.find((r) =>
    ((r.get("Staff") as string[] | undefined) ?? []).includes(staffId) &&
    ((r.get("Module") as string[] | undefined) ?? []).includes(moduleId)
  );
}

// GET /api/training/progress?staffId=&moduleId= — resume state, if any.
export async function GET(req: NextRequest) {
  try {
    const staffId = req.nextUrl.searchParams.get("staffId");
    const moduleId = req.nextUrl.searchParams.get("moduleId");
    if (!staffId || !moduleId) return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });
    const row = await findRow(staffId, moduleId);
    if (!row) return NextResponse.json({ ok: true, data: null });
    return NextResponse.json({
      ok: true,
      data: {
        status: (row.get("Status") as string | null) ?? null,
        currentBlock: (row.get("Current Block") as number | null) ?? 0,
        score: (row.get("Score") as number | null) ?? 0,
        total: (row.get("Total") as number | null) ?? 0,
        answers: (row.get("Answers") as string | null) ?? ""
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/training/progress — partial (status "In Progress") or final (Complete/Incomplete).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      staffId?: string; staffName?: string; moduleId?: string; moduleName?: string;
      score?: number; total?: number; status?: string; answers?: string;
      agreed?: boolean; feedback?: string; currentBlock?: number;
    };
    if (!body.staffId || !body.moduleId) {
      return NextResponse.json({ ok: false, error: "Missing staff or module" }, { status: 400 });
    }
    const today = todayInET();
    const partial = body.status === "In Progress";
    const status = partial ? "In Progress" : (body.status === "Complete" ? "Complete" : "Incomplete");

    const fields: Partial<FieldSet> = {
      Status: status,
      Score: body.score ?? 0,
      Total: body.total ?? 0,
      Answers: body.answers ?? "",
      "Current Block": body.currentBlock ?? 0
    };
    if (!partial) {
      fields["Agreed"] = Boolean(body.agreed);
      fields["Feedback"] = body.feedback ?? "";
      fields["Completed"] = status === "Complete" ? today : ("" as unknown as string);
    }

    const existing = await findRow(body.staffId, body.moduleId);
    if (existing) {
      await airtable()(TABLE.StaffTrainingProgress).update([{ id: existing.id, fields }], { typecast: true });
      return NextResponse.json({ ok: true, data: { id: existing.id, status } });
    }
    const created = await airtable()(TABLE.StaffTrainingProgress).create([{
      fields: {
        Record: `${body.staffName ?? "Staff"} — ${body.moduleName ?? "Module"}`,
        Staff: [body.staffId],
        Module: [body.moduleId],
        Started: today,
        ...fields
      }
    }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: created[0].id, status } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
