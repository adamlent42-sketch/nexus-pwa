import { NextResponse } from "next/server";
import { airtable, TABLE } from "@/lib/airtable";
import { todayInET, addDays, dayOfWeekET, dayNameET } from "@/lib/time";
import type { CoverageDay, ApiResponse, DayOfWeek } from "@/types/kumon";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOTAL_DAYS = 28;

function isHighTier(tier: number | null, roles: string[]): boolean {
  if (tier !== null && tier <= 2) return true;
  return roles.some((r) => r === "OL" || r === "CL");
}

export async function GET() {
  try {
    const today = todayInET();
    const sundayOffset = dayOfWeekET(today);
    const startDate = addDays(today, -sundayOffset);

    const calendarStartIso = addDays(startDate, 0);
    const calendarEndIso = addDays(startDate, TOTAL_DAYS - 1);

    // Closures
    const closureRecords = await airtable()(TABLE.Closures)
      .select({
        fields: ["Date"],
        filterByFormula: `AND(IS_AFTER({Date}, DATEADD('${calendarStartIso}', -1, 'days')), IS_BEFORE({Date}, DATEADD('${calendarEndIso}', 1, 'days')))`
      })
      .all();
    const closedDates = new Set<string>();
    for (const r of closureRecords) {
      const d = r.get("Date") as string | null;
      if (d) closedDates.add(d);
    }

    const days: CoverageDay[] = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const date = addDays(startDate, i);
      const dow = dayOfWeekET(date);
      days.push({
        date,
        isToday: date === today,
        isPast: date < today,
        isClosed: dow === 0 || dow === 3 || dow === 5 || closedDates.has(date),
        scheduledCount: 0,
        outCount: 0,
        scheduledStaff: [],
        outStaffNames: [],
        highTierOutNames: []
      });
    }

    // Staff: tier + primary roles
    const staffRecords = await airtable()(TABLE.Staff)
      .select({ fields: ["Staff Name", "Tier", "Primary Roles"] })
      .all();
    const staffById = new Map<string, { name: string; tier: number | null; roles: string[]; isHighTier: boolean }>();
    for (const r of staffRecords) {
      const name = (r.get("Staff Name") as string | null) ?? "(staff)";
      const tierRaw = r.get("Tier") as string | number | null | undefined;
      const tier = tierRaw == null ? null : Number(tierRaw);
      const roles = ((r.get("Primary Roles") as string[] | null) ?? []) as string[];
      staffById.set(r.id, {
        name,
        tier: Number.isFinite(tier as number) ? (tier as number) : null,
        roles,
        isHighTier: isHighTier(tier as number | null, roles)
      });
    }

    // Weekly Schedule: now includes Staff + Role so we can:
    //   (a) build a per-staff working-days map (for accurate out-count)
    //   (b) build a per-day scheduled-staff list (for the dialog)
    const wsRecords = await airtable()(TABLE.WeeklySchedule)
      .select({ fields: ["Day of Week", "Specific Date", "Staff", "Role"] })
      .all();

    // staffWorkingDays: staffId → Set of DayOfWeek they're regularly scheduled
    const staffWorkingDays = new Map<string, Set<DayOfWeek>>();
    // dayStaff: DayOfWeek → deduplicated list of {name, roles} for the dialog
    const dayStaff = new Map<DayOfWeek, { staffId: string; name: string; roles: string[] }[]>();

    const scheduledByDay: Record<DayOfWeek, number> = {
      Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
      Thursday: 0, Friday: 0, Saturday: 0
    };
    const scheduledByDate: Record<string, number> = {};

    for (const r of wsRecords) {
      const specificDate = (r.get("Specific Date") as string | null) ?? null;
      const staffLinks = ((r.get("Staff") as string[] | undefined) ?? []);
      const roles = ((r.get("Role") as string[] | undefined) ?? []);

      if (specificDate) {
        scheduledByDate[specificDate] = (scheduledByDate[specificDate] ?? 0) + 1;
        continue; // one-off shifts: count only, don't update recurring schedule map
      }

      const dow = r.get("Day of Week") as DayOfWeek | null;
      if (!dow || !(dow in scheduledByDay)) continue;

      scheduledByDay[dow]++;

      // Build per-staff schedule map and per-day staff list
      for (const staffId of staffLinks) {
        const info = staffById.get(staffId);
        if (!info) continue;

        // Track which days this person works
        if (!staffWorkingDays.has(staffId)) staffWorkingDays.set(staffId, new Set());
        staffWorkingDays.get(staffId)!.add(dow);

        // Add to the day's staff list (dedup by staffId, merge roles)
        const list = dayStaff.get(dow) ?? [];
        const existing = list.find((s) => s.staffId === staffId);
        if (existing) {
          for (const role of roles) {
            if (!existing.roles.includes(role)) existing.roles.push(role);
          }
        } else {
          list.push({ staffId, name: info.name, roles: [...roles] });
        }
        dayStaff.set(dow, list);
      }
    }

    // Time Off: only count someone as "out" on days they're actually scheduled.
    // This prevents e.g. a M/TH-only staff member from being flagged on Tue/Sat.
    const toRecords = await airtable()(TABLE.TimeOff)
      .select({
        filterByFormula: `AND(
          OR({Status}='Approved', {Status}='Auto-logged'),
          {Start Date},
          IS_AFTER(DATEADD({Effective End Date}, 1, 'days'), '${calendarStartIso}'),
          IS_BEFORE({Start Date}, DATEADD('${calendarEndIso}', 1, 'days'))
        )`,
        fields: ["Staff", "Start Date", "Effective End Date", "Staff Name"]
      })
      .all();

    for (const r of toRecords) {
      const start = (r.get("Start Date") as string | null) ?? null;
      const end = (r.get("Effective End Date") as string | null) ?? start;
      const staffLinks = (r.get("Staff") as string[] | undefined) ?? [];
      const staffId = staffLinks[0] ?? null;
      const staffInfo = staffId ? staffById.get(staffId) : null;
      const nameArr = (r.get("Staff Name") as string[] | undefined) ?? [];
      const name = staffInfo?.name ?? nameArr[0] ?? "(staff)";
      const high = staffInfo?.isHighTier ?? false;
      if (!start || !end) continue;

      // The days this person actually works (null = unknown, count on all days)
      const workingDays = staffId ? staffWorkingDays.get(staffId) : null;

      for (const d of days) {
        if (d.date < start || d.date > end) continue;

        // Skip days they're not scheduled — avoids false positives like Myles on Tue/Sat
        if (workingDays) {
          const dowName = dayNameET(d.date) as DayOfWeek;
          if (!workingDays.has(dowName)) continue;
        }

        d.outCount++;
        if (!d.outStaffNames.includes(name)) d.outStaffNames.push(name);
        if (high && !d.highTierOutNames.includes(name)) d.highTierOutNames.push(name);
      }
    }

    // Populate scheduledCount and scheduledStaff per day
    for (const d of days) {
      const dowName = dayNameET(d.date) as DayOfWeek;
      d.scheduledCount = (scheduledByDay[dowName] ?? 0) + (scheduledByDate[d.date] ?? 0);
      d.scheduledStaff = (dayStaff.get(dowName) ?? []).map(({ name, roles }) => ({ name, roles }));
    }

    const body: ApiResponse<CoverageDay[]> = { ok: true, data: days };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
