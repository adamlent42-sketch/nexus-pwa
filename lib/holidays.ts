// Compute US federal holidays + common NY school-district breaks for a given
// year. Returns suggestions the admin can one-click add to the Closures table.

import { CLOSURE_REASONS } from "./options";

export type SuggestionReason = (typeof CLOSURE_REASONS)[number];

export interface Suggestion {
  date: string;
  reason: SuggestionReason;
  label: string;
  groupKey: string;
}

// Class days the center is open. Mon/Tue/Thu/Sat.
const CLASS_DOW = new Set([1, 2, 4, 6]);

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function isClassDay(d: Date) { return CLASS_DOW.has(d.getDay()); }

function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

function lastWeekday(year: number, month0: number, weekday: number): Date {
  const last = new Date(year, month0 + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month0, last.getDate() - offset);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

// Federal holidays. Returns the dates the center should be closed for, using
// a Kumon-specific "observed" rule:
//   - Sunday → following Monday (Sunday isn't a class day; Monday is).
//   - Saturday: don't shift — Saturday IS a class day, so close on the
//     actual holiday rather than the federally-observed Friday.
//   - Weekdays: use as-is.
// This differs from the federal observance rule, which also shifts Sat→Fri.
function federalHolidays(year: number): Array<{ date: Date; reason: SuggestionReason }> {
  const observed = (d: Date): Date => {
    if (d.getDay() === 0) return addDays(d, 1);
    return d;
  };
  return [
    { date: observed(new Date(year, 0, 1)),  reason: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3),       reason: "MLK Day" },
    { date: nthWeekday(year, 1, 1, 3),       reason: "Presidents Day" },
    { date: lastWeekday(year, 4, 1),         reason: "Memorial Day" },
    { date: observed(new Date(year, 5, 19)), reason: "Juneteenth" },
    { date: observed(new Date(year, 6, 4)),  reason: "July 4th" },
    { date: nthWeekday(year, 8, 1, 1),       reason: "Labor Day" },
    { date: nthWeekday(year, 9, 1, 2),       reason: "Columbus Day" },
    { date: observed(new Date(year, 10, 11)),reason: "Veterans Day" },
    { date: nthWeekday(year, 10, 4, 4),      reason: "Thanksgiving" },
    { date: observed(new Date(year, 11, 25)),reason: "Christmas" }
  ];
}

// Returns all class-day suggestions for one year.
export function suggestionsForYear(year: number): Suggestion[] {
  const out: Suggestion[] = [];

  for (const h of federalHolidays(year)) {
    if (!isClassDay(h.date)) continue;
    out.push({
      date: ymd(h.date),
      reason: h.reason,
      label: h.reason,
      groupKey: `${h.reason} ${year}`
    });
  }

  const thx = nthWeekday(year, 10, 4, 4);
  const thxSat = addDays(thx, 2);
  if (isClassDay(thxSat)) {
    out.push({
      date: ymd(thxSat),
      reason: "Thanksgiving Break",
      label: "Saturday after Thanksgiving",
      groupKey: `Thanksgiving Break ${year}`
    });
  }

  for (let day = 24; day <= 31; day++) {
    const d = new Date(year, 11, day);
    if (!isClassDay(d)) continue;
    if (d.getMonth() === 11 && d.getDate() === 25) continue;
    out.push({
      date: ymd(d),
      reason: "Winter Break",
      label: `Winter Break (${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`,
      groupKey: `Winter Break ${year}`
    });
  }
  for (let day = 1; day <= 2; day++) {
    const d = new Date(year + 1, 0, day);
    if (!isClassDay(d)) continue;
    if (day === 1) continue;
    out.push({
      date: ymd(d),
      reason: "Winter Break",
      label: `Winter Break (${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`,
      groupKey: `Winter Break ${year}`
    });
  }

  const presDay = nthWeekday(year, 1, 1, 3);
  for (let i = 0; i < 6; i++) {
    const d = addDays(presDay, i);
    if (!isClassDay(d)) continue;
    if (d.getTime() === presDay.getTime()) continue;
    out.push({
      date: ymd(d),
      reason: "Mid-Winter Recess",
      label: `Mid-Winter Recess (${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`,
      groupKey: `Mid-Winter Recess ${year}`
    });
  }

  const easter = easterSunday(year);
  for (let i = 6; i >= 1; i--) {
    const d = addDays(easter, -i);
    if (!isClassDay(d)) continue;
    out.push({
      date: ymd(d),
      reason: "Spring Break",
      label: `Spring Break (${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`,
      groupKey: `Spring Break ${year}`
    });
  }

  const seen = new Map<string, Suggestion>();
  for (const s of out.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!seen.has(s.date)) seen.set(s.date, s);
  }
  return Array.from(seen.values());
}

export function suggestionsForWindow(startYmd: string, endYmd: string): Suggestion[] {
  const startY = parseInt(startYmd.slice(0, 4), 10);
  const endY = parseInt(endYmd.slice(0, 4), 10);
  const all: Suggestion[] = [];
  for (let y = startY; y <= endY; y++) all.push(...suggestionsForYear(y));
  return all.filter((s) => s.date >= startYmd && s.date <= endYmd);
}

export function groupSuggestions(suggestions: Suggestion[]): Map<string, Suggestion[]> {
  const map = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const arr = map.get(s.groupKey) ?? [];
    arr.push(s);
    map.set(s.groupKey, arr);
  }
  return map;
}
