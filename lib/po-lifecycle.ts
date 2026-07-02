// Shared computation: given a PO's Status + Outcome, what Student Lifecycle
// Stage should the linked students move to once the recap is closed out?
// Returns null when no move applies (Instructor Cancelled, Scheduled, Rescheduled).

export function computeLifecycle(status: string | null, outcome: string | null): string | null {
  if (!status) return null;
  if (status === "Family Cancelled" || status === "Not Attended") {
    return "PO No-Show";
  }
  if (status === "Attended") {
    switch (outcome) {
      case "Plan to Enroll": return "Pending Start";
      // Legacy/safety net: an "Enrolled" recap should NOT jump straight to
      // active — route it through the onboarding pipeline like Plan to Enroll.
      // A student becomes Active-Engaged only when their first class is marked
      // attended (the "Arrived" button / mark-first-class route).
      case "Enrolled":       return "Pending Start";
      case "Not Interested": return "PO Attended - Did Not Enroll";
      case "Undecided":      return "PO Attended - Did Not Enroll";
      default:               return null;
    }
  }
  return null;
}

// Returns true if a recap with this status should auto-finalize (skip owner queue).
// No-show / family-cancelled outcomes are deterministic — no email branch to pick,
// no fields to polish — so flip straight to Reviewed.
export function shouldAutoFinalize(status: string | null): boolean {
  return status === "Not Attended" || status === "Family Cancelled";
}
