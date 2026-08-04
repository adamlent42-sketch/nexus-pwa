import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";
import { todayInET } from "@/lib/time";
import type { FieldSet } from "airtable";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// POST /api/students/mark-returned
// Staff marks that a student on planned break has returned to class.
// Body: { studentId: string }
// 1. Sets Lifecycle Stage → Active-Engaged
// 2. Sets Invoice Action → Reactivate (surfaces in /admin/breaks to-dos)
// 3. Emails Adam with student details + Invoice Ninja action needed
export async function POST(req: NextRequest) {
  try {
    const { studentId } = (await req.json()) as { studentId?: string };
    if (!studentId) {
      return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });
    }

    // Fetch student record for context before updating
    const rec = await airtable()(TABLE.Students).find(studentId);
    const name = (rec.get("Student Name") as string | null) ?? "(student)";
    const subjects = (rec.get("Subjects") as string[] | null) ?? [];
    const plannedReturn = (rec.get("Planned Return") as string | null) ?? null;
    const today = todayInET();

    // Update the student record
    await airtable()(TABLE.Students).update([{
      id: studentId,
      fields: {
        "Lifecycle Stage": "Active-Engaged",
        "Invoice Action": "Reactivate",
      } as Partial<FieldSet>
    }], { typecast: true });

    // Email Adam — direct send (not a draft) since this is an internal ops notification
    try {
      const subjectsLabel = subjects.length ? subjects.join(" + ") : "unknown subject(s)";
      const plannedLabel = plannedReturn ?? "no planned date on file";
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:520px">
          <h2 style="margin:0 0 4px;font-size:18px">Student returned from break</h2>
          <p style="margin:0 0 16px;color:#666;font-size:13px">Marked returned today by staff</p>
          <table style="font-size:14px;line-height:1.9;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="color:#666;padding-right:16px">Student</td><td><b>${esc(name)}</b></td></tr>
            <tr><td style="color:#666;padding-right:16px">Subjects</td><td>${esc(subjectsLabel)}</td></tr>
            <tr><td style="color:#666;padding-right:16px">Planned return</td><td>${esc(plannedLabel)}</td></tr>
            <tr><td style="color:#666;padding-right:16px">Marked returned</td><td>${today}</td></tr>
          </table>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;font-size:14px">
            <p style="margin:0 0 6px;font-weight:bold;color:#166534">⚡ Invoice Ninja action needed</p>
            <p style="margin:0;color:#15803d">Reactivate the recurring invoice for <b>${esc(name)}</b> (${esc(subjectsLabel)}) — they are back in class as of today.</p>
          </div>
          <p style="margin:14px 0 0;font-size:13px;color:#666">
            This student is also flagged in
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/breaks" style="color:#0F6E56">Admin → Breaks</a>
            under Invoice Ninja to-dos. Mark it Done there once the invoice is reactivated.
          </p>
        </div>`;
      await sendEmail({
        to: OWNER_EMAIL,
        subject: `${name} returned from break — reactivate Invoice Ninja`,
        html,
      });
    } catch { /* email is non-critical — Airtable update already succeeded */ }

    return NextResponse.json({ ok: true, data: { name, date: today } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
