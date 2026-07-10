import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { airtable, TABLE } from "@/lib/airtable";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";

export const dynamic = "force-dynamic";

const Body = z.object({
  staffId: z.string().min(1),
  requestType: z.enum(["Add a day", "Remove a day", "Change my time", "Other"]),
  details: z.string().min(3, "Please describe what you'd like to change")
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// POST /api/schedule/change-request
// Auto-sends email to Adam + the staff member describing the requested change.
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
    const { staffId, requestType, details } = parsed.data;

    // Look up name + email
    let staffName = "A staff member";
    let staffEmail: string | null = null;
    try {
      const s = await airtable()(TABLE.Staff).find(staffId);
      staffName = (s.get("Staff Name") as string | null) ?? staffName;
      staffEmail = (s.get("Email") as string | null) ?? null;
    } catch { /* non-critical */ }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:480px">
        <h2 style="margin:0 0 4px;font-size:18px">Schedule change request</h2>
        <p style="margin:0 0 16px;color:#666;font-size:13px">Submitted via the staff portal</p>
        <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
          <tr><td style="color:#666;padding-right:14px">Staff</td><td><b>${esc(staffName)}</b></td></tr>
          <tr><td style="color:#666;padding-right:14px">Request type</td><td>${esc(requestType)}</td></tr>
          <tr><td style="color:#666;padding-right:14px;vertical-align:top">Details</td><td>${esc(details)}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#888">
          Reply to this email or update the schedule in Airtable. The staff member has been CC'd.
        </p>
      </div>`;

    const subject = `Schedule change request — ${staffName}`;

    // Send to Adam
    await sendEmail({ to: OWNER_EMAIL, subject, html });

    // Send confirmation to staff member if we have their email
    if (staffEmail) {
      const confirmHtml = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:480px">
          <h2 style="margin:0 0 4px;font-size:18px">Your schedule change request</h2>
          <p style="margin:0 0 16px;color:#666;font-size:13px">We've sent this to Adam. He'll follow up with you directly.</p>
          <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
            <tr><td style="color:#666;padding-right:14px">Request type</td><td>${esc(requestType)}</td></tr>
            <tr><td style="color:#666;padding-right:14px;vertical-align:top">Details</td><td>${esc(details)}</td></tr>
          </table>
        </div>`;
      await sendEmail({ to: staffEmail, subject: `Schedule request received — ${requestType}`, html: confirmHtml });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
