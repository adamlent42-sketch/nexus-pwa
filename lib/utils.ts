import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

export function formatDate(date: Date | string, format: "short" | "long" = "short"): string {
  // Airtable date-only fields come back as "YYYY-MM-DD". `new Date("YYYY-MM-DD")`
  // is parsed as UTC midnight, which renders as the day BEFORE in ET. Detect
  // that shape and parse as a local date so 2026-06-01 stays June 1.
  const d = typeof date === "string"
    ? /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(
          parseInt(date.slice(0, 4), 10),
          parseInt(date.slice(5, 7), 10) - 1,
          parseInt(date.slice(8, 10), 10)
        )
      : new Date(date)
    : date;
  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const STAFF_NAMES = ["Adam", "Jen", "Steve", "Myles", "Kevin", "Alice", "Peter"] as const;
export type StaffName = (typeof STAFF_NAMES)[number];
