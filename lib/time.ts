// Time helpers. America/New_York is the only timezone the app cares about.

export const TZ = "America/New_York" as const;

// Returns today's date in ET as 'YYYY-MM-DD'.
export function todayInET(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date());
}

// Adds N days to a 'YYYY-MM-DD' string, returns the same shape.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns 0..6, where 0 = Sunday — using ET-anchored midday to avoid TZ drift.
export function dayOfWeekET(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const ddmmyyyy = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short"
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  return map[ddmmyyyy] ?? 0;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export function dayNameET(isoDate: string): typeof DAY_NAMES[number] {
  return DAY_NAMES[dayOfWeekET(isoDate)];
}

// Days between two YYYY-MM-DD strings (b - a).
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T12:00:00Z`).getTime();
  const b = new Date(`${bIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Returns now in ET as 'YYYY-MM-DDTHH:mm' (24-hour, no seconds, no offset).
export function nowInET(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Parses "4:30 PM" → "16:30", "8 AM" → "08:00". Returns null if it can't.
export function parseTime12h(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([APap][Mm])/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const isPM = m[3].toLowerCase() === "pm";
  if (h === 12) h = isPM ? 12 : 0;
  else if (isPM) h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Friendly relative-time label: "2h ago", "1d ago", "just now".
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (diffMs < 60 * 1000) return "just now";
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
