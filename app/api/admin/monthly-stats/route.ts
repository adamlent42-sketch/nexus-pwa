import { NextRequest, NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";
import { todayInET, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export interface MonthStat {
  month: string;       // "YYYY-MM"
  label: string;       // "Jan '26"
  posScheduled: number;
  posAttended: number;
  enrollments: number;
  conversionPct: number | null;  // attended → plan-to-enroll/enrolled, 0-100
}

function monthLabel(prefix: string): string {
  const [y, m] = prefix.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1] ?? ""} '${y.slice(2)}`;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);
    const today = todayInET();
    const windowStart = addDays(today, -365);

    const [studentRecs, poRecs] = await Promise.all([
      airtable()(TABLE.Students)
        .select({ fields: ["Enroll Date"] })
        .all(),
      airtable()(TABLE.POs)
        .select({
          filterByFormula: `AND({PO Date}, IS_AFTER({PO Date}, '${windowStart}'))`,
          fields: ["PO Date", "Status", "Outcome"]
        })
        .all()
    ]);

    // Build 12 month buckets (oldest → newest)
    const buckets = new Map<string, { posScheduled: number; posAttended: number; planEnroll: number; enrollments: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today + "T00:00:00");
      d.setMonth(d.getMonth() - i);
      const prefix = d.toISOString().slice(0, 7);
      buckets.set(prefix, { posScheduled: 0, posAttended: 0, planEnroll: 0, enrollments: 0 });
    }

    // Tally POs — exclude cancellations so a book→cancel→rebook only counts once.
    // "Family Cancelled" and "Instructor Cancelled" are noise; the rebooking is
    // the real signal.
    const CANCELLED_STATUSES = new Set(["Family Cancelled", "Instructor Cancelled"]);
    for (const r of poRecs) {
      const date = (r.get("PO Date") as string | null) ?? "";
      const prefix = date.slice(0, 7);
      const b = buckets.get(prefix);
      if (!b) continue;
      const status = (r.get("Status") as string | null) ?? "";
      if (CANCELLED_STATUSES.has(status)) continue;  // don't count cancelled POs
      b.posScheduled++;
      if (status === "Attended") b.posAttended++;
      const outcome = (r.get("Outcome") as string | null) ?? "";
      if (outcome === "Plan to Enroll" || outcome === "Enrolled") b.planEnroll++;
    }

    // Tally enrollments by enroll date
    for (const r of studentRecs) {
      const enrollDate = (r.get("Enroll Date") as string | null) ?? null;
      if (!enrollDate) continue;
      const prefix = enrollDate.slice(0, 7);
      const b = buckets.get(prefix);
      if (!b) continue;
      b.enrollments++;
    }

    const data: MonthStat[] = Array.from(buckets.entries()).map(([prefix, v]) => ({
      month: prefix,
      label: monthLabel(prefix),
      posScheduled: v.posScheduled,
      posAttended: v.posAttended,
      enrollments: v.enrollments,
      conversionPct: v.posAttended > 0
        ? Math.round((v.planEnroll / v.posAttended) * 100)
        : null
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
