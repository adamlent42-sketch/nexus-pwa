import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { sendEmail, OWNER_EMAIL } from "@/lib/email";
import { todayInET, addDays, dayOfWeekET } from "@/lib/time";

export const dynamic = "force-dynamic";

// Day-of-week index (0=Sun..6=Sat) for each schedule option stored in Airtable.
const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6
};

// Returns the first scheduled class day on or after `returnDate`, walking up to
// 21 days forward. Returns null if the student has no schedule or no match found.
function nextClassDay(returnDate: string, schedule: string[]): string | null {
  const indices = schedule.map((d) => DAY_INDEX[d]).filter((n) => n !== undefined);
  if (indices.length === 0) return null;
  let date = returnDate;
  for (let i = 0; i < 21; i++) {
    if (indices.includes(dayOfWeekET(date))) return date;
    date = addDays(date, 1);
  }
  return null;
}

// Formats "2025-08-05" → "Tuesday, August 5" for use in emails.
function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

// GET /api/cron/break-reminders
// (1) Emails the owner a summary of planned-break families returning within ~2 weeks.
// (2) Sends each of those families a warm welcome-back email pinning their next
//     scheduled class day so they're on the spot about restarting.
// Run daily (Vercel cron). Protected by CRON_SECRET if that env var is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const today = todayInET();
    const horizon = addDays(today, 14);

    // Fetch students coming off break, including Schedule and linked Family.
    const recs = await airtable()(TABLE.Students)
      .select({
        filterByFormula: `AND(
          {Lifecycle Stage}='Planned Break',
          {Planned Return},
          NOT({Break Reminder Sent}),
          IS_BEFORE({Planned Return}, '${horizon}'),
          IS_AFTER(DATEADD({Planned Return}, 1, 'days'), '${today}')
        )`,
        fields: ["Student Name", "Planned Return", "Hold Notes", "Schedule", "Family"]
      })
      .all();

    if (recs.length === 0) {
      return NextResponse.json({ ok: true, data: { sent: 0 } });
    }

    // Resolve family records in one bulk call.
    const familyIds = Array.from(
      new Set(recs.flatMap((r) => ((r.get("Family") as string[] | undefined) ?? [])))
    );
    const familyById = new Map<string, {
      name: string;
      motherFirst: string | null;
      fatherFirst: string | null;
      motherEmail: string | null;
      fatherEmail: string | null;
    }>();

    if (familyIds.length > 0) {
      const formula = `OR(${familyIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const famRecs = await airtable()(TABLE.Families)
        .select({
          filterByFormula: formula,
          fields: ["Family Name", "Mother First Name", "Mother Email", "Father First Name", "Father Email"]
        })
        .all();
      for (const f of famRecs) {
        familyById.set(f.id, {
          name: (f.get("Family Name") as string | null) ?? "",
          motherFirst: (f.get("Mother First Name") as string | null) ?? null,
          fatherFirst: (f.get("Father First Name") as string | null) ?? null,
          motherEmail: (f.get("Mother Email") as string | null) ?? null,
          fatherEmail: (f.get("Father Email") as string | null) ?? null
        });
      }
    }

    // --- Internal owner summary email ---
    const lines = recs
      .map(
        (r) =>
          `• ${r.get("Student Name")} — returns ${r.get("Planned Return")}` +
          (r.get("Hold Notes") ? ` (${r.get("Hold Notes")})` : "")
      )
      .join("<br>");

    const ownerHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#222">
      <h2 style="font-size:18px;margin:0 0 6px">Break check-ins coming up</h2>
      <p style="font-size:13px;color:#666;margin:0 0 14px">These families are due back within ~2 weeks — welcome-back emails have been sent to each family. Reactivate their invoices in Invoice Ninja.</p>
      <p style="font-size:14px;line-height:1.9">${lines}</p>
    </div>`;

    const ownerResult = await sendEmail({
      to: OWNER_EMAIL,
      subject: `Break check-ins — ${recs.length} returning soon`,
      html: ownerHtml
    });

    // --- Per-family welcome-back emails ---
    let familyEmailsSent = 0;
    for (const rec of recs) {
      const studentName = (rec.get("Student Name") as string | null) ?? "your child";
      const returnDate = (rec.get("Planned Return") as string | null);
      const schedule = ((rec.get("Schedule") as string[] | undefined) ?? []);
      const linkedFamilyIds = ((rec.get("Family") as string[] | undefined) ?? []);
      const family = linkedFamilyIds.length > 0 ? familyById.get(linkedFamilyIds[0]) : null;

      if (!family) continue;

      // Collect recipient emails — send to whichever parent emails exist.
      const recipients: string[] = [];
      if (family.motherEmail) recipients.push(family.motherEmail);
      if (family.fatherEmail && family.fatherEmail !== family.motherEmail) {
        recipients.push(family.fatherEmail);
      }
      if (recipients.length === 0) continue;

      // Pick a greeting name: prefer mother's first name, then family name.
      const greeting = family.motherFirst ?? family.fatherFirst ?? family.name ?? "there";

      // Find the next scheduled class day on/after the return date.
      const classDay = returnDate ? nextClassDay(returnDate, schedule) : null;
      const classDayDisplay = classDay ? friendlyDate(classDay) : null;

      // Build the email.
      const classDayLine = classDayDisplay
        ? `<p style="font-size:15px;margin:0 0 14px">We have <strong>${studentName}</strong> coming back on <strong>${classDayDisplay}</strong> — we're looking forward to seeing them!</p>`
        : `<p style="font-size:15px;margin:0 0 14px">We're looking forward to welcoming <strong>${studentName}</strong> back — their return date is coming up soon.</p>`;

      const familyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:560px">
        <p style="font-size:15px;margin:0 0 14px">Hi ${greeting},</p>
        ${classDayLine}
        <p style="font-size:15px;margin:0 0 14px">As a reminder, their regular schedule is ${schedule.length > 0 ? schedule.join(" and ") : "on file with us"}. Please let us know if anything has changed or if you have any questions before they return.</p>
        <p style="font-size:15px;margin:0 0 6px">See you soon!</p>
        <p style="font-size:14px;color:#555;margin:0">— The Kumon Team</p>
      </div>`;

      const subject = classDayDisplay
        ? `See you ${classDayDisplay.split(",")[0]}! ${studentName}'s return is coming up`
        : `${studentName}'s return is coming up — we'll see you soon!`;

      for (const to of recipients) {
        const r = await sendEmail({ to, subject, html: familyHtml });
        if (r.ok) familyEmailsSent++;
      }
    }

    // Mark all records as reminded only if at least the owner email sent (or was skipped).
    if (ownerResult.ok || ownerResult.skipped) {
      for (let i = 0; i < recs.length; i += 10) {
        await airtable()(TABLE.Students).update(
          recs.slice(i, i + 10).map((rec) => ({ id: rec.id, fields: { "Break Reminder Sent": true } })),
          { typecast: true }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      data: { students: recs.length, ownerEmail: ownerResult, familyEmailsSent }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
