import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { UpdateEmailCreate } from "@/lib/schemas";
import type { FieldSet } from "airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = UpdateEmailCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const fields: Partial<FieldSet> = {
      Student: [data.studentId],
      "Request Date": todayInET(),
      Status: "Pending"
    };
    if (data.isQuickNote) {
      fields["Email Type"] = "Quick Note";
      if (data.quickNoteBody) fields["Quick Note Body"] = data.quickNoteBody.trim();
    } else {
      if (data.emailType) fields["Email Type"] = data.emailType;
      if (data.notableInClass) fields["Notable in Class"] = data.notableInClass.trim();
      if (data.familyContext) fields["Family Context to Acknowledge"] = data.familyContext.trim();
      if (data.concerns) fields["Concerns or Topics to Address"] = data.concerns.trim();
      if (data.anythingElse) fields["Anything Else"] = data.anythingElse.trim();
    }
    const created = await airtable()(TABLE.UpdateEmailRequests).create([{ fields }], { typecast: true });
    const first = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
