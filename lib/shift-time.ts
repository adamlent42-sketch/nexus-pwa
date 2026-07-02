// Shift-time helpers. Times in the Weekly Schedule table are stored as
// plain text in Airtable (singleLineText), so we normalize to a single
// canonical display form and convert to/from the 24-hour "HH:MM" form
// that <input type="time"> uses.
//
// Display canonical: "3:45 PM" (h:MM AM/PM, single-digit hour, leading-zero minutes)
// Input canonical:   "15:45"   (HH:MM 24-hour)

// "3:45 PM" / "3:45pm" / "3:45" / "7PM" / "10:00 AM" / "9:45 AM" → "HH:MM" 24-hour
// Empty / unparsable → "".
//
// When no AM/PM is given we infer: hour 1-8 → PM (afternoon class), 9-12 → AM
// (Saturday morning / noon). That matches every existing Kumon-Wappingers
// shift in the table.
export function parseShiftTime(input: string | null | undefined): string {
  if (input == null) return "";
  const s = String(input).trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  if (!s) return "";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3] ?? "";
  if (!Number.isFinite(h) || h < 0 || h > 23) return "";
  if (mins < 0 || mins > 59) return "";
  if (meridiem.startsWith("p")) {
    if (h < 12) h += 12;
  } else if (meridiem.startsWith("a")) {
    if (h === 12) h = 0;
  } else {
    // No meridiem given — infer from Kumon shift conventions.
    if (h >= 1 && h <= 8) h += 12;
  }
  if (h > 23) return "";
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// "15:45" → "3:45 PM" / "10:00" → "10:00 AM" / "" → ""
export function formatShiftTime(input: string | null | undefined): string {
  if (input == null) return "";
  const s = String(input).trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    // Maybe it's already a display string — try parsing then reformatting so
    // input that comes back through this is still canonical.
    const reparsed = parseShiftTime(s);
    if (reparsed) return formatShiftTime(reparsed);
    return s;
  }
  const h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mins < 0 || mins > 59) return s;
  const meridiem = h >= 12 ? "PM" : "AM";
  let displayH = h % 12;
  if (displayH === 0) displayH = 12;
  return `${displayH}:${String(mins).padStart(2, "0")} ${meridiem}`;
}

// Convenience: take whatever string is stored and produce the canonical
// display form. Idempotent.
export function canonicalShiftTime(input: string | null | undefined): string {
  return formatShiftTime(parseShiftTime(input));
}
