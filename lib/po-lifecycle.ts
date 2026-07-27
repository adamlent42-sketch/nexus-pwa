// Shared computation: given a PO's Status + Outcome (+ planned start date), what
// Student Lifecycle Stage should the linked students move to once the recap is
// submitted? Returns null when no move applies (Instructor Cancelled, Scheduled,
// Rescheduled).
//
// All recaps finalize immediately on submission — no owner review queue. Staff
// recaps are trusted; Adam can review history in Admin → PO Recaps at any time.
//
// A planned start date is what earns "Pending Start". A family who attended and
// plans to enroll but hasn't picked a start date is NOT pending-start yet — they
// stay in "PO Attended - Plan to Enroll" so the PO Cadence Engine keeps following
// up (day 0/3/7/14) until a date is set. Without this gate, date-less families
// landed in "Pending Start", where every downstream email keys off First Class
// Date and therefore never fired — the silent "trap" (see Communication Engine
// Build Plan). Undecided attended families get their own stage too, so the cadence
// engine can run the hot Undecided sequence instead of collapsing them into the
// cold reactivation pool.
export function computeLifecycle(
  status: string | null,
  outcome: string | null,
  plannedStartDate?: string | null
): string | null {
  if (!status) return null;
  if (status === "Not Attended") return "PO No-Show";
  if (status === "Family Cancelled") return "PO Cancelled";
  if (status === "Attended") {
    switch (outcome) {
      // A start date is the gate into Pending Start. No date → keep following up.
      case "Plan to Enroll": return plannedStartDate ? "Pending Start" : "PO Attended - Plan to Enroll";
      // "Enrolled" means they signed — route it through onboarding like Plan to
      // Enroll. A student becomes Active-Engaged only when their first class is
      // marked attended (the "Arrived" button / mark-first-class route).
      case "Enrolled":       return "Pending Start";
      // Not Interested → No Interest so outreach stops entirely.
      case "Not Interested": return "No Interest";
      // Undecided → its own stage so the cadence engine runs the hot sequence.
      case "Undecided":      return "PO Attended - Undecided";
      default:               return null;
    }
  }
  return null;
}
