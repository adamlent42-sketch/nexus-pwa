import { NextRequest, NextResponse } from "next/server";
import type { FieldSet } from "airtable";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET } from "@/lib/time";

export const dynamic = "force-dynamic";

// Staff-facing onboarding checklist for a single student (the "digital green
// folder"). GET returns every field the checklist UI needs; PATCH toggles one
// checklist box. No admin gate — staff use this from the dashboard.

// Toggleable checklist boxes (UI sends the Airtable field name).
const TOGGLEABLE = new Set([
  "Folder Made", "Name Label Made", "Worksheets Pulled", "Pouch Ready",
  "Invoice Account Created", "First Invoice Sent", "Recurring Invoice Set",
  "First Invoice Paid", "KSIS Enrolled", "eEnrollment Completed"
]);

// Boxes that also stamp a date field when checked (cleared when unchecked).
const DATE_STAMP: Record<string, string> = {
  "First Invoice Paid": "First Payment Date",
  "KSIS Enrolled": "KSIS Confirmed Date",
  "eEnrollment Completed": "eEnrollment Date"
};

// "From the PO recap" fields that can be edited inline on the checklist screen.
// Value may be a string (Grade, levels, dates, pickup day) or a string[]
// (Subjects, Schedule). Empty string / empty array clears the field.
const EDITABLE = new Set([
  "Subjects", "Grade", "Math Level", "Reading Level",
  "First Class Date", "Schedule", "Work Pickup Day"
]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await airtable()(TABLE.Students).find(params.id);
    const b = (f: string) => Boolean(s.get(f));
    const str = (f: string) => (s.get(f) as string | null) ?? null;
    const arr = (f: string) => ((s.get(f) as string[] | undefined) ?? []) as string[];

    return NextResponse.json({
      ok: true,
      data: {
        id: s.id,
        name: str("Student Name") ?? str("First Name") ?? "(student)",
        lifecycle: str("Lifecycle Stage"),
        firstClassDate: str("First Class Date"),
        // From-recap context (derived "done" computed in the UI):
        subjects: arr("Subjects"),
        grade: str("Grade"),
        schedule: arr("Schedule"),
        workPickupDay: str("Work Pickup Day"),
        mathLevel: str("Math Level"),
        readingLevel: str("Reading Level"),
        // Materials:
        folderMade: b("Folder Made"),
        nameLabelMade: b("Name Label Made"),
        worksheetsPulled: b("Worksheets Pulled"),
        pouchReady: b("Pouch Ready"),
        // Billing (manual in v1):
        invoiceAccountCreated: b("Invoice Account Created"),
        firstInvoiceSent: b("First Invoice Sent"),
        recurringInvoiceSet: b("Recurring Invoice Set"),
        firstInvoicePaid: b("First Invoice Paid"),
        firstPaymentDate: str("First Payment Date"),
        // Enrollment systems:
        eEnrolled: b("eEnrollment Completed"),       // auto-detected, manual fallback
        eEnrollmentDate: str("eEnrollment Date"),
        ksisEnrolled: b("KSIS Enrolled"),
        ksisConfirmedDate: str("KSIS Confirmed Date")
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { field, value } = (await req.json()) as { field?: string; value?: boolean | string | string[] };
    const fields: Partial<FieldSet> = {};

    if (field && TOGGLEABLE.has(field)) {
      // Checkbox toggle (+ optional date stamp).
      fields[field] = Boolean(value);
      const dateField = DATE_STAMP[field];
      if (dateField) fields[dateField] = value ? todayInET() : ("" as unknown as string);
    } else if (field && EDITABLE.has(field)) {
      // Inline edit of a "from recap" field. Arrays for multi-selects; "" clears.
      fields[field] = (Array.isArray(value) ? value : (value ?? "")) as FieldSet[string];
    } else {
      return NextResponse.json({ ok: false, error: "Unknown checklist field" }, { status: 400 });
    }

    await airtable()(TABLE.Students).update([{ id: params.id, fields }], { typecast: true });
    return NextResponse.json({ ok: true, data: { id: params.id, field, value } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
