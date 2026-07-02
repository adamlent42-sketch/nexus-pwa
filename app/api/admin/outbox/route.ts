import { NextRequest, NextResponse } from "next/server";
import { airtable } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";
const OUTBOX = "tblHWXG0SDfUNQc7L";

// GET /api/admin/outbox — health + recent rows for the Email Outbox queue.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();
    const now = Date.now();

    const recs = await airtable()(OUTBOX)
      .select({
        fields: ["Job", "Job Type", "Status", "Trigger Source", "Last Error", "Drafted At", "Gmail Draft ID", "Attempts"]
      })
      .all();

    const counts: Record<string, number> = { Pending: 0, Drafting: 0, Drafted: 0, Sent: 0, Failed: 0, Skipped: 0 };
    let stuck = 0;
    let draftedToday = 0;

    const rows = recs
      .map((r) => {
        const status = (r.get("Status") as string | null) ?? "—";
        counts[status] = (counts[status] ?? 0) + 1;
        const created = (r as unknown as { _rawJson?: { createdTime?: string } })._rawJson?.createdTime;
        const ageH = created ? (now - new Date(created).getTime()) / 3_600_000 : null;
        const isStuck = status === "Pending" && ageH !== null && ageH > 4;
        if (isStuck) stuck++;
        const draftedAt = (r.get("Drafted At") as string | null) ?? null;
        if (status === "Drafted" && draftedAt === today) draftedToday++;
        return {
          id: r.id,
          job: (r.get("Job") as string | null) ?? "(job)",
          type: (r.get("Job Type") as string | null) ?? "—",
          status,
          trigger: (r.get("Trigger Source") as string | null) ?? null,
          error: (r.get("Last Error") as string | null) ?? null,
          draftedAt,
          createdTime: created ?? null,
          stuck: isStuck
        };
      })
      .sort((a, b) => (b.createdTime ?? "").localeCompare(a.createdTime ?? ""))
      .slice(0, 60);

    const health: "green" | "red" = counts.Failed > 0 || stuck > 0 ? "red" : "green";
    return NextResponse.json({ ok: true, data: { health, counts, stuck, draftedToday, rows } });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
