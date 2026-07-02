import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { TimeOffCreate } from "@/lib/schemas";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";
import type { FieldSet } from "airtable";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const dynamic = "force-dynamic";

// POST /api/time-off — staff submits a planned/sick/other absence (Status = Pending)
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = TimeOffCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { staffId, type, startDate, endDate, notes } = parsed.data;

    const fields: Partial<FieldSet> = {
      Staff: [staffId],
      Type: type,
      "Start Date": startDate,
      Status: "Pending"
    };
    if (endDate) fields["End Date"] = endDate;
    if (notes && notes.trim()) fields["Notes"] = notes.trim();

    const created = await airtable()(TABLE.TimeOff).create([{ fields }], { typecast: true });
    const first = Array.isArray(created) ? created[0] : created;

    // Best-effort owner notification — never blocks or fails the submission.
    try {
      let staffName = "A staff member";
      try {
        const s = await airtable()(TABLE.Staff).find(staffId);
        staffName = (s.get("Staff Name") as string) || staffName;
      } catch { /* name is optional */ }
      const dates = endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate;
      const approveUrl = `${req.nextUrl.origin}/admin/time-off`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:480px">
          <h2 style="margin:0 0 4px;font-size:18px">New time-off request</h2>
          <p style="margin:0 0 16px;color:#666;font-size:13px">Pending your approval</p>
          <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
            <tr><td style="color:#666;padding-right:14px">Staff</td><td><b>${esc(staffName)}</b></td></tr>
            <tr><td style="color:#666;padding-right:14px">Type</td><td>${esc(type)}</td></tr>
            <tr><td style="color:#666;padding-right:14px">Dates</td><td>${esc(dates)}</td></tr>
            ${notes && notes.trim() ? `<tr><td style="color:#666;padding-right:14px;vertical-align:top">Note</td><td>${esc(notes.trim())}</td></tr>` : ""}
          </table>
          <p style="margin:20px 0 0">
            <a href="${approveUrl}" style="background:#3F5AA8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">Review &amp; approve →</a>
          </p>
        </div>`;
      await sendEmail({ to: OWNER_EMAIL, subject: `Time-off request — ${staffName}, ${dates}`, html });
    } catch { /* notification is non-critical */ }

    return NextResponse.json({ ok: true, data: { id: first.id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
