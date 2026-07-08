"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  ApiResponse,
  PORow,
  AlertRow,
  InstructionNoteRow,
  NewStudentsGroups,
  StaffRow,
  CoverageDay
} from "@/types/kumon";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let body: ApiResponse<T>;
  try {
    body = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(`Server error (status ${res.status}) — try refreshing`);
  }
  if (!body.ok) throw new Error(body.error || `Request failed: ${url}`);
  return body.data;
}

export function useTodaysPOs() {
  return useQuery({
    queryKey: ["pos", "today"],
    queryFn: () => fetchJson<PORow[]>("/api/pos/today")
  });
}

export function useActiveAlerts() {
  return useQuery({
    queryKey: ["alerts", "active"],
    queryFn: () => fetchJson<AlertRow[]>("/api/alerts/active")
  });
}

export function useTodaysInstructionNotes(date?: string) {
  return useQuery({
    queryKey: ["instruction-notes", "today", date ?? "today"],
    queryFn: () => fetchJson<InstructionNoteRow[]>(`/api/instruction-notes/today${date ? `?date=${date}` : ""}`)
  });
}

export function useNewStudents() {
  return useQuery({
    queryKey: ["students", "new"],
    queryFn: () => fetchJson<NewStudentsGroups>("/api/students/new")
  });
}

export function useTodaysStaff(date?: string) {
  return useQuery({
    queryKey: ["staff", "today", date ?? "today"],
    queryFn: () => fetchJson<StaffRow[]>(`/api/staff/today${date ? `?date=${date}` : ""}`)
  });
}

export function useCoverage() {
  return useQuery({
    queryKey: ["coverage", "4-week"],
    queryFn: () => fetchJson<CoverageDay[]>("/api/coverage/4-week")
  });
}
