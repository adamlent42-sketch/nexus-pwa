// Auto-suggest the parent-facing email branch from a PO recap's state.
// Matches §6 of the brainstorm handoff.

export type EmailBranch =
  | "warm-welcome"
  | "welcome-schedule-tbd"
  | "welcome-need-enrollment"
  | "low-pressure-undecided"
  | "no-email-not-interested"
  | "reschedule-no-show"
  | "reactivation-family-cancelled"
  | "reschedule-instructor-cancelled"
  | "unknown";

export interface BranchSuggestion {
  branch: EmailBranch;
  label: string;
  reasoning: string;
}

interface Recap {
  status: string | null;
  outcome: string | null;
  plannedStartDate: string | null;
  plannedSchedule: string[];
  eEnrollmentCompleted: boolean;
}

export function suggestBranch(r: Recap): BranchSuggestion {
  const s = r.status ?? "";
  const o = r.outcome ?? "";

  if (s === "Not Attended") {
    return {
      branch: "reschedule-no-show",
      label: "Sorry we missed you — let's reschedule",
      reasoning: "PO Status is Not Attended."
    };
  }
  if (s === "Family Cancelled") {
    return {
      branch: "reactivation-family-cancelled",
      label: "Reactivation — keep the door open",
      reasoning: "Family Cancelled — soft re-engagement, not pushy."
    };
  }
  if (s === "Instructor Cancelled") {
    return {
      branch: "reschedule-instructor-cancelled",
      label: "Apology + let's reschedule",
      reasoning: "Instructor Cancelled — we owe them a new PO."
    };
  }
  if (s === "Attended") {
    if (o === "Not Interested") {
      return { branch: "no-email-not-interested", label: "No email — close out gracefully", reasoning: "Outcome is Not Interested." };
    }
    if (o === "Undecided") {
      return { branch: "low-pressure-undecided", label: "Low-pressure summary, follow up when ready", reasoning: "Outcome is Undecided." };
    }
    const hasStart = !!r.plannedStartDate;
    const hasSchedule = r.plannedSchedule.length > 0;
    const eEnroll = r.eEnrollmentCompleted;
    if ((o === "Plan to Enroll" || o === "Enrolled") && hasStart && hasSchedule && eEnroll) {
      return {
        branch: "warm-welcome",
        label: "Warm welcome with starting point and routine",
        reasoning: "Outcome is Plan to Enroll/Enrolled, eEnrollment is completed, start date and schedule are set — all four conditions met."
      };
    }
    if (o === "Plan to Enroll" && hasStart && !hasSchedule) {
      return {
        branch: "welcome-schedule-tbd",
        label: "Welcome — start date confirmed, schedule TBD",
        reasoning: "Outcome is Plan to Enroll with a start date but no schedule yet."
      };
    }
    if ((o === "Plan to Enroll" || o === "Enrolled") && !hasStart) {
      return {
        branch: "welcome-need-enrollment",
        label: "Joining us — please complete enrollment + set start date",
        reasoning: "Outcome is Plan to Enroll / Enrolled but start date isn't set yet."
      };
    }
  }
  return { branch: "unknown", label: "Manual draft — no auto branch", reasoning: "State doesn't match any preset branch — write manually." };
}
