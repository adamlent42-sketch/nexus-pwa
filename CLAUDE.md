# CLAUDE.md — Kumon CRM & Operations System

**Center:** Wappingers Falls Kumon (owner: Adam Lent, adamlent@ikumon.com)  
**Goal:** Replace manual center management with an agentic system — automated email drafting, enrollment pipeline management, retention monitoring, and instruction planning — with Adam reviewing and approving, not doing the work.

---

## Backup & version control

- **GitHub repo:** https://github.com/adamlent42-sketch/kumon-pwa (private)
- **Automatic backup:** Windows Task Scheduler runs `backup.bat` every night at 3am — commits all changes and pushes to GitHub
- **Manual backup:** run `git add . && git commit -m "message" && git push` from the `kumon-pwa/` folder
- **To roll back:** `git log --oneline` to find the commit, then `git checkout <commit-hash> -- <file>` to restore a specific file
- If Claude Code makes a change you don't want, `git diff` shows exactly what changed and `git restore <file>` undoes it
- **Git email / Vercel *(fixed 7/2)*:** Commits must use an email that's verified in the GitHub account (`adamlent42-sketch`). Both `adamlent42@gmail.com` and `adamlent@ikumon.com` are now added and verified. If Vercel starts blocking deployments again, check `git log --format="%ae" -1` — the author email must match a verified GitHub email. Global git config: `git config --global user.email "adamlent@ikumon.com"`.

---

## What this system is

