import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { SCHEDULED_TASKS, type ScheduledTaskConfig } from "@/lib/scheduled-tasks";

export const dynamic = "force-dynamic";

export interface ScheduledTaskRow extends ScheduledTaskConfig {
  pendingCount: number | null;
  lastSeenAt: string | null;
  hoursSinceLastSeen: number | null;
  expectedIntervalHours: number;
  health: "ok" | "overdue" | "stale" | "unknown";
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const sources = new Set<string>();
    for (const t of SCHEDULED_TASKS) if (t.pendingCountSource) sources.add(t.pendingCountSource);

    const counts: Record<string, number> = {};
    const fingerprints: Record<string, string | null> = {};
    await Promise.all([
      ...Array.from(sources).map(async (src) => {
        counts[src] = await fetchPendingCount(src);
      }),
      ...SCHEDULED_TASKS.map(async (t) => {
        fingerprints[t.taskId] = await fetchLastSeenForTask(t.taskId);
      })
    ]);

    const now = Date.now();
    const rows: ScheduledTaskRow[] = SCHEDULED_TASKS.map((t) => {
      const expectedIntervalHours = parseExpectedInterval(t.schedule);
      const lastSeenAt = fingerprints[t.taskId] ?? null;
      const hoursSince = lastSeenAt
        ? Math.max(0, Math.round((now - new Date(lastSeenAt).getTime()) / 3_600_000))
        : null;
      let health: ScheduledTaskRow["health"] = "unknown";
      if (!t.enabled) health = "unknown";
      else if (hoursSince === null) health = "unknown";
      else if (hoursSince > expectedIntervalHours * 2) health = "stale";
      else if (hoursSince > expectedIntervalHours * 1.5) health = "overdue";
      else health = "ok";
      return {
        ...t,
        pendingCount: t.pendingCountSource ? counts[t.pendingCountSource] ?? 0 : null,
        lastSeenAt,
        hoursSinceLastSeen: hoursSince,
        expectedIntervalHours,
        health
      };
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function parseExpectedInterval(schedule: string): number {
  const s = schedule.toLowerCase();
  if (s.includes("3x daily")) return 8;
  if (s.includes("2x daily")) return 12;
  if (s.includes("nightly") || s.includes("daily")) return 24;
  if (s.includes("weekly")) return 24 * 7;
  return 24;
}

async function fetchLastSeenForTask(taskId: string): Promise<string | null> {
  try {
    if (taskId === "kumon-update-email-drafts") {
      const recs = await airtable()(TABLE.UpdateEmailRequests)
        .select({
          filterByFormula: `{Status}='Drafted'`,
          sort: [{ field: "Request Date", direction: "desc" }],
          fields: ["Request Date"],
          maxRecords: 1
        })
        .firstPage();
      return recs[0]?._rawJson?.createdTime ?? null;
    }
    if (taskId === "kumon-achievement-test-drafts") {
      const recs = await airtable()(TABLE.ProgressEvents)
        .select({
          filterByFormula: `{Email Draft Status}='Drafted'`,
          fields: ["Email Draft Status"],
          maxRecords: 1
        })
        .firstPage();
      return recs[0]?._rawJson?.createdTime ?? null;
    }
    if (taskId === "kumon-po-booking-detector") {
      const recs = await airtable()(TABLE.POs)
        .select({
          fields: ["PO Date"],
          sort: [{ field: "PO Date", direction: "desc" }],
          maxRecords: 1
        })
        .firstPage();
      return recs[0]?._rawJson?.createdTime ?? null;
    }
    if (
      taskId === "kumon-inbound-reply-logger" ||
      taskId === "kumon-outbound-reply-logger" ||
      taskId === "kumon-comms-reconciliation"
    ) {
      const recs = await airtable()(TABLE.Communications)
        .select({ fields: ["Date"], sort: [{ field: "Date", direction: "desc" }], maxRecords: 1 })
        .firstPage();
      return recs[0]?._rawJson?.createdTime ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPendingCount(source: string): Promise<number> {
  try {
    if (source === "update-email-requests") {
      const recs = await airtable()(TABLE.UpdateEmailRequests)
        .select({ filterByFormula: `{Status}='Pending'`, fields: ["Status"] })
        .all();
      return recs.length;
    }
    if (source === "progress-events-pending-draft") {
      const recs = await airtable()(TABLE.ProgressEvents)
        .select({
          filterByFormula: `AND(
            OR({Event Type}='Achievement Test', {Event Type}='Level Complete'),
            OR({Source}='Instructor Form Entry', {Source}='Manual'),
            IS_AFTER({Date}, DATEADD(TODAY(), -14, 'days')),
            OR({Email Draft Status}='', NOT({Email Draft Status})),
            NOT(FIND('placeholder', LOWER({Event Title})))
          )`,
          fields: ["Email Draft Status"]
        })
        .all();
      return recs.length;
    }
    if (source === "draft-outreach-requested") {
      const recs = await airtable()(TABLE.Students)
        .select({ filterByFormula: `{Draft Outreach Requested}=1`, fields: ["Draft Outreach Requested"] })
        .all();
      return recs.length;
    }
    if (source === "pending-start-no-welcome") {
      const recs = await airtable()(TABLE.Students)
        .select({
          filterByFormula: `AND(
            {Lifecycle Stage}='Pending Start',
            {Planned Start Date},
            IS_AFTER({Planned Start Date}, TODAY()),
            IS_BEFORE({Planned Start Date}, DATEADD(TODAY(), 14, 'days'))
          )`,
          fields: ["Lifecycle Stage"]
        })
        .all();
      return recs.length;
    }
    return 0;
  } catch {
    return 0;
  }
}
