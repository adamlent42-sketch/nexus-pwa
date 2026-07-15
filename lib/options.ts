// Hardcoded option lists for singleSelect fields in Airtable.

export const STAFF_NAMES = ["Adam", "Jen", "Steve", "Myles", "Peter", "Kevin", "Alice"] as const;

export const ALERT_CATEGORIES = [
  "Academic help",
  "Schedule change",
  "Behavior",
  "Pickup/logistics",
  "Payments",
  "Other"
] as const;

export const NOTE_CATEGORIES = [
  "Academic focus",
  "Behavior/Engagement",
  "Worksheet pacing",
  "Test prep",
  "Other"
] as const;

export const EMAIL_TYPES = [
  "Routine Check-In",
  "Concern / Re-engagement",
  "Major Transition",
  "Schedule / Life Event",
  "Pre-Start Welcome",
  "Confirmation",
  "PO Follow-up",
  "Address Hesitation",
  "Reschedule Offer",
  "Win-back",
  "Subject Swap Offer",
  "Past Success Recap",
  "Quick Note",
  "Other"
] as const;

export type LifecycleBucket = "active" | "preStart" | "didNotEnroll" | "poMissed" | "winBack";

export function lifecycleBucket(lifecycle: string | null | undefined): LifecycleBucket {
  if (!lifecycle) return "active";
  if (lifecycle === "Active-Engaged" || lifecycle === "Active-At-Risk") return "active";
  if (lifecycle === "PO Booked" || lifecycle === "Pending Start" || lifecycle === "Pending Start State") return "preStart";
  if (
    lifecycle === "PO Attended - Did Not Enroll" ||
    lifecycle === "PO Attended - Plan to Enroll" ||
    lifecycle === "PO Attended - Undecided"
  ) return "didNotEnroll";
  if (lifecycle === "PO No-Show" || lifecycle === "PO Cancelled") return "poMissed";
  if (lifecycle === "Recently Discontinued" || lifecycle === "Long Lapsed" || lifecycle === "Reactivation Target" || lifecycle === "Historical") return "winBack";
  return "active";
}

export const EMAIL_TYPES_BY_BUCKET: Record<LifecycleBucket, string[]> = {
  active: ["Routine Check-In", "Concern / Re-engagement", "Major Transition", "Schedule / Life Event", "Other"],
  preStart: ["Pre-Start Welcome", "Confirmation", "Other"],
  didNotEnroll: ["PO Follow-up", "Address Hesitation", "Win-back", "Other"],
  poMissed: ["PO Follow-up", "Reschedule Offer", "Address Hesitation", "Other"],
  winBack: ["Win-back", "Subject Swap Offer", "Past Success Recap", "Other"]
};

export interface BucketFieldLabels {
  intro: string;
  field1: { label: string; hint: string };
  field2: { label: string; hint: string };
  field3: { label: string; hint: string };
  field4: { label: string; hint: string };
}

