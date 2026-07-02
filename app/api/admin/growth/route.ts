import { NextRequest, NextResponse } from "next/server";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { computeGrowth } from "@/lib/growth";

export const dynamic = "force-dynamic";

// GET /api/admin/growth
// The "Road to 225" scoreboard: active enrollments vs target, net flow this
// month + pace, the current month's PO conversion funnel, and a trailing-90-day
// booking-source breakdown.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const data = await computeGrowth();
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET growth] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load growth scoreboard";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
