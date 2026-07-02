"use client";

import { getStoredAdminPass } from "./admin-auth";

interface ApiOk<T> { ok: true; data: T }
interface ApiErr { ok: false; error: string }
type ApiResp<T> = ApiOk<T> | ApiErr;

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-admin-pass", getStoredAdminPass());
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const body = (await res.json()) as ApiResp<T>;
  if (!body.ok) throw new Error(body.error);
  return body.data;
}
