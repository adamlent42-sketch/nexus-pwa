// Server-side only. Never import into client components.
// The PAT (personal access token) reads from env and never touches the browser.

import Airtable from "airtable";

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "appNL9MjcWDgMAsih";

if (!PAT) {
  console.warn(
    "[airtable] AIRTABLE_PAT is not set. Copy .env.local.example to .env.local and add your token."
  );
}

let _base: Airtable.Base | null = null;

export function airtable(): Airtable.Base {
  if (!_base) {
    if (!PAT) throw new Error("AIRTABLE_PAT not configured");
    _base = new Airtable({ apiKey: PAT }).base(BASE_ID);
  }
  return _base;
}

// Enrollment reporting base (separate Airtable base for monthly Report B data)
const ENROLLMENT_BASE_ID = "appDGwyxucaHSR6cq";
let _enrollmentBase: Airtable.Base | null = null;

export function enrollmentBase(): Airtable.Base {
  if (!_enrollmentBase) {
    if (!PAT) throw new Error("AIRTABLE_PAT not configured");
    _enrollmentBase = new Airtable({ apiKey: PAT }).base(ENROLLMENT_BASE_ID);
  }
  return _enrollmentBase;
}

export const ENROLLMENT_TABLES = {
  MonthlyEnrollment: "tblbgJjxO7gL1YaTl"
} as const;

// Table IDs — pinned so a table rename in Airtable doesn't break us.
export const TABLE = {
  Families: "tblqc9vt52whSRkoP",
  Students: "tblclbsxY2uBL12MD",
  POs: "tblAkMYC3RGA4kLCx",
  Communications: "tblYIUrUf41uWlG2V",
  ProgressEvents: "tblvTXiCO2EPxo0ec",
  UpdateEmailRequests: "tbla0ZJbNJNFysoKr",
  WorkPickupNotifications: "tbl688HsHJgEeXpVC",
  StaffAlerts: "tblWKvsCneo5fZnaM",
  Staff: "tblTLJRi3MJmEaFdX",
  WeeklySchedule: "tblxt6bGq1Tc2Aux8",
  TimeOff: "tblld3vcOa8JxuJBD",
  InstructionNotes: "tblNP6wCnHeUaQFCH",
  StudentChangeRequests: "tblYb1QCbCNx3ajXW",
  Closures: "tbl9LzMtFDOccpEDS",
  SyncRequests: "tblMkKxZPyEXb14gF",
  ComposeRequests: "tblzCDimwtWjTzgZ0",
  TrainingModules: "tbl3pKb1RtClc51Ax",
  TrainingBlocks: "tblLWHhaehIR3AmtG",
  StaffTrainingProgress: "tbl7sq5qTWOfa5VAw",
  AttendanceLog: "tblDxJU15EK03joFN"
} as const;

// AttendanceLog field IDs (pinned)
export const ATTENDANCE_FIELD = {
  StudentName: "fld64vP5RnZrvmtDE",      // primary text — denorm name
  Student: "fldrsSsz1uVbr3El7",           // linked record -> Students
  Date: "fldx5kCj4imXZhSxG",
  CheckInTime: "fldkwLzrmCQ3L06xP",
  CheckOutTime: "fldOo498XNFAsrueh",
  DurationMinutes: "fldE1Qli2VpSPJLFT",
  Method: "fld3M6IRbTAZHvKTy",            // Scan | Manual | Auto-closed
  StreakAtCheckIn: "fldGMWB1wxD9TxRSd",
  SessionNumber: "fldhY7F7FiaGIPeI3",
  BirthdayFlag: "fldRVeXhAuJVclmH2",
  MilestoneTriggered: "fld1tvNUygMNIzujW",
  ObservationCompletion: "fldx4SBmTq6CcGLdV",
  ObservationFocus: "fldhY3lefD9ZBCood",
  ObservationProgress: "fldlljQ1gYkGPt3sB",
  ObservationNotes: "fldNLiAgUCxH0eZZp",
  FlagCallParent: "fldiCCpZjEXPTmVEp",
  FlagAddInstructionNote: "fldkoX5IZ41fsAJLc",
  ObservationAddedBy: "fldqCVmJ9xGwnGNUw",
} as const;

// Students table attendance-related field IDs
export const STUDENT_ATTENDANCE_FIELD = {
  CurrentWeekStreak: "fldT7pvYnRn8NuDkH",
  LongestStreak: "fldD2VvRHgtiRLdz3",
  TotalLifetimeSessions: "fldu3ePC7BloPEI5c",
  LastAttendedWeek: "fld8Lb7yVwtt5SaEq",
  DOB: "fldoBEcvJpkSPde7k",
  FirstName: "fldTPVhwDfZeGk9IS",
  StudentName: "fldtBKt6SEKobqeoV",
} as const;
