import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { getInvoiceForStudent, invoiceNinjaConfigured } from "@/lib/invoice-ninja";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/invoice — read-only Invoice Ninja lookup for the
// student's family, so the checklist can show the amount due at the first class.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!invoiceNinjaConfigured()) {
      return NextResponse.json({ ok: true, data: { configured: false, found: false } });
    }
    const s = await airtable()(TABLE.Students).find(params.id);
    const studentName = (s.get("Student Name") as string | null) ?? (s.get("First Name") as string | null) ?? "";
    const famIds = ((s.get("Family") as string[] | undefined) ?? []) as string[];
    if (famIds.length === 0) {
      return NextResponse.json({ ok: true, data: { configured: true, found: false } });
    }
    const fam = await airtable()(TABLE.Families).find(famIds[0]);
    const emails = [
      fam.get("Mother Email") as string | null,
      fam.get("Father Email") as string | null,
      fam.get("Other Contact Email") as string | null
    ].filter(Boolean) as string[];

    const summary = await getInvoiceForStudent(studentName, emails);

    // Auto-complete the "First Invoice Paid" checklist box once Invoice Ninja shows
    // the first invoice fully paid. Only writes on the false→true transition, so it
    // never overwrites an existing payment date or re-stamps on every load.
    if (summary.firstInvoicePaid && !Boolean(s.get("First Invoice Paid"))) {
      await airtable()(TABLE.Students).update(
        [{
          id: s.id,
          fields: {
            "First Invoice Paid": true,
            "First Payment Date": (s.get("First Payment Date") as string | null) || summary.firstPaymentDate || todayInET()
          }
        }],
        { typecast: true }
      );
    }

    return NextResponse.json({ ok: true, data: summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
