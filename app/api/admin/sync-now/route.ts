import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST /api/admin/sync-now
//   Queues an on-demand sync. Writes a row to the Sync Requests table with
//   Status=Requested. The kumon-on-demand-sync scheduled task polls for these
//   rows and runs: draft queued Update Email Requests -> scan Gmail Sent and
//   log Outbound Communications -> stamp Last Contact Date / reconcile drafts.
//   The PWA itself has no Gmail/LLM access, so it can only signal the task.
//
// GET /api/admin/sync-now
//   Returns the most recent sync request so the UI can show live status.
//
// To avoid piling up duplicate requests on rapid clicks, POST returns the
// existing open request (Requested/Running) instead of creating a new one.

const Body = z.object({
  action: z.enum(["Full Sync", "Draft Only", "Catch Sent Only"]).default("Full Sync"),
  source: z.string().max(120).optional()
});

interface SyncRequestView {
  id: string;
  status: string;
  action: string;
  requestedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
}

function toView(rec: {
  id: string;
  get: (f: string) => unknown;
}): SyncRequestView {
  return {
    id: rec.id,
    status: (rec.get("Status") as string | null) ?? "Requested",
    action: (rec.get("Action") as string | null) ?? "Full Sync",
    requestedAt: (rec.get("Requested At") as string | null) ?? null,
    completedAt: (rec.get("Completed At") as string | null) ?? null,
    resultSummary: (rec.get("Result Summary") as string | null) ?? null
  };
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const recs = await airtable()(TABLE.SyncRequests)
      .select({
        sort: [{ field: "Requested At", direction: "desc" }],
        maxRecords: 1
      })
      .firstPage();
    return NextResponse.json({ ok: true, data: recs[0] ? toView(recs[0]) : null });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdminPass(req);
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { action, source } = parsed.data;

    // Dedupe: if there's already an open request, return it rather than queuing
    // a second one. The poller processes everything still open anyway.
    const open = await airtable()(TABLE.SyncRequests)
      .select({
        filterByFormula: `OR({Status}='Requested', {Status}='Running')`,
        sort: [{ field: "Requested At", direction: "desc" }],
        maxRecords: 1
      })
      .firstPage();
    if (open[0]) {
      return NextResponse.json({ ok: true, data: { ...toView(open[0]), alreadyQueued: true } });
    }

    const created = await airtable()(TABLE.SyncRequests).create(
      [
        {
          fields: {
            "Requested At": new Date().toISOString(),
            Status: "Requested",
            Action: action,
            Source: source ?? "Lead Follow-up page"
          }
        }
      ],
      { typecast: true }
    );
    const first = created[0];
    return NextResponse.json({ ok: true, data: { ...toView(first), alreadyQueued: false } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
