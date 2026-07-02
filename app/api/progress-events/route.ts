import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { AchievementTestCreate } from "@/lib/schemas";
import type { FieldSet } from "airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = AchievementTestCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { studentId, subject, level, score, timeMinutes, notes } = parsed.data;
    const fields: Partial<FieldSet> = {
      Student: [studentId],
      "Event Type": "Achievement Test",
      Subject: subject,
      Level: level,
      Date: todayInET(),
      "Raw Score": score,
      "Time (min)": timeMinutes,
      // Must match the option the kumon-achievement-test-drafts task filters on.
      Source: "Instructor Form Entry"
    };
    if (notes && notes.trim()) fields["Comments"] = notes.trim();

    const created = await airtable()(TABLE.ProgressEvents).create([{ fields }], { typecast: true });
    const first = Array.isArray(created) ? created[0] : created;

    // Bump the student's Last Contact Date so the outreach engine knows we saw
    // them in person. An Achievement Test = a meaningful in-person touch.
    // Only overwrite if the test date is newer than what's already there.
    try {
      const student = await airtable()(TABLE.Students).find(studentId);
      const existing = (student.get("Last Contact Date") as string | null) ?? "";
      const testDate = todayInET();
      if (!existing || testDate > existing) {
        await airtable()(TABLE.Students).update(
          [{ id: studentId, fields: { "Last Contact Date": testDate, "Last Contact Type": "Achievement Test" } }],
          { typecast: true }
        );
      }
    } catch (e) {
      console.error("[progress-events] failed to update Last Contact Date:", e);
    }

    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
