// Server-side transactional email via the Resend REST API (no SDK dependency).
// No-ops gracefully if RESEND_API_KEY isn't set, so the app keeps working without
// email configured. Set RESEND_API_KEY (and optionally RESEND_FROM, OWNER_EMAIL)
// in .env.local and in the Vercel project's environment variables.

export const OWNER_EMAIL = process.env.OWNER_EMAIL || "adamlent@ikumon.com";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = process.env.RESEND_FROM || "Kumon Ops <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