export const BUCKET_FIELD_LABELS: Record<LifecycleBucket, BucketFieldLabels> = {
  active: {
    intro: "Check-in on an actively-enrolled student.",
    field1: { label: "Notable in class", hint: "focus, engagement, breakthroughs, struggles" },
    field2: { label: "Family context to acknowledge", hint: "schedule, sibling, recent conversation" },
    field3: { label: "Concerns or topics to address", hint: "work resistance, attendance, parent concerns" },
    field4: { label: "Anything else", hint: "catch-all" }
  },
  preStart: {
    intro: "Pre-start nudge — warm them up before day one.",
    field1: { label: "What to expect", hint: "first-week routine, worksheet load, classroom feel" },
    field2: { label: "Family hook", hint: "sibling, schedule, what they told you at PO" },
    field3: { label: "Logistics to remind", hint: "first class day, pickup time, parking, what to bring" },
    field4: { label: "Anything else", hint: "catch-all" }
  },
  didNotEnroll: {
    intro: "PO follow-up — they attended but didn't sign. Sales-toned: confidence, school benefits, why Kumon fits THIS kid.",
    field1: { label: "PO Recap highlights", hint: "what stood out at the PO — recommended levels, observations, hooks (auto-filled if available)" },
    field2: { label: "Confidence-building angle", hint: "what gap or skill Kumon would address for this kid" },
    field3: { label: "What might tip them", hint: "address hesitation: cost, time, fit, sibling alignment" },
    field4: { label: "Anything else", hint: "catch-all" }
  },
  poMissed: {
    intro: "They missed or cancelled their PO. Warm, low-pressure reschedule offer.",
    field1: { label: "Why we should re-reach", hint: "is the lead still warm? specific date suggestion?" },
    field2: { label: "Family context", hint: "sibling, schedule, what they originally asked about" },
    field3: { label: "Address hesitation", hint: "common reasons families miss a PO — pre-empt their concern" },
    field4: { label: "Anything else", hint: "catch-all" }
  },
  winBack: {
    intro: "Re-engagement — reference past successes, talk subject swap, drive towards re-enrollment.",
    field1: { label: "Past achievements", hint: "what they accomplished — levels reached, milestones (auto-filled if available)" },
    field2: { label: "Subject swap idea", hint: "they did Math? pitch Reading. Or vice versa. Or both." },
    field3: { label: "Re-entry pitch", hint: "why now: school year, summer slide, sibling re-enrolling, etc." },
    field4: { label: "Anything else", hint: "catch-all" }
  }
};

export const TIME_OFF_TYPES = ["Planned Absence", "Sick", "Other"] as const;

export const PO_STATUSES = [
  "Scheduled",
  "Rescheduled",
  "Attended",
  "Not Attended",
  "Family Cancelled",
  "Instructor Cancelled"
] as const;

export const PO_OUTCOMES = ["Plan to Enroll", "Undecided", "Enrolled", "Not Interested"] as const;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_ALL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const STAFF_TIERS = ["1", "2", "3", "4", "5", "6"] as const;
export const STAFF_STATUSES = ["Active", "Departing", "Departed"] as const;
export const STAFF_ROLES = ["OL", "CL", "CA", "FA", "DE", "Prep AM"] as const;

export const PICKUP_DAYS = ["Monday", "Tuesday", "Thursday", "Saturday"] as const;

export const CLOSURE_REASONS = [
  "New Year's Day",
  "MLK Day",
  "Presidents Day",
  "Memorial Day",
  "Juneteenth",
  "July 4th",
  "Labor Day",
  "Columbus Day",
  "Veterans Day",
  "Thanksgiving",
  "Thanksgiving Break",
  "Christmas",
  "Winter Break",
  "Spring Break",
  "Mid-Winter Recess",
  "Inclement Weather",
  "Other"
] as const;

// Direct-edit option lists for the student edit form.
export const SUBJECTS = ["Math", "Reading"] as const;

export const GRADES = [
  "PreK", "PK1", "PK2", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"
] as const;

export const PAPER_CONNECT = ["Paper", "Kumon Connect"] as const;

// Full Lifecycle Stage option set (source of truth for where a student sits).
export const LIFECYCLE_STAGES = [
  "PO Booked",
  "Pending Start",
  "Pending Start State",
  "Active-Engaged",
  "Active-At-Risk",
  "PO Attended - Plan to Enroll",
  "PO Attended - Undecided",
  "PO Attended - Did Not Enroll",
  "PO No-Show",
  "PO Cancelled",
  "Recently Discontinued",
  "Long Lapsed",
  "Reactivation Target",
  "No Interest",
  "Historical",
  "Attended PO"
] as const;

export const CHANGE_REQUEST_TYPES = [
  "Edit Details",
  "Schedule Change",
  "Pickup Day Change",
  "Pause / Break",
  "Stop Enrollment",
  "Restart Enrollment",
  "Other"
] as const;
