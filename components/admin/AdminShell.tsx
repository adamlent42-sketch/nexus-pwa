"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-fetch";

interface AttentionItem { count: number; tone: "red" | "yellow" | "green"; href: string }
interface AttentionData { items: AttentionItem[] }

const TABS = [
  { href: "/admin" as const,                   label: "Home" },
  { href: "/admin/growth" as const,            label: "Road to 225" },
  { href: "/admin/compose" as const,           label: "Compose" },
  { href: "/admin/po-recaps" as const,         label: "PO recaps" },
  { href: "/admin/students" as const,          label: "Students" },
  { href: "/admin/breaks" as const,            label: "Breaks & holds" },
  { href: "/admin/scheduled-day" as const,     label: "Who's scheduled" },
  { href: "/admin/missing-data" as const,      label: "Missing data" },
  { href: "/admin/outbox" as const,            label: "Email Outbox" },
  { href: "/admin/student-outreach" as const,  label: "Student outreach" },
  { href: "/admin/change-requests" as const,   label: "Change requests" },
  { href: "/admin/time-off" as const,          label: "Time off" },
  { href: "/admin/instruction-notes" as const, label: "Instruction notes" },
  { href: "/admin/upcoming-starts" as const,   label: "Upcoming starts" },
  { href: "/admin/staff" as const,             label: "Staff" },
  { href: "/admin/closures" as const,          label: "Closures" },
  { href: "/admin/scheduled-tasks" as const,   label: "Scheduled tasks" },
  { href: "/admin/training" as const,          label: "Training" }
];

// Admin is an OPEN section (no passphrase) — it's a separator for owner/staff
// operations, not a security boundary. If a lower-level staff interface is split
// out later, re-introduce a gate here and in lib/admin-auth.ts:requireAdminPass.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Live attention counts → badge the nav tabs that have something waiting.
  const attention = useQuery({
    queryKey: ["admin", "attention"],
    queryFn: () => adminFetch<AttentionData>("/api/admin/attention"),
    refetchInterval: 60_000
  });
  const tabBadge: Record<string, { count: number; tone: string }> = {};
  for (const i of attention.data?.items ?? []) {
    if (i.count <= 0) continue;
    const cur = tabBadge[i.href];
    const tone = cur?.tone === "red" || i.tone === "red" ? "red" : "yellow";
    tabBadge[i.href] = { count: (cur?.count ?? 0) + i.count, tone };
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-brand-deep text-white flex items-center justify-center font-display font-bold">K</div>
          <div>
            <p className="text-[18px] font-medium leading-tight">Owner operations <span className="ml-1 inline-block badge bg-tint-purple-bg text-tint-purple-fg align-middle">Admin</span></p>
            <p className="text-[13px] text-ink-secondary mt-0.5">Kumon Wappingers Falls</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </header>

      <nav className="flex gap-1 mb-5 border-b border-line flex-wrap">
        {TABS.map((t) => {
          const active = pathname === t.href;
          const badge = tabBadge[t.href];
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2 text-[14px] -mb-px border-b-2 inline-flex items-center gap-1.5 ${active ? "border-brand font-medium" : "border-transparent text-ink-secondary hover:text-ink"}`}
            >
              {t.label}
              {badge && (
                <span className={`badge ${badge.tone === "red" ? "bg-status-danger-bg text-status-danger-fg" : "bg-status-warn-bg text-status-warn-fg"}`}>
                  {badge.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {children}
    </>
  );
}
