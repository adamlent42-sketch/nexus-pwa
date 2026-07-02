// Lightweight admin auth.
// Client: passphrase is entered once, stored as a plain string in localStorage
//          (low-stakes — this is an internal owner-only gate, not real auth).
// Server: admin API routes check the same passphrase via the x-admin-pass header.

export const ADMIN_LS_KEY = "kumon-pwa.adminPass";

export function getStoredAdminPass(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_LS_KEY) ?? "";
}

export function setStoredAdminPass(value: string | null): void {
  if (typeof window === "undefined") return;
  if (value === null || value === "") {
    window.localStorage.removeItem(ADMIN_LS_KEY);
  } else {
    window.localStorage.setItem(ADMIN_LS_KEY, value);
  }
}

// Server-side admin gate — currently OPEN.
//
// The owner passphrase was removed: at this stage everything under the Admin tab
// is fine for staff to see, so Admin is just a section separator, not a vault.
// This is intentionally left as a no-op (rather than deleted) so the gate can be
// switched back on in one place if a lower-level staff interface is split out
// later — just restore the body below (commented) and re-enable the lock screen
// in AdminShell.
export function requireAdminPass(_req: Request): void {
  // OPEN. To re-enable owner-only access, restore:
  //   const expected = process.env.APP_OWNER_PASSPHRASE;
  //   if (!expected) throw new AdminAuthError("APP_OWNER_PASSPHRASE not configured");
  //   const provided = _req.headers.get("x-admin-pass") ?? "";
  //   if (provided !== expected) throw new AdminAuthError("Wrong passphrase");
  return;
}

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}
