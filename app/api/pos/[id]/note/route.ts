import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { airtable, TABLE } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const Body = z.object({
  parentNotes: z.string()
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    await airtable()(TABLE.POs).update(params.id, {
      "Parent Notes": parsed.data.parentNotes
    });

    return NextResponse.json({ ok: true, data: { id: params.id } });
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
