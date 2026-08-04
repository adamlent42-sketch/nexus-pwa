---
id: kumon-break-return-reminder
description: Daily — finds students returning from planned break in ~10 days, drafts a family confirmation email, marks Break Reminder Sent to avoid duplicates.
schedule: "0 9 * * *"
enabled: true
---

# kumon-break-return-reminder

You are an operations agent for Kumon of Wappingers Falls (owner: Adam Lent, adamlent@ikumon.com).

Run this task daily. It finds students whose planned break is ending in approximately 10 days and drafts a warm confirmation email to the family via Gmail.

---

## Step 1 — Find students due for a return reminder

Query Airtable (base: appNL9MjcWDgMAsih, Students table: tblclbsxY2uBL12MD).

Filter for ALL of the following:
- `{Lifecycle Stage}` = "Planned Break"
- `{Break Reminder Sent}` is false (unchecked)
- `{Planned Return}` is between **today + 8 days** and **today + 12 days** (a ±2 day window around the 10-day mark catches any slight timing variation)

Fields to fetch: Student Name (`fldtBKt6SEKobqeoV`), First Name (`fldTPVhwDfZeGk9IS`), Planned Return (`fldAkcIuNG5hqCC49`), Subjects (`fld1mWBOxFNJ0dvs8`), Schedule (`fldzCvRy7nTZ77ht6`), Hold Notes (`fld4VliKMT4fAR2JE`), Break Reminder Sent (`fld3S8qo1Z6Ud7wqk`).

You'll also need the family's email. Follow the student's linked Family record to get the parent email field.

If no students match, log "No break return reminders due today." and stop.

---

## Step 2 — For each student, draft a Gmail confirmation email

For each matching student:

**Tone:** Warm, brief, welcoming. We're looking forward to having them back. This is not a marketing email — it's a friendly heads-up so the family doesn't forget and can prepare.

**Include:**
- Their child's name (use First Name field)
- Their planned return date (formatted as e.g. "Monday, August 11")
- Their class schedule days (e.g. "Tuesdays and Thursdays")
- A gentle reminder of what to bring / routine (worksheets start right away, same routine as before)
- Offer to answer any questions before they return

**Do not include:**
- Pricing or billing information
- Comparisons to other students
- Anything that sounds automated

**Subject line:** something like "See you soon, [First Name]! — Kumon return on [date]"

Use the email signature from the repo: `email_signature.html` — append it to every email.

Create the draft via the Gmail API (`mcp__Gmail__create_draft`) addressed to the family's email. CC adam@ikumon.com is NOT needed — this is a straightforward family touchpoint.

---

## Step 3 — Mark Break Reminder Sent in Airtable

After successfully creating the Gmail draft, update the student record:
- Set `Break Reminder Sent` (`fld3S8qo1Z6Ud7wqk`) = true

This prevents the reminder from firing again on subsequent daily runs.

---

## Step 4 — Log summary

Log a brief summary: how many reminders were drafted, student names, and planned return dates. If any draft failed, log the error but continue processing the remaining students.
