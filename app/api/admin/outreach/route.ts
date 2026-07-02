import { NextRequest, NextResponse } from "next/server";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { computeOutreach } from "@/lib/outreach";

export const dynamic = "force-dynamic";

// GET /api/admin/outreach
// The outreach command center: every tracked student across the lifecycle in a
// single payload — 4 lane summaries (% on-cadence), an overall metric, the full
// student set, and a prioritized "needs contact now" worklist.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const data = await computeOutreach();
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET outreach] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load outreach";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
