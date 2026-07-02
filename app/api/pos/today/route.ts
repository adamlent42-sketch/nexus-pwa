import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, nowInET, parseTime12h } from "@/lib/time";
import type { PORow, ApiResponse } from "@/types/kumon";

export const dynamic = "force-dynamic";

// Returns the PO action queue:
//   1. Today's POs (any status) - stay on the list the whole scheduled day,
//      even after a recap is submitted, so staff can still edit the recap.
//   2. Future POs (next 30 days, excluding Family/Instructor Cancelled)
//   3. Past POs with NO recap submitted yet (last 14 days, Attended/Not Attended only).
//      Once staff submits a recap on a past PO, it leaves the staff dashboard
//      and lives only in Admin -> PO recaps until Adam marks it Reviewed.
// Family Cancelled and Instructor Cancelled never appear - no recap action needed.
export async function GET() {
  try {
    const today = todayInET();
    const now = nowInET();

    const records = await airtable()(TABLE.POs)
      .select({
        filterByFormula: `OR(
          AND(
            IS_SAME({PO Date}, '${today}', 'day'),
            NOT({Status} = 'Family Cancelled'),
            NOT({Status} = 'Instructor Cancelled'),
            NOT({Status} = 'Rescheduled')
          ),
          AND(
            IS_AFTER({PO Date}, '${today}'),
            IS_BEFORE({PO Date}, DATEADD('${today}', 30, 'days')),
            NOT({Status} = 'Family Cancelled'),
            NOT({Status} = 'Instructor Cancelled'),
            NOT({Status} = 'Rescheduled')
          ),
          AND(
            IS_BEFORE({PO Date}, '${today}'),
            IS_AFTER({PO Date}, DATEADD('${today}', -14, 'days')),
            NOT({Recap Status}),
            NOT({Status} = 'Family Cancelled'),
            NOT({Status} = 'Instructor Cancelled'),
            NOT({Status} = 'Rescheduled')
          )
        )`,
        sort: [{ field: "PO Date", direction: "asc" }, { field: "PO Time", direction: "asc" }],
        fields: [
          "PO Date", "PO Time", "Student Display", "Grade",
          "Status", "Outcome", "Subject Interest",
          "Parent Phone", "Booking Source", "Recap Status", "Parent Notes",
          "eEnrollment Form Completed", "Planned Start Date", "Planned Class Time",
          "Planned Schedule", "Recommended Math Starting Level",
          "Recommended Reading Starting Level", "Lead Source", "Staff Notes ",
          "30 Day Vision", "GPS Priorities"
        ]
      })
      .all();

    const seen = new Set<string>();
    const pos: PORow[] = records.map((r) => {
      const time = (r.get("PO Time") as string | null) ?? "";
      const date = (r.get("PO Date") as string | null) ?? today;
      const recapStatus = (r.get("Recap Status") as string | null) ?? null;
      const status = (r.get("Status") as string | null) ?? "Scheduled";

      let isOverdueRecap = false;
      if (!recapStatus) {
        if (date < today) {
          isOverdueRecap = true;
        } else if (date === today && time) {
          const t24 = parseTime12h(time);
          if (t24) {
            const poDateTime = `${today}T${t24}`;
            isOverdueRecap = now > poDateTime;
          }
        }
      }

      return {
        id: r.id,
        time,
        date,
        student: (r.get("Student Display") as string | null) ?? "(unnamed)",
        grade: (r.get("Grade") as string | null) ?? null,
        subjects: ((r.get("Subject Interest") as string[] | undefined) ?? []) as string[],
        phone: (r.get("Parent Phone") as string | null) ?? null,
        source: (r.get("Booking Source") as string | null) ?? null,
        status,
        recapStatus,
        isOverdueRecap,
        parentNotes: (r.get("Parent Notes") as string | null) ?? null,
        // Only present once a recap exists, so the form can pre-fill for editing.
        recap: recapStatus
          ? {
              outcome: (r.get("Outcome") as string | null) ?? null,
              eEnrollmentCompleted: (r.get("eEnrollment Form Completed") as boolean | undefined) ?? false,
              plannedStartDate: (r.get("Planned Start Date") as string | null) ?? null,
              plannedClassTime: (r.get("Planned Class Time") as string | null) ?? null,
              plannedSchedule: ((r.get("Planned Schedule") as string[] | undefined) ?? []) as string[],
              recommendedMathLevel: (r.get("Recommended Math Starting Level") as string | null) ?? null,
              recommendedReadingLevel: (r.get("Recommended Reading Starting Level") as string | null) ?? null,
              leadSource: (r.get("Lead Source") as string | null) ?? null,
              thirtyDayVision: (r.get("30 Day Vision") as string | null) ?? null,
              gpsPriorities: ((r.get("GPS Priorities") as string[] | undefined) ?? []) as string[],
              staffNotes: (r.get("Staff Notes ") as string | null) ?? null
            }
          : null
      };
    });

    // Deduplicate: same student + date + time = same PO (handles Airtable duplicate records).
    // Normalize time string (strip spaces, lowercase) so "3:30 PM" and "3:30PM" collapse to the same key.
    const deduped = pos.filter((p) => {
      const normalizedTime = (p.time ?? "").replace(/\s+/g, "").toLowerCase();
      const key = `${p.student}|${p.date}|${normalizedTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort: backlog first (oldest past -> newest), then today, then upcoming (soonest first)
    deduped.sort((a, b) => {
      const ad = a.date ?? today;
      const bd = b.date ?? today;
      const aBucket = ad < today ? 0 : ad === today ? 1 : 2;
      const bBucket = bd < today ? 0 : bd === today ? 1 : 2;
      if (aBucket !== bBucket) return aBucket - bBucket;
      // within bucket, sort by date asc, then by actual start time.
      if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
      // Compare on parsed 24h time so "9:00 AM" precedes "10:30 AM" (a raw
      // string compare would sort "10:30 AM" first). Empty/unparseable times sink last.
      const at = parseTime12h(a.time) ?? "99:99";
      const bt = parseTime12h(b.time) ?? "99:99";
      return at.localeCompare(bt);
    });

    const body: ApiResponse<PORow[]> = { ok: true, data: deduped };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
