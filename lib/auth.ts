"use client";

import { STAFF_NAMES, type StaffName } from "./utils";

const STORAGE_KEY = "kumon-pwa.staffName";

export function getStaffName(): StaffName | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  return (STAFF_NAMES as readonly string[]).includes(v) ? (v as StaffName) : null;
}

export function setStaffName(name: StaffName | null): void {
  if (typeof window === "undefined") return;
  if (name === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, name);
  }
}
