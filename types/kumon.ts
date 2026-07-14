// Type shapes mirroring the Kumon CRM Airtable base.
// Field names match Airtable exactly (case-sensitive, spaces included).

export type RecordId = string;

export type POStatus = "Scheduled" | "Rescheduled" | "Attended" | "Not Attended" | "Family Cancelled" | "Instructor Cancelled";
export type POOutcome = "Plan to Enroll" | "Undecided" | "Enrolled" | "Not Interested" | "Not Yet Set";
export type RecapStatus = "Submitted - Pending Owner Review" | "Reviewed" | "Legacy - Pre-Workflow" | null;
export type Subject = "Math" | "Reading";
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

// Existing recap values on a PO, used to pre-fill the recap form for editing.
export interface PORecapValues {
  outcome: string | null;
  eEnrollmentCompleted: boolean;
  plannedStartDate: string | null;
  plannedClassTime: string | null;
  plannedSchedule: string[];
  recommendedMathLevel: string | null;
  recommendedReadingLevel: string | null;
  leadSource: string | null;
  thirtyDayVision: string | null;
  gpsPriorities: string[];
  staffNotes: string | null;
}

export interface PORow {
  id: RecordId;
  time: string;
  date: string | null;
  student: string;
  grade: string | null;
  subjects: string[];
  phone: string | null;
  source: string | null;
  status: string;
  recapStatus: string | null;
  isOverdueRecap: boolean;
  parentNotes: string | null;
  // Populated only when a recap has already been submitted, so the form can edit it.
  recap: PORecapValues | null;
}

export interface AlertRow {
  id: RecordId;
  alert: string;
  category: string | null;
  createdBy: string | null;
  dateNoted: string | null;
  createdAt: string | null;
  studentId: RecordId | null;
  studentName: string | null;
  studentGrade: string | null;
}

export interface InstructionNoteRow {
  id: RecordId;
  note: string;
  category: string | null;
  createdBy: string | null;
  dateNoted: string | null;
  createdAt: string | null;
  studentName: string | null;
  studentSchedule: DayOfWeek[];
  studentGrade: string | null;
}

export interface NewStudentRow {
  id: RecordId;
  name: string;
  grade: string | null;
  subjects: string[];
  plannedStartDate: string | null;
  enrollDate: string | null;
  weekOfWatch: number | null;
  thirtyDayVision: string | null;
  gpsPriorities: string[];
}

export interface NewStudentsGroups {
  startingToday: NewStudentRow[];
  plannedThisWeek: NewStudentRow[];
  firstMonthWatch: NewStudentRow[];
}

export interface StaffRow {
  id: RecordId;
  staffId: RecordId;
  name: string;
  role: string | null;
  startTime: string | null;
  endTime: string | null;
  isOut: boolean;
}

export interface CoverageDay {
  date: string;
  isToday: boolean;
  isPast: boolean;
  isClosed: boolean;
  scheduledCount: number;
  outCount: number;
  scheduledStaff: { name: string; roles: string[] }[];
  outStaffNames: string[];
  highTierOutNames: string[];
}

export interface ApiOk<T> { ok: true; data: T }
export interface ApiErr { ok: false; error: string }
export type ApiResponse<T> = ApiOk<T> | ApiErr;
