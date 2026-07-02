import { NextRequest, NextResponse } from "next/server";
import { enrollmentBase, ENROLLMENT_TABLES } from "@/lib/airtable";
import { requireAdminPass, AdminAuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export interface EnrollmentReportStat {
  month: string;    // "YYYY-MM"
  label: string;    // "Dec '25"
  total: number;
  math: number;
  reading: number;
}

const MON: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
};

function parseMonth(s: string): string | null {
  const parts = s.split("-");
  if (parts.length !== 2) return null;
  const [m, y] = parts;
  const month = MON[m];
  if (!month || !y) return null;
  const year = 2000 + parseInt(y, 10);
  return `${year}-${month}`;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1] ?? ""} '${y.slice(2)}`;
}

export async function GET(req: NextRequest) {
  try {
    requireAdminPass(req);

    const records = await enrollmentBase()(ENROLLMENT_TABLES.MonthlyEnrollment)
      .select({
        fields: ["Month", "Math Enrollment", "Reading Enrollment", "Total Enrollment"]
      })
      .all();

    const parsed: EnrollmentReportStat[] = [];

    for (const r of records) {
      const rawMonth = (r.get("Month") as string | null) ?? "";
      const yyyymm = parseMonth(rawMonth);
      if (!yyyymm) continue;
      parsed.push({
        month: yyyymm,
        label: monthLabel(yyyymm),
        total: (r.get("Total Enrollment") as number | null) ?? 0,
        math: (r.get("Math Enrollment") as number | null) ?? 0,
        reading: (r.get("Reading Enrollment") as number | null) ?? 0,
      });
    }

    // Sort oldest → newest, take last 18 months
    parsed.sort((a, b) => a.month.localeCompare(b.month));
    const data = parsed.slice(-18);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    let msg = "Unknown error";
    if (err instanceof Error) {
      msg = err.message;
    } else if (err !== null && typeof err === "object") {
      msg = JSON.stringify(err);
    } else {
      msg = String(err);
    }
    console.error("[enrollment-report]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
