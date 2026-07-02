import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

interface Body {
  decision: "Approved" | "Denied";
  sendEmail?: boolean;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdminPass(req);
    const { id } = params;
    const body = (await req.json()) as Body;
    if (body.decision !== "Approved" && body.decision !== "Denied") {
      return NextResponse.json({ ok: false, error: "decision must be Approved or Denied" }, { status: 400 });
    }
    const fields: Partial<FieldSet> = { Status: body.decision };
    if (body.decision === "Approved" && body.sendEmail) fields["Send Absence Email"] = true;
    await airtable()(TABLE.TimeOff).update([{ id, fields }]);
    return NextResponse.json({ ok: true, data: { id, decision: body.decision } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
