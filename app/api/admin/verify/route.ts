import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/admin/verify — body: { pass: string }
// Returns { ok: true } if matches APP_OWNER_PASSPHRASE; { ok: false, error } otherwise.
export async function POST(req: NextRequest) {
  const expected = process.env.APP_OWNER_PASSPHRASE;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APP_OWNER_PASSPHRASE not set on server" },
      { status: 500 }
    );
  }
  const body = await req.json().catch(() => ({})) as { pass?: string };
  if (!body.pass || body.pass !== expected) {
    return NextResponse.json({ ok: false, error: "Wrong passphrase" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