A custom operations platform for running a Kumon learning center. It replaces a mix of spreadsheets, KSIS (Kumon's franchisor system), and manual email with:

- A **Next.js PWA** (`kumon-pwa/`) — Adam's primary admin interface, deployed on Vercel
- **Airtable** — the source of truth for students, families, POs, and the email outbox
- **~30+ Claude scheduled tasks** — agents that detect events, draft emails, and run nightly digests
- **Gmail** — all parent emails are drafted as Gmail drafts; Adam reviews and sends
- **Google Calendar** — Parent Orientation (PO) appointments are created here; synced into Airtable
- **Invoice Ninja** — billing (read-only token today; write token needed for automation)
- **KSIS** — Kumon's franchisor system; used for Report B, achievement tests, and worksheet scoring. We export from it; we don't write to it (except future Compass plans)

---

## Tech stack

- **Framework:** Next.js 14+ App Router, TypeScript, Tailwind CSS
- **Database:** Airtable (via REST API — `lib/airtable.ts`)
- **Email:** Gmail API — all parent-facing emails created as drafts, never auto-sent
- **AI:** Anthropic Claude API — scheduled tasks are Claude agents (`lib/scheduled-tasks.ts`)
- **Billing:** Invoice Ninja (`lib/invoice-ninja.ts`)
- **Deploy:** Vercel

---

## Project structure

```
kumon-pwa/
  app/
    admin/           ← Admin pages (Adam's dashboard)
    api/admin/       ← Admin API routes
    api/             ← Staff-facing API routes (check-in, instruction notes, etc.)
  lib/
    airtable.ts      ← Airtable client; base IDs and table IDs live here
    queries.ts       ← All Airtable read operations
    mutations.ts     ← All Airtable write operations
    outbox.ts        ← Email Outbox: enqueue logic (enqueuePoFollowup, etc.)
    email-branches.ts← Post-PO follow-up branch logic (suggestBranch)
    email.ts         ← Gmail draft creation + email helpers
    po-lifecycle.ts  ← Lifecycle state machine (computeLifecycle)
    students.ts      ← Student data helpers
    growth.ts        ← Enrollment analytics and growth metrics
    outreach.ts      ← Lead/reactivation outreach logic
    scheduled-tasks.ts ← Scheduled task management
    curriculum.ts    ← Curriculum/level helpers (for Compass)
    kis.ts           ← KIS/ASHR benchmark logic
    options.ts       ← Shared option lists / enums
    schemas.ts       ← Zod schemas for API validation
    utils.ts         ← General utilities

Reference Library/   ← Kumon curriculum docs — READ BEFORE any instruction-planning work
  Compass_Student_Planning_Logic.md  ← THE planning rulebook (R1–R11)
  Instruction_Planning_Engine_Brief.md ← Compass vision + closed-loop architecture
  Curriculum Maps/Curriculum_Map_Detailed.md ← Block-by-block terrain + SCT bands
  WIG/WIG_Design_Intent_for_Compass.md ← What each curriculum block is building
  WIG/WIG_Math_Full_Extract.md / WIG_Reading_Full_Extract.md ← Per-level details

Communication_Engine_Build_Plan.md  ← Architecture spec for the email outbox engine
Enrollment_Growth_Playbook.md       ← Growth strategy and priorities
Punch_List.md                       ← Parked items and known bugs
email_signature.html                ← Append to ALL parent-facing emails
```

---

## The Communication Engine (most active build area)

The core of the automated operations. Every outbound parent email is managed as a row in the **Airtable "Email Outbox" table**.

### How it works
1. **Triggers** (scheduled tasks or app actions) detect an event and **enqueue an Outbox row** with a Job Type, linked Student/Family/PO, and a JSON `Context Notes` payload
2. **The drafting worker** (`kumon-email-worker` scheduled task) wakes on a cadence, pulls all `Status = Pending` rows, gathers student context from Airtable + the Reference Library, drafts a personalized email via Claude, creates a Gmail draft, and sets `Status = Drafted`
3. **Adam reviews** Gmail drafts and sends or edits
4. **The watchdog** monitors for stuck/failed rows and alerts Adam

### Outbox Job Types (current)
- `PO Confirmation` — at-booking confirmation ✅ LIVE
- `Post-PO Follow-up` — branch-aware follow-up after attended PO ✅ BUILT (needs worker branch + disable old task)
- `Reschedule Confirmation` — after reschedule
- `No-Show Reschedule` — offer to reschedule after no-show
- `Family-Cancelled Winback` — gentle come-back after cancellation
- `Pending-Start Welcome` — 7 days pre-start
- `Achievement Test` — after progress events
- `Update Email` — personalized progress update
- `On-Demand Outreach` — button-triggered outreach
- `Long-Lapsed Reactivation` — 90-day lapsed families
- `Reactivation` — Target / Did-Not-Enroll / No-Show

### Key outbox fields
- `Status`: Pending → Drafting → Drafted → Sent | Failed | Skipped
- `Dedupe Key`: e.g. `confirmation:<po_id>` — prevents double-sends
- `Context Notes`: JSON payload with all drafting context
- `Gmail Draft ID`: set after drafting
- `Job Type`: singleSelect (must match the list above exactly)

### Branch logic (Post-PO Follow-up)
`lib/email-branches.ts → suggestBranch()` returns one of:
- `warm-welcome` — eEnroll done + start date + schedule set
- `welcome-schedule-tbd` — start date set, no schedule yet
- `welcome-need-enrollment` — Plan to Enroll, no start date
- `low-pressure-undecided` — Undecided outcome

The `_workerHint` field in Context Notes gives the worker branch-specific drafting instructions inline.

---

## Lifecycle ownership — IMPORTANT

**The app owns all lifecycle writes. Airtable automations must NOT write lifecycle fields.**

There is a known bug: an Airtable automation was overwriting `computeLifecycle` results on PO outcome changes. It should be disabled. `lib/po-lifecycle.ts → computeLifecycle()` is the single source of truth.

Lifecycle stages (in order):
`Lead` → `PO Scheduled` → `PO Attended – Plan to Enroll` / `PO Attended – Undecided` / `PO Attended – Did Not Enroll` → `Pending Start` → `Active` → `Discontinued` / `Long Lapsed`

**Start-date gate (added 7/1):** a family reaches `Pending Start` only once a **Planned Start Date** is set. Attended + Plan to Enroll with NO date stays in `PO Attended – Plan to Enroll` so `kumon-po-cadence-engine` keeps following up until a date is locked in; Attended + Undecided → `PO Attended – Undecided`. `computeLifecycle(status, outcome, plannedStartDate)` now takes the start date as a third argument. This closed the "trap" where date-less Plan-to-Enroll families sat silently in Pending Start (every downstream email keys off First Class Date, so none ever fired).

---

## Scheduled tasks (agents)

Scheduled tasks are Claude agents invoked on a cron schedule. Each task's prompt lives in a `SKILL.md` under `C:\Users\ALENT\OneDrive\Documents\Claude\Scheduled\<task-id>\`; the app mirrors them read-only for the health page at `/admin/scheduled-tasks` (`lib/scheduled-tasks.ts`).

**They actually run on Cowork** (Claude Cowork on Adam's always-on desktop) — registered there via `mcp__scheduled-tasks__create_scheduled_task` pointing at the SKILL.md path + a cron. A regular Claude Code session is NOT the Cowork host, so it can author/edit SKILL files but cannot register, disable, or run them.

**To actually enable/disable a task, flip its enabled flag in Cowork** (`update_scheduled_task`) — editing the SKILL.md frontmatter description to say "DISABLED" is cosmetic and does NOT stop the cron. Cowork may also hold an inline copy of the prompt, so edits to a SKILL.md prompt need re-syncing into the Cowork task; cadence *numbers* live in the Airtable Outreach Cadences table (read at runtime), so retuning them needs no re-registration.

**Active tasks (do not disable without checking the Communication Engine plan):**
- `kumon-email-worker` — the drafting worker (core of the engine)
- `kumon-po-booking-detector` — detects new POs from HQ email → enqueues confirmation
- `sync-po-parent-notes` — creates POs from Google Calendar events → must also enqueue confirmation
- `kumon-po-day-before-reminder` — day-before reminder to parent + Adam digest (NOT a duplicate of confirmation)
- `kumon-po-no-show-detector` — detects no-shows → enqueues reschedule offer
- `kumon-po-family-cancelled-detector` — detects HQ cancellations → enqueues winback
- `kumon-po-cadence-engine` — daily multi-touch follow-up brain for every warm PO stage (Plan-to-Enroll-no-date, Undecided, No-Show, Cancelled). Reads the **Outreach Cadences** table for each stage's escalating sequence, enqueues the next due touch, reads replies to stop (No → No Interest; Yes → flag Adam to confirm start date; ambiguous → pause), graduates exhausted sequences to Reactivation Target. Enqueue + lifecycle + Adam digest only.
- `kumon-pending-start-welcome` — 7-day pre-start welcome
- `kumon-achievement-test-drafts` — achievement test result emails
- `kumon-update-email-drafts` — personalized update emails
- `kumon-on-demand-outreach` — button-triggered outreach
- `kumon-long-lapsed-daily` — long lapsed reactivation
- `kumon-reactivation-engine` — weekly reactivation for Target/DNE/No-Show
- `kumon-stale-contact-watcher` — morning digest of stale contacts
- `kumon-stalled-enrollment-call-list` — call list for stalled enrollments
- `kumon-inbound-reply-logger` — logs parent replies
- `kumon-outbound-reply-logger` — logs Adam's sent mail
- `kumon-comms-reconciliation` — stamps Last Contact, draft→sent
- `kumon-bounce-handler` — sets bounce flags
- `kumon-eenrollment-detector` — flips lifecycle on eEnrollment
- `kumon-po-attended-detector` — marks PO Attended
- `kumon-discontinue-aging` — lifecycle aging for discontinued students
- `kumon-ksis-ingester` — imports KSIS exports

**Already disabled:**
- `process-new-po-bookings` — superseded by outbox engine
- `process-po-outcomes` — superseded
- `kumon-cleanup-bogus-levels` — one-time cleanup, done
- `kumon-po-undecided-followup` — **disabled 2026-07-01**, superseded by `kumon-po-cadence-engine` (runs the multi-touch Undecided sequence). Do not re-enable — would double-email undecided families.

---

## Admin pages (kumon-pwa)

| Route | Purpose |
|---|---|
| `/admin` | Home dashboard — attention items, coverage snapshot |
| `/admin/students` | Student Manager — search, filter, lifecycle |
| `/admin/po-recaps` | PO recap entry and approval queue |
| `/admin/outbox` | Email Outbox view — status by job type, failures |
| `/admin/scheduled-tasks` | Scheduled task health monitor |
| `/admin/onboarding` | Student onboarding checklist (post-enrollment steps) |
| `/admin/upcoming-starts` | Students starting soon |
| `/admin/student-outreach` | Lead follow-up and outreach queue |
| `/admin/growth` | Enrollment growth metrics, Road to 225 |
| `/admin/instruction-notes` | Instruction notes for staff |
| `/admin/compose` | On-demand email compose |
| `/admin/staff` | Staff management |
| `/admin/time-off` | Staff time-off requests |
| `/admin/breaks` | Student break management |
| `/admin/closures` | Center closure planning |
| `/admin/training` | Staff training modules |
| `/admin/scheduled-day` | Class day view |
| `/admin/change-requests` | Student change requests |
| `/admin/missing-data` | Missing data flags |

---

## Compass — Instruction Planning Engine (Phase 2, parked)

Compass is the planned student workplan planning system. It is NOT yet built in the codebase — it exists only in the Reference Library as a detailed spec.

**What it will do:** ingest per-worksheet scores and times from KSIS (replacing the KSIS Score Card export), apply the planning rules in `Compass_Student_Planning_Logic.md`, propose each student's optimal next 2-week workplan, and present it to Adam for review/approval. Overrides are captured as training signal.

**Key rules (R1–R11) — read the full spec before touching anything here:**
- R1: Locate & orient (position, direction, time-in-repeat)
- R2: Accuracy against the terrain (not a flat %) — is the missed skill the block's aim?
- R3: Speed from logged times only; Time 0 = missing, never slow
- R4: Ignore KSIS Level Study Plan colors
- R5: Full level coverage; WIG-based repetition; long-span reps for strong students
- R6: Trajectory-based repeats (no improvement 1→2 = intervene, not more reps)
- R7: Achievement Test drives promote-vs-repeat (needs AT entry screen — not yet built)
- R8: Observation notes are first-class signals
- R9: Push workload up when pace allows; alternate rotations must sum to multiples of 10
- R10: AT scheduling near end of level with runway to recover
- R11: Confidence gate — when ambiguous, ask Adam, don't guess

**Strategic note:** Once Compass is built, the plan is to ask KNA to drop to KSIS Lite and use KSIS only for Report B and franchise fees.

---

## Growth context

- **Current enrollment:** ~118 active students (as of mid-2026)
- **Target:** 225 enrollments ("Road to 225")
- **MRR target:** ~$37,000/month at 225 students × ~$165/subject
- **Key metric:** net flow = new starts − discontinues each month
- **Biggest churn window:** August (summer slide); November→January holiday cliff
- **Biggest enrollment window:** June–July summer
- **Top growth lever:** referral program (how Yunhee grew to ~290 with zero paid marketing)

---

## What NOT to do

- **Never auto-send emails.** All parent emails must go through Gmail drafts for Adam's review. The `email.ts` creates drafts; it does not send.
- **Never write lifecycle fields from Airtable automations.** The app owns lifecycle. If you see an Airtable automation touching lifecycle/stage fields, flag it and disable it.
- **Never re-plan worksheets the student already has.** Compass rule: printed/handed-out worksheets are immutable.
- **Never infer student profile flags (EL/ADHD/autism) from data.** These are instructor-set only.
- **Never double-enqueue an Outbox job.** Always check the Dedupe Key before enqueuing.
- **Don't touch `kumon-po-day-before-reminder`** — it is not a duplicate of the confirmation; it sends a distinct day-before reminder.
- **Don't modify `lib/po-lifecycle.ts → computeLifecycle()` casually** — it's the source of truth for all lifecycle transitions and bugs here cause cascading data corruption.

---

## Key open items (from Punch List as of July 2026)

1. ~~**Post-PO Follow-up worker branch** — add to `kumon-email-worker`, then disable `kumon-po-undecided-followup`~~ ✅ **DONE 7/1.** Branch live; `kumon-po-undecided-followup` disabled and superseded by the new `kumon-po-cadence-engine` (multi-touch follow-up for all warm PO stages, reply-aware stop, graduation to reactivation). Cadence lives in the **Outreach Cadences** Airtable table.
2. **Airtable automation bug** — find and disable the automation overwriting lifecycle on PO outcome change (corrupted Emerie Fobi + Zane Cadogan records)
3. **Pending-Start Welcome coverage gap** — broaden targeting to all students with first-class date 7 days out, not just "Pending Start State"; add conditional eEnrollment nudge
4. **Billing reconciliation watchdog** — compare Airtable active kids vs Invoice Ninja recurring invoices; surface mismatches
5. **One-click billing setup** — create IN client + invoice + recurring from onboarding checklist (needs write-enabled IN token + rate card from Adam)
6. **All-POs command center** — full-funnel PO board with inline action buttons and stall flags
7. ~~**Log a conversation feature**~~ ✅ **DONE 7/2.** Phone call / in-person conversation logging wired end-to-end: `POST /api/admin/log-conversation` creates a Communications record, stamps Last Contact Date + Type directly on the student, and prepends a summary line to the Family's Relationship Summary so the email worker picks it up next draft. Button lives in `components/ActionRow.tsx` (main dashboard) + `app/admin/page.tsx`. Modal: `components/forms/LogConversationModal.tsx`, wired through `components/forms/FormsProvider.tsx`.
8. ~~**Duplicate student prevention**~~ ✅ **FIXED 7/2.** Root cause: `kumon-po-booking-detector` and `sync-po-parent-notes` were using filtered Airtable queries that failed silently, creating duplicate student records (e.g., Bryson Jordan). Both tasks updated to read the Family's Students link field (`fldihw7hV6lbtY70p`) directly, fetch existing records by ID, and compare first names case-insensitively before creating a new student. Bryson Jordan's duplicate merged manually.
9. ~~**Winback sent to rescheduled families**~~ ✅ **FIXED 7/2.** `kumon-gmail-detector-bundle` Job 3 now checks if the family has any future-dated PO before enqueuing a Family-Cancelled Winback. If a future PO exists, winback is suppressed with a log note. Prevents the Prenita Kaner scenario (HQ cancels old slot, family already rebooked, winback fires anyway).
10. ~~**Email worker first-name fix**~~ ✅ **DONE 7/2.** `kumon-email-worker` updated: always use First Name field (`fldTPVhwDfZeGk9IS`), never Student Name. For Post-PO Follow-up, `studentName` in Context Notes may be a full name — use only the first word.
7. **Attendance tracking** — prerequisite for at-risk early warning; confirm if per-class attendance is captured anywhere
8. **AT entry screen** — needed before Compass R7 (promote-vs-repeat) can run from system data
9. **Road to 225 scoreboard** — live enrollment count, net flow MoM, gap to target, projected date

---

## Reference files to read before specific work

| Task | Read first |
|---|---|
| Any email drafting / outbox work | `Communication_Engine_Build_Plan.md` + `email_signature.html` |
| Compass / instruction planning | `Reference Library/Compass_Student_Planning_Logic.md` + `Instruction_Planning_Engine_Brief.md` |
| Curriculum block decisions | `Reference Library/Curriculum Maps/Curriculum_Map_Detailed.md` |
| WIG / observation points | `Reference Library/WIG/WIG_Design_Intent_for_Compass.md` |
| Growth / enrollment analytics | `Enrollment_Growth_Playbook.md` |
| Parked items / known bugs | `Punch_List.md` |
| Student lifecycle | `lib/po-lifecycle.ts` |
| Airtable schema | `lib/airtable.ts` + `lib/queries.ts` |
