// Server-side only. Read-only Invoice Ninja (v5) connector.
// Pulls a family's invoice so staff can see the amount due at the first class.
// NEVER creates invoices, clients, or payments — purely GET requests.

const BASE = process.env.INVOICE_NINJA_URL ?? "https://invoicing.co";
const TOKEN = process.env.INVOICE_NINJA_TOKEN;

export function invoiceNinjaConfigured(): boolean {
  return !!TOKEN;
}

async function inFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    headers: {
      "X-Api-Token": TOKEN as string,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`Invoice Ninja API ${res.status}`);
  return res.json() as Promise<T>;
}

// v5 invoice status_id → label
const STATUS: Record<number, string> = { 1: "Draft", 2: "Sent", 3: "Partial", 4: "Paid", 5: "Cancelled", 6: "Reversed" };

export interface InvoiceSummary {
  configured: boolean;
  found: boolean;
  ambiguous?: boolean;     // multiple clients on this email, none matched the student name
  candidates?: string[];   // their names, so the UI can explain
  clientName?: string;
  number?: string;
  amount?: number;   // invoice total
  balance?: number;  // outstanding (what's still due)
  status?: string;
  dueDate?: string | null;
  // The FIRST (earliest) invoice — what "first invoice paid" refers to.
  firstInvoicePaid?: boolean;   // true only when that invoice is fully paid
  firstPaymentDate?: string | null;
}

interface InContact { email?: string }
interface InClient { id: string; name?: string; display_name?: string; contacts?: InContact[] }
interface InPayment { date?: string; amount?: number | string }
interface InInvoice { number?: string; amount?: number | string; balance?: number | string; status_id?: number; due_date?: string | null; date?: string; payments?: InPayment[] }

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
// Does an Invoice Ninja client name correspond to this student? Clients are
// named by the kid, so we match the student's name against the client name.
function nameMatches(clientName: string, studentName: string): boolean {
  const c = norm(clientName), st = norm(studentName);
  if (!c || !st) return false;
  if (c === st || c.includes(st) || st.includes(c)) return true;
  const ctok = new Set(c.split(" "));
  return st.split(" ").every((t) => ctok.has(t)); // all student tokens in client name
}

// Find the Invoice Ninja client for THIS student (clients are named by the kid,
// parent is the contact/email) and return their initial / outstanding invoice.
// Strategy: gather clients matching any family email, then pick the one whose
// name matches the student; if exactly one client on the email, use it (covers
// the old parent-named clients + single-kid families); if several and none
// match the name, report ambiguous so staff can check manually.
export async function getInvoiceForStudent(studentName: string, emails: string[]): Promise<InvoiceSummary> {
  if (!TOKEN) return { configured: false, found: false };
  const tried = Array.from(new Set(emails.map((e) => e?.trim().toLowerCase()).filter(Boolean))) as string[];

  const byId = new Map<string, InClient>();
  for (const email of tried) {
    try {
      const res = await inFetch<{ data?: InClient[] }>(`/clients?email=${encodeURIComponent(email)}&per_page=50`);
      for (const c of res.data ?? []) {
        // Defensive: keep only clients that actually have a contact with this email
        // (in case the server-side filter is loose).
        const ok = !c.contacts || c.contacts.length === 0 ||
          c.contacts.some((ct) => (ct.email ?? "").trim().toLowerCase() === email);
        if (ok) byId.set(c.id, c);
      }
    } catch {
      continue;
    }
  }

  const candidates = Array.from(byId.values());
  if (candidates.length === 0) return { configured: true, found: false };

  let client = candidates.find((c) => nameMatches(c.display_name || c.name || "", studentName));
  if (!client) {
    if (candidates.length === 1) client = candidates[0];
    else return { configured: true, found: false, ambiguous: true, candidates: candidates.map((c) => c.display_name || c.name || "(unnamed)") };
  }

  const invRes = await inFetch<{ data?: InInvoice[] }>(`/invoices?client_id=${client.id}&sort=date|asc&per_page=50&include=payments`);
  const invoices = invRes.data ?? [];
  const clientName = client.display_name || client.name;
  if (invoices.length === 0) return { configured: true, found: true, clientName, firstInvoicePaid: false };

  // Judge "first invoice paid" off the EARLIEST invoice specifically (invoices are
  // sorted date asc). Doing it this way keeps the flag true even after a later
  // recurring invoice is generated — at which point the display invoice below
  // flips back to "Sent". Full payment only: status Paid (4) or zero balance.
  const firstInvoice = invoices[0];
  const firstInvoicePaid =
    firstInvoice.status_id === 4 ||
    (Number(firstInvoice.balance ?? 0) <= 0 && Number(firstInvoice.amount ?? 0) > 0);
  const firstPaymentDate = firstInvoicePaid
    ? ((firstInvoice.payments ?? [])
        .map((p) => p.date)
        .filter((dt): dt is string => Boolean(dt))
        .sort()
        .pop() ?? null)
    : null;

  // For the on-screen banner, still prefer whatever invoice currently has a balance.
  const withBalance = invoices.filter((i) => Number(i.balance ?? 0) > 0);
  const chosen = withBalance[0] ?? invoices[0];
  return {
    configured: true,
    found: true,
    clientName,
    number: chosen.number,
    amount: Number(chosen.amount ?? 0),
    balance: Number(chosen.balance ?? 0),
    status: STATUS[chosen.status_id ?? 0] ?? "—",
    dueDate: chosen.due_date || null,
    firstInvoicePaid,
    firstPaymentDate
  };
}

// Sum of ACTIVE recurring-invoice amounts, normalized to a monthly figure — the
// center's true monthly recurring billing ("what you bill every month"). Read-only
// and fail-soft: returns null when not configured or on any API error, so the
// scoreboard degrades to the modeled estimate instead of breaking. Kumon tuition
// is monthly; any non-monthly recurring is normalized via MONTHLY_FACTOR.
const MONTHLY_FACTOR: Record<number, number> = { 1: 30, 2: 4.333, 3: 2.167, 4: 1.083, 5: 1, 6: 0.5, 7: 0.333, 8: 0.25, 9: 0.0833 };

interface InRecurring { amount?: number | string; status_id?: number; frequency_id?: number }

export async function getActiveRecurringMrr(): Promise<number | null> {
  if (!TOKEN) return null;
  try {
    const res = await inFetch<{ data?: InRecurring[] }>(`/recurring_invoices?per_page=500`);
    const rows = res.data ?? [];
    let total = 0;
    for (const r of rows) {
      if (r.status_id !== 2) continue; // 2 = Active in Invoice Ninja v5
      const factor = MONTHLY_FACTOR[r.frequency_id ?? 5] ?? 1;
      total += Number(r.amount ?? 0) * factor;
    }
    return Math.round(total);
  } catch {
    return null;
  }
}
