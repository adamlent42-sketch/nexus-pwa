import { NextRequest, NextResponse } from "next/server";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { computeMissingData } from "@/lib/missing-data";

export const dynamic = "force-dynamic";

// GET /api/admin/students-missing-data — students missing required-by-stage fields.
// (Computation lives in lib/missing-data.ts so the command center can reuse the count.)
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const data = await computeMissingData();
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
