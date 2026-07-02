// Static registry of every Claude scheduled task that powers Kumon ops.
// Kept here so the Admin -> Scheduled tasks page can show what's running,
// how often, and how many Airtable rows are currently waiting for each task.
//
// Source of truth for cron schedules is the user's Scheduled folder
// (C:\Users\ALENT\OneDrive\Documents\Claude\Scheduled\*). Update both places
// when you add/rename/disable a task.

export interface ScheduledTaskConfig {
  taskId: string;
  label: string;          // human-friendly name for the page
  description: string;    // one-line "what it does"
  schedule: string;       // human-readable cron summary
  enabled: boolean;
  category: "po" | "outreach" | "drafts" | "ingest" | "hygiene" | "other";
  // Optional Airtable count function: when set, the API will return the
  // number of rows currently waiting to be processed.
  pendingCountSource?:
    | "update-email-requests"
    | "progress-events-pending-draft"
    | "draft-outreach-requested"
    | "pending-start-no-welcome";
}

export const SCHEDULED_TASKS: ScheduledTaskConfig[] = [
  // ===== Drafts (these are the ones Adam cares about most) =====
  {
    taskId: "kumon-update-email-drafts",
    label: "Update email drafts",
    description: "Drafts the personalized Update Email Requests from the form. Nightly at 10:41 PM ET.",
    schedule: "Nightly · 10:41 PM ET",
    enabled: true,
    category: "drafts",
    pendingCountSource: "update-email-requests"
  },
  {
    taskId: "kumon-achievement-test-drafts",
    label: "Achievement test drafts",
    description: "Drafts achievement-test emails for new Progress Events. Nightly at 10:36 PM ET.",
    schedule: "Nightly · 10:36 PM ET",
    enabled: true,
    category: "drafts",
    pendingCountSource: "progress-events-pending-draft"
  },
  {
    taskId: "kumon-on-demand-outreach",
    label: "On-demand outreach drafts",
    description: "Drafts personalized outreach for students with 'Draft Outreach Requested' checked.",
    schedule: "Nightly · 11:05 PM ET",
    enabled: true,
    category: "drafts",
    pendingCountSource: "draft-outreach-requested"
  },
  {
    taskId: "kumon-pending-start-welcome",
    label: "Pending-start welcome drafts",
    description: "Drafts a welcome email 7 days before each Pending Start student's first class.",
    schedule: "Nightly · 10:30 PM ET",
    enabled: true,
    category: "drafts",
    pendingCountSource: "pending-start-no-welcome"
  },
  {
    taskId: "kumon-po-undecided-followup",
    label: "PO Undecided follow-up drafts",
    description: "Drafts thank-you / follow-up emails for Attended + Undecided POs.",
    schedule: "Nightly · 11:02 PM ET",
    enabled: true,
    category: "drafts"
  },
  {
    taskId: "kumon-long-lapsed-daily",
    label: "Long Lapsed daily reactivation",
    description: "Drafts up to 15 reactivation emails to Long Lapsed students nightly (90-day cooldown).",
    schedule: "Nightly · 10:54 PM ET",
    enabled: true,
    category: "drafts"
  },
  {
    taskId: "kumon-reactivation-engine",
    label: "Weekly reactivation engine",
    description: "Mondays: ~45 reactivation drafts for Reactivation Target / PO Did Not Enroll / PO No-Show.",
    schedule: "Weekly · Monday 8:04 AM ET",
    enabled: true,
    category: "drafts"
  },

  // ===== PO lifecycle (Gmail watchers) =====
  {
    taskId: "kumon-po-booking-detector",
    label: "PO booking detector",
    description: "Watches Gmail for new PO bookings from Kumon HQ, creates Airtable rows, drafts parent confirmation.",
    schedule: "3x daily · 5:46 AM / 1:46 PM / 9:46 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-po-attended-detector",
    label: "PO attended detector",
    description: "Detects 'Thank You for Attending' emails, marks POs as Attended.",
    schedule: "3x daily · 5:39 AM / 1:39 PM / 9:39 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-po-no-show-detector",
    label: "PO no-show detector",
    description: "Detects 'We Missed You' no-show emails, marks POs Not Attended, drafts reschedule email.",
    schedule: "3x daily · 6:00 AM / 2:00 PM / 10:00 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-po-family-cancelled-detector",
    label: "PO family-cancelled detector",
    description: "Detects parent cancellation emails, flips PO to Family Cancelled, drafts gentle follow-up.",
    schedule: "3x daily · 6:03 AM / 2:03 PM / 10:03 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-po-day-before-reminder",
    label: "PO day-before reminder",
    description: "Alerts Adam about tomorrow's POs and drafts confirmation emails to each family.",
    schedule: "Nightly · 10:18 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-eenrollment-detector",
    label: "eEnrollment detector",
    description: "Detects eEnrollment confirmation emails, flips students to Pending Start State, marks PO Enrolled.",
    schedule: "3x daily · 5:24 AM / 1:24 PM / 9:24 PM ET",
    enabled: true,
    category: "po"
  },
  {
    taskId: "kumon-po-not-interested-handler",
    label: "PO Not Interested handler",
    description: "When a PO finalizes with Outcome=Not Interested, moves the student to 'No Interest' lifecycle.",
    schedule: "Nightly · 10:56 PM ET",
    enabled: true,
    category: "po"
  },

  // ===== Communication hygiene =====
  {
    taskId: "kumon-inbound-reply-logger",
    label: "Inbound reply logger",
    description: "Auto-logs parent emails as Inbound Communications, flags opt-outs.",
    schedule: "3x daily · 5:06 AM / 1:06 PM / 9:06 PM ET",
    enabled: true,
    category: "hygiene"
  },
  {
    taskId: "kumon-outbound-reply-logger",
    label: "Outbound reply logger",
    description: "Logs Adam's sent emails as Outbound Communications, clears Awaiting Reply flags.",
    schedule: "Daily · 1:08 PM ET",
    enabled: true,
    category: "hygiene"
  },
  {
    taskId: "kumon-comms-reconciliation",
    label: "Comms reconciliation",
    description: "When a Gmail draft is actually sent, flips its Communications row Draft → Sent.",
    schedule: "2x daily · 1:01 PM / 9:01 PM ET",
    enabled: true,
    category: "hygiene"
  },
  {
    taskId: "kumon-bounce-handler",
    label: "Bounce handler",
    description: "Watches mailer-daemon bounces, flags dead email addresses on Family records.",
    schedule: "3x daily · 5:44 AM / 1:44 PM / 9:44 PM ET",
    enabled: true,
    category: "hygiene"
  },
  {
    taskId: "kumon-stale-contact-watcher",
    label: "Stale-contact watcher",
    description: "Nightly audit of overdue students; drafts a morning digest for Adam.",
    schedule: "Nightly · 10:02 PM ET",
    enabled: true,
    category: "outreach"
  },

  // ===== KSIS + ingest =====
  {
    taskId: "kumon-ksis-export-reminder",
    label: "KSIS export reminder",
    description: "Friday morning reminder to run KSIS exports and drop them in chat.",
    schedule: "Weekly · Friday 9:08 AM ET",
    enabled: true,
    category: "ingest"
  },
  {
    taskId: "kumon-ksis-ingester",
    label: "KSIS ingester",
    description: "Monday afternoon: parses KSIS export drops, updates Progress Events + Students.",
    schedule: "Weekly · Monday 3:06 AM ET",
    enabled: true,
    category: "ingest"
  },

  // ===== Lifecycle hygiene =====
  {
    taskId: "kumon-discontinue-aging",
    label: "Discontinue aging",
    description: "Ages Recently Discontinued (>90 days) to Reactivation Target. Currently disabled.",
    schedule: "Daily · 6:09 AM ET",
    enabled: false,
    category: "hygiene"
  },
  {
    taskId: "kumon-coverage-snapshot",
    label: "Coverage snapshot",
    description: "Weekly snapshot of outreach coverage metrics for trend charts.",
    schedule: "Weekly · Monday 6:10 AM ET",
    enabled: true,
    category: "hygiene"
  },

  // ===== Legacy / disabled =====
  {
    taskId: "process-new-po-bookings",
    label: "Process new PO bookings (legacy)",
    description: "Superseded by kumon-po-booking-detector. Disabled.",
    schedule: "Was: 7:02 AM every 2 hours",
    enabled: false,
    category: "other"
  },
  {
    taskId: "process-po-outcomes",
    label: "Process PO outcomes (legacy)",
    description: "Superseded by attended/no-show/family-cancelled detectors. Disabled.",
    schedule: "Was: 8:03 AM every 2 hours",
    enabled: false,
    category: "other"
  }
];
