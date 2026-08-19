import { NextRequest, NextResponse } from "next/server";
import type Airtable from "airtable";
import { airtable, TABLE, ATTENDANCE_FIELD, STUDENT_ATTENDANCE_FIELD } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// -- helpers -----------------------------------------------------------------

/** Current date in Eastern Time (YYYY-MM-DD). */
function etDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** ISO timestamp (UTC) for Airtable dateTime fields. */
function nowISO(): string {
  return new Date().toISOString();
}

/** The YYYY-MM-DD of the Sunday that starts the current week in ET. */
function getCurrentWeekSunday(): string {
  const now = new Date();
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dayOfWeek = etDate.getDay(); // 0=Sun
  etDate.setDate(etDate.getDate() - dayOfWeek);
  const y = etDate.getFullYear();
  const m = String(etDate.getMonth() + 1).padStart(2, "0");
  const d = String(etDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The YYYY-MM-DD of the Sunday 7 days before the given Sunday string. */
function previousSunday(sundayISO: string): string {
  const d = new Date(sundayISO + "T12:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** True if the student's birthday (month-day) falls in the current Sun-Sat week (ET). */
function isBirthdayWeek(dob: string | null | undefined): boolean {
  if (!dob) return false;
  const parts = dob.split("-");
  const mm = Number(parts[1]);
  const dd = Number(parts[2]);
  if (!mm || !dd) return false;

  const now = new Date();
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dayOfWeek = etDate.getDay();
  const sunday = new Date(etDate);
  sunday.setDate(etDate.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    if (d.getMonth() + 1 === mm && d.getDate() === dd) return true;
  }
  return false;
}

/** Duration in minutes between two ISO timestamps. */
function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

// Milestone thresholds
const MILESTONES = [5, 10, 25, 50, 100];

// -- POST /api/checkin -------------------------------------------------------
// Body: { studentId: string }  -- Airtable record ID from scanned QR code.
// Returns direction: "in" | "out" | "ignored"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { studentId?: string };
    const studentId = (body.studentId ?? "").trim();

    if (!studentId || !studentId.startsWith("rec")) {
      return NextResponse.json({ ok: false, error: "Invalid student ID" }, { status: 400 });
    }

    // -- Fetch student record --------------------------------------------------
    let studentRec: Airtable.Record<Airtable.FieldSet> | null = null;
    try {
      studentRec = await airtable()(TABLE.Students).find(studentId);
    } catch {
      return NextResponse.json(
        { ok: true, data: { direction: "unknown", studentId } },
        { status: 200 }
      );
    }

    const firstName = (studentRec.get("First Name") as string | null) ?? "";
    const studentName = (studentRec.get("Student Name") as string | null) ?? firstName ?? "(Unknown)";
    const dob = studentRec.get("DOB") as string | null | undefined;
    const subjects = ((studentRec.get("Subjects") as string[] | undefined) ?? []);
    const subjectCount = subjects.length || 1;
    const mathLevel = (studentRec.get("Math Level") as string | null) ?? null;
    const readingLevel = (studentRec.get("Reading Level") as string | null) ?? null;
    const schedule = ((studentRec.get("Schedule") as string[] | undefined) ?? []);
    const workPickupDay = (studentRec.get("Work Pickup Day") as string | null) ?? null;
    const currentStreak = (studentRec.get("Current Week Streak") as number | null) ?? 0;
    const longestStreak = (studentRec.get("Longest Streak") as number | null) ?? 0;
    const totalSessions = (studentRec.get("Total Lifetime Sessions") as number | null) ?? 0;
    const totalWeeks = (studentRec.get("Total Lifetime Weeks") as number | null) ?? 0;
    const lastAttendedWeek = (studentRec.get("Last Attended Week") as string | null) ?? "";

    const todayISO = etDateISO();

    // -- Check for an open session today ---------------------------------------
    const openRecords = await airtable()(TABLE.AttendanceLog)
      .select({
        filterByFormula: `AND(
          FIND('${studentId}', ARRAYJOIN({Student}, ',')),
          {Date} = '${todayISO}',
          {Check-Out Time} = BLANK()
        )`,
        sort: [{ field: "Check-In Time", direction: "desc" }],
        maxRecords: 1
      })
      .all();

    const openSession = openRecords[0] ?? null;

    // -- 2-minute debounce -----------------------------------------------------
    if (openSession) {
      const checkInTime = openSession.get("Check-In Time") as string | null;
      if (checkInTime) {
        const elapsed = minutesBetween(checkInTime, nowISO());
        if (elapsed < 2) {
          return NextResponse.json({
            ok: true,
            data: {
              direction: "ignored",
              reason: "debounce",
              studentName,
              firstName: firstName || studentName.split(" ")[0]
            }
          });
        }
      }

      // -- CHECK-OUT -----------------------------------------------------------
      const checkInTime2 = openSession.get("Check-In Time") as string | null;
      const checkOutTime = nowISO();
      const duration = checkInTime2 ? minutesBetween(checkInTime2, checkOutTime) : 0;

      await airtable()(TABLE.AttendanceLog).update(openSession.id, {
        [ATTENDANCE_FIELD.CheckOutTime]: checkOutTime,
        [ATTENDANCE_FIELD.DurationMinutes]: duration,
        [ATTENDANCE_FIELD.Method]: "Scan"
      });

      return NextResponse.json({
        ok: true,
        data: {
          direction: "out",
          studentName,
          firstName: firstName || studentName.split(" ")[0],
          durationMinutes: duration,
          totalWeeks,
          subjectCount,
          subjects,
          mathLevel,
          readingLevel,
          schedule,
          workPickupDay
        }
      });
    }

    // -- CHECK-IN --------------------------------------------------------------
    const currentWeekSunday = getCurrentWeekSunday();
    const prevSunday = previousSunday(currentWeekSunday);
    const birthdayFlag = isBirthdayWeek(dob);

    let newStreak = currentStreak;
    let weekAlreadyCounted = false;

    if (lastAttendedWeek === currentWeekSunday) {
      // Already attended this week -- no streak change
      weekAlreadyCounted = true;
      newStreak = currentStreak;
    } else if (lastAttendedWeek === prevSunday) {
      // Consecutive week
      newStreak = currentStreak + 1;
    } else {
      // Gap or first time
      newStreak = 1;
    }

    const newLongest = Math.max(longestStreak, newStreak);
    const newTotalSessions = totalSessions + 1;
    const newTotalWeeks = weekAlreadyCounted ? totalWeeks : totalWeeks + 1;

    // Milestone triggered this check-in?
    const milestoneTriggered = !weekAlreadyCounted && MILESTONES.includes(newStreak)
      ? newStreak
      : null;

    // Create AttendanceLog record
    const newRecord = await airtable()(TABLE.AttendanceLog).create({
      [ATTENDANCE_FIELD.StudentName]: studentName,
      [ATTENDANCE_FIELD.Student]: [studentId],
      [ATTENDANCE_FIELD.Date]: todayISO,
      [ATTENDANCE_FIELD.CheckInTime]: nowISO(),
      [ATTENDANCE_FIELD.Method]: "Scan",
      [ATTENDANCE_FIELD.StreakAtCheckIn]: newStreak,
      [ATTENDANCE_FIELD.SessionNumber]: newTotalSessions,
      [ATTENDANCE_FIELD.BirthdayFlag]: birthdayFlag,
      ...(milestoneTriggered ? { [ATTENDANCE_FIELD.MilestoneTriggered]: milestoneTriggered } : {})
    });

    // Update student streak fields
    await airtable()(TABLE.Students).update(studentId, {
      [STUDENT_ATTENDANCE_FIELD.CurrentWeekStreak]: newStreak,
      [STUDENT_ATTENDANCE_FIELD.LongestStreak]: newLongest,
      [STUDENT_ATTENDANCE_FIELD.TotalLifetimeSessions]: newTotalSessions,
      [STUDENT_ATTENDANCE_FIELD.TotalLifetimeWeeks]: newTotalWeeks,
      ...(!weekAlreadyCounted ? { [STUDENT_ATTENDANCE_FIELD.LastAttendedWeek]: currentWeekSunday } : {})
    });

    return NextResponse.json({
      ok: true,
      data: {
        direction: "in",
        attendanceId: newRecord.id,
        studentName,
        firstName: firstName || studentName.split(" ")[0],
        streak: newStreak,
        milestoneTriggered,
        birthdayFlag,
        sessionNumber: newTotalSessions,
        totalWeeks: newTotalWeeks,
        subjectCount,
        subjects,
        mathLevel,
        readingLevel,
        schedule,
        workPickupDay
      }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/checkin]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
