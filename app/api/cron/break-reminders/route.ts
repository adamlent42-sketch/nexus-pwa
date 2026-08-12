import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";
import { todayInET, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/cron/break-reminders
// Emails the owner about planned-break families returning within ~2 weeks (once each,
// deduped via "Break Reminder Sent") so they get re-captured and invoices reactivated.
// Run daily (Vercel cron). Protected by CRON_SECRET if that env var is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const today = todayInET();
    const horizon = addDays(today, 14);
    const recs = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `AND({Lifecycle Stage}='Planned Break', {Planned Return}, NOT({Break Reminder Sent}), IS_BEFORE({Planned Return}, '${horizon}'), IS_AFTER(DATEADD({Planned Return}, 1, 'days'), '${today}'))`,
        fields: ["Student Name", "Planned Return", "Hold Notes"]
      })
      .all();
    if (recs.length === 0) return NextResponse.json({ ok: true, data: { sent: 0 } });

    const lines = recs
      .map((r) => `• ${r.get("Student Name")} — returns ${r.get("Planned Return")}${r.get("Hold Notes") ? ` (${r.get("Hold Notes")})` : ""}`)
      .join("<br>");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#222"><h2 style="font-size:18px;margin:0 0 6px">Break check-ins coming up</h2><p style="font-size:13px;color:#666;margin:0 0 14px">These families are due back within ~2 weeks — reach out to re-capture them, and reactivate their invoices in Invoice Ninja.</p><p style="font-size:14px;line-height:1.9">${lines}</p></div>`;
    const sendResult = await sendEmail({ to: OWNER_EMAIL, subject: `Break check-ins — ${recs.length} returning soon`, html });

    if (sendResult.ok) {
      for (let i = 0; i < recs.length; i += 10) {
        await airtable()(TABLE.Students).update(
          recs.slice(i, i + 10).map((rec) => ({ id: rec.id, fields: { "Break Reminder Sent": true } })),
          { typecast: true }
        );
      }
    }
    return NextResponse.json({ ok: true, data: { sent: recs.length, email: sendResult } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
