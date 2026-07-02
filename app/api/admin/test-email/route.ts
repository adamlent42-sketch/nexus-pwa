import { NextRequest, NextResponse } from "next/server";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/admin/test-email?to=optional@addr  — sends a test email and returns the
// real result (ok / skipped / error) so we can diagnose delivery. Does not expose
// the API key, only whether it's present.
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") || OWNER_EMAIL;
  const keyPresent = !!process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Kumon Ops <onboarding@resend.dev>";
  const result = await sendEmail({
    to,
    subject: "Kumon Ops — test email",
    html: "<p>This is a test from the Kumon Ops app. If you got this, time-off alerts will work.</p>"
  });
  return NextResponse.json({ keyPresent, from, to, result });
}
