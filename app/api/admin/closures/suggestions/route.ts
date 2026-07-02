import { NextRequest, NextResponse } from "next/server";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { suggestionsForWindow } from "@/lib/holidays";

export const dynamic = "force-dynamic";

// GET /api/admin/closures/suggestions?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns federal-holiday + school-break suggestions in the given window.
// Default window: today through end of (current year + 2), so suggestions
// match the calendar grid in /admin/closures.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = new Date();
    const defaultStart = today.toISOString().slice(0, 10);
    const endYear = today.getFullYear() + 2;
    const future = new Date(endYear, 11, 31);
    const defaultEnd = future.toISOString().slice(0, 10);

    const start = req.nextUrl.searchParams.get("start") ?? defaultStart;
    const end = req.nextUrl.searchParams.get("end") ?? defaultEnd;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return NextResponse.json({ ok: false, error: "bad date params" }, { status: 400 });
    }

    const data = suggestionsForWindow(start, end);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
