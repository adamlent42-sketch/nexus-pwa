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
    admin/           <- Admin pages (Adam's dashboard)
    api/admin/       <- Admin API routes
    api/             <- Staff-facing API routes (check-in, instruction notes, etc.)
  lib/
    airtable.ts      <- Airtable client; base IDs and table IDs live here
    queries.ts       <- All Airtable read operations
    mutations.ts     <- All Airtable write operations
    outbox.ts        <- Email Outbox: enqueue logic (enqueuePoFollowup, etc.)
    email-branches.ts<- Post-PO follow-up branch logic (suggestBranch)
    email.ts         <- Gmail draft creation + email helpers
    po-lifecycle.ts  <- Lifecycle state machine (computeLifecycle)
    students.ts      <- Student data helpers
    growth.ts        <- Enrollment analytics and growth metrics
    outreach.ts      <- Lead/reactivation outreach logic
    scheduled-tasks.ts <- Scheduled task management
    curriculum.ts    <- Curriculum/level helpers (for Compass)
    kis.ts           <- KIS/ASHR benchmark logic
    options.ts       <- Shared option lists / enums
    schemas.ts       <- Zod schemas for API validation
    utils.ts         <- General utilities

Reference Library/   <- Kumon curriculum docs — READ BEFORE any instruction-planning work
  Compass_Student_Planning_Logic.md  <- THE planning rulebook (R1-R11)
  Instruction_Planning_Engine_Brief.md <- Compass vision + closed-loop architecture
  Curriculum Maps/Curriculum_Map_Detailed.md <- Block-by-block terrain + SCT bands
  WIG/WIG_Design_Intent_for_Compass.md <- What each curriculum block is building
  WIG/WIG_Math_Full_Extract.md / WIG_Reading_Full_Extract.md <- Per-level details

Communication_Engine_Build_Plan.md  <- Architecture spec for the email outbox engine
Enrollment_Growth_Playbook.md       <- Growth strategy and priorities
Punch_List.md                       <- Parked items and known bugs
email_signature.html                <- Append to ALL parent-facing emails
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
- `PO Confirmation` — at-booking confirmation LIVE
- `Post-PO Follow-up` — branch-aware follow-up after attended PO BUILT (needs worker branch + disable old task)
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
- `Status`: Pending -> Drafting -> Drafted -> Sent | Failed | Skipped
- `Dedupe Key`: e.g. `confirmation:<po_id>` — prevents double-sends
- `Context Notes`: JSON payload with all drafting context
- `Gmail Draft ID`: set after drafting
- `Job Type`: singleSelect (must match the list above exactly)

### Branch logic (Post-PO Follow-up)
`lib/email-branches.ts -> suggestBranch()` returns one of:
- `warm-welcome` — eEnroll done + start date + schedule set
- `welcome-schedule-tbd` — start date set, no schedule yet
- `welcome-need-enrollment` — Plan to Enroll, no start date
- `low-pressure-undecided` — Undecided outcome

The `_workerHint` field in Context Notes gives the worker branch-specific drafting instructions inline.

---

## Lifecycle ownership — IMPORTANT

**The app owns all lifecycle writes. Airtable automations must NOT write lifecycle fields.**

There is a known bug: an Airtable automation was overwriting `computeLifecycle` results on PO outcome changes. It should be disabled. `lib/po-lifecycle.ts -> computeLifecycle()` is the single source of truth.

Lifecycle stages (in order):
`Lead` -> `PO Scheduled` -> `PO Attended - Plan to Enroll` / `PO Attended - Undecided` / `PO Attended - Did Not Enroll` -> `Pending Start` -> `Active` -> `Discontinued` / `Long Lapsed`

**Start-date gate (added 7/1):** a family reaches `Pending Start` only once a **Planned Start Date** is set. Attended + Plan to Enroll with NO date stays in `PO Attended - Plan to Enroll` so `kumon-po-cadence-engine` keeps following up until a date is locked in; Attended + Undecided -> `PO Attended - Undecided`. `computeLifecycle(status, outcome, plannedStartDate)` now takes the start date as a third argument.

---

## Scheduled tasks (agents)

Scheduled tasks are Claude agents invoked on a cron schedule. Each task's prompt lives in a `SKILL.md` under `C:\Users\ALENT\OneDrive\Documents\Claude\Scheduled\<task-id>\`; the app mirrors them read-only for the health page at `/admin/scheduled-tasks` (`lib/scheduled-tasks.ts`).

**They actually run on Cowork** (Claude Cowork on Adam's always-on desktop) — registered there via `mcp__scheduled-tasks__create_scheduled_task` pointing at the SKILL.md path + a cron.

**Active tasks (do not disable without checking the Communication Engine plan):**
- `kumon-email-worker` — the drafting worker (core of the engine)
- `kumon-po-booking-detector` — detects new POs from HQ email -> enqueues confirmation
- `sync-po-parent-notes` — creates POs from Google Calendar events
- `kumon-po-day-before-reminder` — day-before reminder to parent + Adam digest
- `kumon-po-no-show-detector` — detects no-shows -> enqueues reschedule offer
- `kumon-po-family-cancelled-detector` — detects HQ cancellations -> enqueues winback
- `kumon-po-cadence-engine` — daily multi-touch follow-up brain for warm PO stages
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
- `kumon-comms-reconciliation` — stamps Last Contact, draft->sent
- `kumon-bounce-handler` — sets bounce flags
- `kumon-eenrollment-detector` — flips lifecycle on eEnrollment
- `kumon-po-attended-detector` — marks PO Attended
- `kumon-discontinue-aging` — lifecycle aging for discontinued students
- `kumon-ksis-ingester` — imports KSIS exports

**Already disabled:**
- `process-new-po-bookings` — superseded by outbox engine
- `process-po-outcomes` — superseded
- `kumon-cleanup-bogus-levels` — one-time cleanup, done
- `kumon-po-undecided-followup` — disabled 2026-07-01, superseded by `kumon-po-cadence-engine`

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
| `/admin/scheduled-day` | Class day view + Who's Here Now panel |
| `/admin/change-requests` | Student change requests |
| `/admin/missing-data` | Missing data flags |
| `/admin/qr-labels` | QR sticker generator + Dymo PNG download |

---

## Compass — Instruction Planning Engine (Phase 2, parked)

Compass is the planned student workplan planning system. It is NOT yet built in the codebase — it exists only in the Reference Library as a detailed spec.

**Key rules (R1-R11) — read the full spec before touching anything here:**
- R1: Locate & orient (position, direction, time-in-repeat)
- R2: Accuracy against the terrain (not a flat %) — is the missed skill the block's aim?
- R3: Speed from logged times only; Time 0 = missing, never slow
- R4: Ignore KSIS Level Study Plan colors
- R5: Full level coverage; WIG-based repetition; long-span reps for strong students
- R6: Trajectory-based repeats (no improvement 1->2 = intervene, not more reps)
- R7: Achievement Test drives promote-vs-repeat (needs AT entry screen — not yet built)
- R8: Observation notes are first-class signals
- R9: Push workload up when pace allows; alternate rotations must sum to multiples of 10
- R10: AT scheduling near end of level with runway to recover
- R11: Confidence gate — when ambiguous, ask Adam, don't guess

---

## Growth context

- **Current enrollment:** ~118 active students (as of mid-2026)
- **Target:** 225 enrollments ("Road to 225")
- **MRR target:** ~$37,000/month at 225 students x ~$165/subject
- **Key metric:** net flow = new starts - discontinues each month
- **Biggest churn window:** August (summer slide); November->January holiday cliff
- **Biggest enrollment window:** June-July summer
- **Top growth lever:** referral program (how Yunhee grew to ~290 with zero paid marketing)

---

## What NOT to do

- **Never auto-send emails.** All parent emails must go through Gmail drafts for Adam's review.
- **Never write lifecycle fields from Airtable automations.** The app owns lifecycle.
- **Never re-plan worksheets the student already has.** Compass rule: printed/handed-out worksheets are immutable.
- **Never infer student profile flags (EL/ADHD/autism) from data.** These are instructor-set only.
- **Never double-enqueue an Outbox job.** Always check the Dedupe Key before enqueuing.
- **Don't touch `kumon-po-day-before-reminder`** — it is not a duplicate of the confirmation.
- **Don't modify `lib/po-lifecycle.ts -> computeLifecycle()` casually** — it's the source of truth for all lifecycle transitions.

---

## Key open items

1. ~~Post-PO Follow-up worker branch~~ DONE 7/1.
2. **Airtable automation bug** — find and disable the automation overwriting lifecycle on PO outcome change
3. **Pending-Start Welcome coverage gap** — broaden targeting
4. **Billing reconciliation watchdog** — compare Airtable active kids vs Invoice Ninja recurring invoices
5. **One-click billing setup** — create IN client + invoice + recurring from onboarding checklist
6. **All-POs command center** — full-funnel PO board with inline action buttons
7. ~~Log a conversation feature~~ DONE 7/2.
8. ~~Duplicate student prevention~~ FIXED 7/2.
9. ~~Winback sent to rescheduled families~~ FIXED 7/2.
10. ~~Email worker first-name fix~~ DONE 7/2.
11. ~~**Attendance tracking**~~ DONE 8/12. Full attendance system built — see Attendance System section below.
12. **AT entry screen** — needed before Compass R7 (promote-vs-repeat) can run from system data
13. **Road to 225 scoreboard** — live enrollment count, net flow MoM, gap to target

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
| Attendance system | See Attendance System section below |

---

## Attendance System (built 8/12)

KNA-mandated student check-in/check-out system. Phase 1 hardware: existing front-desk laptop + USB barcode scanner. Staff-operated: staff scans the student's folder QR code at the kiosk and the screen confirms check-in/out.

### How it works

1. Each student folder gets a 2"x2" QR sticker (generated at `/admin/qr-labels`) encoding their Airtable record ID (`recXXXXXXXXXXXXXX`)
2. USB barcode scanner (HID keyboard mode) is connected to the front-desk laptop
3. `/kiosk` runs fullscreen in Chrome — captures all keystrokes, submits record IDs on Enter
4. `POST /api/checkin` determines direction (in vs out), calculates streak, checks milestones/birthday
5. `/display` on the TV shows a running clock for everyone currently checked in (neutral — no color coding kids can feel bad about)
6. `/admin/scheduled-day` now includes a **Who's Here Now** live panel with elapsed-time color coding (for staff view only: green < 45 min, yellow 45-75 min, red > 75 min)

### Key rules

- **Direction detection:** if the student has an open session today (no check-out) -> check-out; otherwise -> check-in
- **2-minute debounce:** same student scanned within 2 minutes -> ignored (prevents accidental double-scans)
- **Week definition:** Sunday-Saturday (ET timezone). A student attending at least once = the week counts toward streak
- **Streak logic:** `Last Attended Week` stores the YYYY-MM-DD of the week's Sunday. If consecutive Sunday -> streak++; gap -> reset to 1; same week -> no change (already counted)
- **Milestones:** 5, 10, 25, 50, 100 consecutive weeks -> kiosk shows a celebration splash + stores in `Milestone Triggered` field
- **Birthday week:** Sunday-Saturday window containing the student's birthday -> kiosk birthday splash, TV birthday banner
- **Nightly auto-close:** Vercel cron at 4am UTC (midnight ET) closes any open sessions with Method = "Auto-closed"
- **Subject-aware duration:** 1 subject ~20-30 min session; 2 subjects ~40-60 min. TV display doesn't color-code; staff Who's Here panel does

### Airtable schema

**AttendanceLog table** (`tblDxJU15EK03joFN`) — see `ATTENDANCE_FIELD` constants in `lib/airtable.ts`

Key fields: Student (link -> Students), Date, Check-In Time (ET), Check-Out Time (ET), Duration Minutes, Method (Scan/Manual/Auto-closed), Streak At Check-In, Session Number, Birthday Flag, Milestone Triggered, Observation fields (Completion/Focus/Progress/Notes), Flag Call Parent, Flag Add Instruction Note, Observation Added By

**Students table additions** (streak tracking) — see `STUDENT_ATTENDANCE_FIELD` in `lib/airtable.ts`:
- `Current Week Streak` (`fldT7pvYnRn8NuDkH`) — updated at each check-in
- `Longest Streak` (`fldD2VvRHgtiRLdz3`)
- `Total Lifetime Sessions` (`fldu3ePC7BloPEI5c`)
- `Last Attended Week` (`fld8Lb7yVwtt5SaEq`) — YYYY-MM-DD of the week's Sunday

### Routes and files

| Route / File | Purpose |
|---|---|
| `POST /api/checkin` | Core check-in/out logic — direction detection, streak, milestones, birthday |
| `GET /api/checkin/active` | Who's currently checked in (used by TV + Who's Here panel) |
| `GET /api/cron/checkin-auto-close` | Vercel cron at 4am UTC — closes open sessions |
| `POST /api/admin/checkin/auto-close` | Manual trigger for auto-close (admin use) |
| `PATCH /api/admin/checkin/observation` | Save observation note to an attendance record |
| `GET /api/admin/qr?id=recXXX&format=svg\|png\|dataurl` | Generate QR code image for a student |
| `GET /api/admin/students?lifecycle=active` | List active students (used by QR labels page) |
| `/kiosk` | Fullscreen scanner page (own layout, bypasses admin shell) |
| `/display` | TV ambient display — running clocks, birthday banner (own layout) |
| `/admin/qr-labels` | Generate + print QR sticker sheets; PNG download for Dymo template |
| `components/attendance/WhosHerePanel.tsx` | Live panel on /admin/scheduled-day |
| `components/attendance/ObservationModal.tsx` | Observation quick-entry modal |

### Phase 2 ideas (not built)

- Student-facing kiosk screen (currently staff-facing only)
- Second scanner / second kiosk for busy class days
- TV display subjects column once subjects are stored on AttendanceLog
- At-risk early warning: flag students with declining attendance streak
- Parent notification when student checks out (optional)

### QR label workflow

- `/admin/qr-labels` -> select students -> click "Print N labels" -> printable 4-per-row grid at 2"x2"
- Or: click "PNG" on any student -> downloads QR as PNG -> paste into existing Dymo LabelWriter 550 template
- QR encodes Airtable record ID (`recXXXXXXXXXXXXXX`) — stable forever (won't break on name change)
