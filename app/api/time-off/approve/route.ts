import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Compute HMAC-SHA256 of `message` with `secret`, returns hex string.
async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function html(title: string, body: string, color = "#0F6E56") {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · Kumon</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7f4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:#fff;border-radius:12px;border:0.5px solid rgba(0,0,0,.1);padding:36px 40px;max-width:380px;width:90%;text-align:center}
    .icon{font-size:40px;margin-bottom:12px} h1{margin:0 0 8px;font-size:20px;font-weight:500;color:#0b0b0b}
    p{margin:0;font-size:14px;color:#5f5e5a;line-height:1.5} .dot{display:inline-block;width:48px;height:48px;border-radius:50%;margin-bottom:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;background:${color}20}
    svg{width:24px;height:24px}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// GET /api/time-off/approve?id=recXXX&token=YYYY
// One-click approval link embedded in the notification email.
// Token is HMAC-SHA256(recordId, APPROVE_SECRET) to prevent forgery.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const secret = process.env.APPROVE_SECRET;
  if (!secret) {
    return html("Error", `<div class="dot" style="background:#D85A3020"><svg fill="none" stroke="#D85A30" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h1>Not configured</h1><p>APPROVE_SECRET environment variable is not set.</p>`, "#D85A30");
  }

  if (!id || !token) {
    return html("Invalid link", `<div class="dot" style="background:#D85A3020"><svg fill="none" stroke="#D85A30" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h1>Invalid link</h1><p>This approval link is missing required parameters.</p>`, "#D85A30");
  }

  const expected = await hmac(secret, id);
  if (token !== expected) {
    return html("Invalid token", `<div class="dot" style="background:#D85A3020"><svg fill="none" stroke="#D85A30" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><h1>Link not valid</h1><p>This approval link is invalid or has been tampered with.</p>`, "#D85A30");
  }

  try {
    // Check current status first — avoid double-approving
    const rec = await airtable()(TABLE.TimeOff).find(id);
    const currentStatus = rec.get("Status") as string | null;

    if (currentStatus === "Approved") {
      return html("Already approved", `<div class="dot"><svg fill="none" stroke="#0F6E56" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><h1>Already approved</h1><p>This time-off request was already approved.</p>`);
    }

    await airtable()(TABLE.TimeOff).update([{ id, fields: { Status: "Approved" } }]);

    // Pull name + dates for the confirmation page
    let staffName = "";
    let staffEmail = "";
    let dates = "";
    let type = "";
    try {
      const links = (rec.get("Staff") as string[] | undefined) ?? [];
      if (links[0]) {
        const s = await airtable()(TABLE.Staff).find(links[0]);
        staffName = (s.get("Staff Name") as string | null) ?? "";
        staffEmail = (s.get("Email") as string | null) ?? "";
      }
      const start = (rec.get("Start Date") as string | null) ?? "";
      const end = (rec.get("End Date") as string | null) ?? null;
      dates = end && end !== start ? `${start} – ${end}` : start;
      type = (rec.get("Type") as string | null) ?? "";
    } catch { /* display is non-critical */ }

    // Notify the staff member that their request was approved (best-effort)
    if (staffEmail) {
      try {
        const firstName = staffName.split(" ")[0] || staffName;
        const notesLine = rec.get("Notes") ? `<p style="margin:12px 0 0;color:#666;font-size:13px">Your note: ${String(rec.get("Notes"))}</p>` : "";
        const staffHtml = `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:480px">
            <h2 style="margin:0 0 4px;font-size:18px">Time-off request approved ✓</h2>
            <p style="margin:0 0 16px;color:#666;font-size:13px">Hi ${firstName}, your request has been approved.</p>
            <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
              ${type ? `<tr><td style="color:#666;padding-right:14px">Type</td><td>${type}</td></tr>` : ""}
              ${dates ? `<tr><td style="color:#666;padding-right:14px">Dates</td><td><b>${dates}</b></td></tr>` : ""}
            </table>
            ${notesLine}
            <p style="margin:16px 0 0;color:#666;font-size:13px">If anything changes, let Adam know as soon as possible.</p>
          </div>`;
        await sendEmail({
          to: staffEmail,
          subject: `Time off approved — ${dates}`,
          html: staffHtml,
        });
      } catch { /* notification is non-critical */ }
    }

    return html("Approved", `<div class="dot"><svg fill="none" stroke="#0F6E56" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><h1>Approved</h1><p>${staffName ? `<b>${staffName}</b>'s` : "The"} time-off request${dates ? ` for ${dates}` : ""} has been approved and updated in Airtable.</p>`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return html("Error", `<div class="dot" style="background:#D85A3020"><svg fill="none" stroke="#D85A30" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h1>Something went wrong</h1><p>${msg}</p>`, "#D85A30");
  }
}
