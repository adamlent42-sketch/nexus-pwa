import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET, addDays } from "@/lib/time";
import { computeMissingData } from "@/lib/missing-data";
import { computeOutreach } from "@/lib/outreach";

export const dynamic = "force-dynamic";
const OUTBOX = "tblHWXG0SDfUNQc7L";

// GET /api/admin/attention — the admin command center.
// Aggregates everything that needs Adam's eyes into a single list of items,
// each with a count, a tone (red = act now, yellow = review, green = clear),
// and where to go. Powers the Admin home + the nav-tab badges.
export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  tone: "red" | "yellow" | "green";
  href: string;
  hint?: string;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();
    const cutoff45 = addDays(today, -45);
    const now = Date.now();

    const [timeOffRecs, changeRecs, outboxRecs, pastDueRecs, missing, recentStartRecs, outreach] = await Promise.all([
      airtable()(TABLE.TimeOff).select({
        filterByFormula: `{Status}='Pending'`,
        fields: ["Status"]
      }).all(),
      airtable()(TABLE.StudentChangeRequests).select({
        filterByFormula: `{Completed At}=BLANK()`,
        fields: ["Status"]
      }).all(),
      airtable()(OUTBOX).select({
        fields: ["Status"]
      }).all(),
      airtable()(TABLE.Students).select({
        filterByFormula: `AND(OR({Lifecycle Stage}='Pending Start', {Lifecycle Stage}='Pending Start State'), {First Class Date}, IS_BEFORE({First Class Date}, TODAY()), {First Class Attended Date}=BLANK())`,
        fields: ["Student Name"]
      }).all(),
      computeMissingData(),
      airtable()(TABLE.Students).select({
        filterByFormula: `AND({Lifecycle Stage}='Active-Engaged', OR(AND({First Class Attended Date}, IS_AFTER({First Class Attended Date}, '${cutoff45}')), AND({Enroll Date}, IS_AFTER({Enroll Date}, '${cutoff45}'))))`,
        fields: ["First Class Attended Date", "Enroll Date", "Week 1 Check-In Date", "Week 4 Check-In Date"]
      }).all(),
      computeOutreach()
    ]);

    // First-weeks check-ins overdue: 1-week past its grace (day 10) or 4-week past
    // grace (day 31) and not yet done, on recently-started kids.
    let checkinsOverdue = 0;
    for (const r of recentStartRecs) {
      const started = (r.get("First Class Attended Date") as string | null) ?? (r.get("Enroll Date") as string | null) ?? null;
      if (!started) continue;
      if (!r.get("Week 1 Check-In Date") && !r.get("Week 4 Check-In Date") && today > addDays(started, 10)) checkinsOverdue++;
      if (!r.get("Week 4 Check-In Date") && today > addDays(started, 31)) checkinsOverdue++;
    }

    // Outbox: failed + stuck (Pending older than 4h).
    let failed = 0, stuck = 0;
    for (const r of outboxRecs) {
      const status = (r.get("Status") as string | null) ?? "";
      if (status === "Failed") failed++;
      else if (status === "Pending") {
        const created = (r as unknown as { _rawJson?: { createdTime?: string } })._rawJson?.createdTime;
        if (created && (now - new Date(created).getTime()) / 3_600_000 > 4) stuck++;
      }
    }
    const outboxIssues = failed + stuck;

    const items: AttentionItem[] = [
      {
        key: "time-off", label: "Time-off requests", count: timeOffRecs.length,
        tone: timeOffRecs.length > 0 ? "red" : "green", href: "/admin/time-off",
        hint: "pending staff PTO to approve"
      },
      {
        key: "outbox", label: "Email queue issues", count: outboxIssues,
        tone: outboxIssues > 0 ? "red" : "green", href: "/admin/outbox",
        hint: failed > 0 || stuck > 0 ? `${failed} failed · ${stuck} stuck` : "queue healthy"
      },
      {
        key: "past-due-starts", label: "Past-due starts", count: pastDueRecs.length,
        tone: pastDueRecs.length > 0 ? "yellow" : "green", href: "/#onboarding",
        hint: "committed kids who never got marked started — open Checklist to fix their record"
      },
      {
        key: "checkins", label: "First-weeks check-ins overdue", count: checkinsOverdue,
        tone: checkinsOverdue > 0 ? "yellow" : "green", href: "/",
        hint: "1-week / 4-week parent check-ins past due on recently-started kids"
      },
      {
        key: "change-requests", label: "Change requests open", count: changeRecs.length,
        tone: changeRecs.length > 0 ? "yellow" : "green", href: "/admin/change-requests",
        hint: "student changes awaiting action"
      },
      {
        key: "missing-data", label: "Students missing data", count: missing.count,
        tone: missing.count > 0 ? "yellow" : "green", href: "/admin/missing-data",
        hint: "required fields blank for their stage"
      },
      {
        key: "outreach-overdue", label: "Families overdue for outreach", count: outreach.overall.overdue,
        tone: outreach.overall.overdue > 0 ? "yellow" : "green", href: "/admin/student-outreach",
        hint: outreach.overall.percentOnCadence === null
          ? "across retention, pipeline, recovery & reactivation"
          : `${outreach.overall.percentOnCadence}% on-cadence overall — work the command center`
      }
    ];

    const redCount = items.filter((i) => i.tone === "red").length;
    const yellowCount = items.filter((i) => i.tone === "yellow").length;
    // Map each item to the nav tab it belongs to, so the shell can badge tabs.
    const byHref: Record<string, number> = {};
    for (const i of items) if (i.count > 0) byHref[i.href] = (byHref[i.href] ?? 0) + i.count;

    return NextResponse.json({
      ok: true,
      data: { items, redCount, yellowCount, byHref, allClear: items.every((i) => i.count === 0) }
    });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
