// Zod schemas mirroring each form's writable payload.
// Used both client-side (to enable Submit) and server-side (to validate POST body).

import { z } from "zod";

const recordId = z.string().min(1);

export const StaffAlertCreate = z.object({
  alert: z.string().min(1, "Alert text is required").max(2000),
  studentId: recordId.nullable().optional(),
  category: z.string().min(1, "Pick a category"),
  createdBy: z.string().min(1, "Pick yourself")
});
export type StaffAlertCreateInput = z.infer<typeof StaffAlertCreate>;

// Edit an existing Active alert in place (text, student, category, created by).
// Mirrors the create payload; Status is left untouched server-side.
export const StaffAlertUpdate = z.object({
  alert: z.string().min(1, "Alert text is required").max(2000),
  studentId: recordId.nullable().optional(),
  category: z.string().min(1, "Pick a category"),
  createdBy: z.string().min(1, "Pick yourself")
});
export type StaffAlertUpdateInput = z.infer<typeof StaffAlertUpdate>;

export const InstructionNoteCreate = z.object({
  studentId: recordId,
  note: z.string().min(1, "Note is required").max(2000),
  category: z.string().min(1, "Pick a category"),
  createdBy: z.string().min(1, "Pick yourself")
});
export type InstructionNoteCreateInput = z.infer<typeof InstructionNoteCreate>;

export const InstructionNoteSnooze = z.object({
  snoozedUntil: z.string().min(1) // YYYY-MM-DD
});

export const InstructionNoteClose = z.object({
  closingNote: z.string().min(1).max(2000),
  completedBy: z.string().min(1)
});

export const PickupNotificationCreate = z.object({
  studentIds: z.array(recordId).min(1, "Pick at least one student"),
  submittedBy: z.string().min(1),
  notes: z.string().max(500).optional()
});
export type PickupNotificationCreateInput = z.infer<typeof PickupNotificationCreate>;

export const TimeOffCreate = z.object({
  staffId: recordId,
  type: z.enum(["Planned", "Planned Absence", "Sick", "Other"]),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional()
});
export type TimeOffCreateInput = z.infer<typeof TimeOffCreate>;

export const UpdateEmailCreate = z.object({
  studentId: recordId,
  submittedBy: z.string().min(1),
  isQuickNote: z.boolean(),
  emailType: z.string().optional(),       // when !isQuickNote
  quickNoteBody: z.string().optional(),    // when isQuickNote
  notableInClass: z.string().optional(),
  familyContext: z.string().optional(),
  concerns: z.string().optional(),
  anythingElse: z.string().optional()
});
export type UpdateEmailCreateInput = z.infer<typeof UpdateEmailCreate>;

export const AchievementTestCreate = z.object({
  studentId: recordId,
  subject: z.enum(["Math", "Reading"]),
  level: z.string().min(1),
  score: z.number().int().min(0),
  timeMinutes: z.number().int().min(0).max(120),
  notes: z.string().optional(),
  submittedBy: z.string().min(1)
});
export type AchievementTestCreateInput = z.infer<typeof AchievementTestCreate>;

export const PORecapSubmit = z.object({
  poId: recordId,
  status: z.enum(["Scheduled", "Rescheduled", "Attended", "Not Attended", "Family Cancelled", "Instructor Cancelled"]),
  outcome: z.enum(["Plan to Enroll", "Undecided", "Enrolled", "Not Interested"]).nullable().optional(),
  eEnrollmentCompleted: z.boolean().optional(),
  plannedStartDate: z.string().nullable().optional(),
  plannedClassTime: z.string().nullable().optional(),
  plannedSchedule: z.array(z.string()).optional(),
  recommendedMathLevel: z.string().nullable().optional(),
  recommendedReadingLevel: z.string().nullable().optional(),
  subjectInterest: z.array(z.string()).optional(),
  leadSource: z.string().nullable().optional(),
  thirtyDayVision: z.string().optional(),
  gpsPriorities: z.array(z.string()).optional(),
  staffNotes: z.string().min(1, "Staff notes are required"),
  submittedBy: z.string().min(1)
});
export type PORecapSubmitInput = z.infer<typeof PORecapSubmit>;
