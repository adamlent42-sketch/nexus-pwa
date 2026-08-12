import { NextRequest, NextResponse } from "next/server";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

// GET /api/admin/qr?id=recXXXXXXXX&format=svg|png|dataurl
// Generates a QR code image for a student record ID.
export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const id = req.nextUrl.searchParams.get("id") ?? "";
    const format = req.nextUrl.searchParams.get("format") ?? "svg";

    if (!id || !id.startsWith("rec")) {
      return NextResponse.json({ ok: false, error: "Valid record id required" }, { status: 400 });
    }

    if (format === "svg") {
      const svg = await QRCode.toString(id, {
        type: "svg",
        margin: 1,
        width: 192,
        color: { dark: "#1A1A1A", light: "#FFFFFF" }
      });
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    if (format === "png") {
      const buffer = await QRCode.toBuffer(id, {
        type: "png",
        margin: 1,
        width: 384,
        color: { dark: "#1A1A1A", light: "#FFFFFF" }
      });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="qr-${id}.png"`,
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    if (format === "dataurl") {
      const dataUrl = await QRCode.toDataURL(id, {
        margin: 1,
        width: 384,
        color: { dark: "#1A1A1A", light: "#FFFFFF" }
      });
      return NextResponse.json({ ok: true, data: { dataUrl } });
    }

    return NextResponse.json({ ok: false, error: "format must be svg, png, or dataurl" }, { status: 400 });

  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
